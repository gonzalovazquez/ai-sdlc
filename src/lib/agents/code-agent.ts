import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getDemoModel } from "../llm";
import { agentLogger } from "../logger";
import { getToolsForAgent } from "../mcp/tools";
import { getLocalToolsForAgent } from "../local-tools";
import { WORKSPACE_DIR } from "../local-tools/fs";
import { isGitHubConfigured, pushDirectoryToBranch } from "../local-tools/github";
import { invokeWithTools } from "./invoke-with-tools";
import type { SDLCStateType } from "../graph/state";

const log = agentLogger("code_agent");
const execFileAsync = promisify(execFile);

const MAX_REPAIR_ROUNDS = 3;

/**
 * Type-check the generated workspace. Returns null when clean, otherwise the
 * compiler output. Skipped (returns null) when the workspace has no
 * dependencies installed to check against.
 */
async function typecheckWorkspace(): Promise<string | null> {
  // Unit tests stub the model with single-shot mocks; a repair round would
  // consume invocations they never queued. Never inspect the real workspace there.
  if (process.env.VITEST) return null;

  const checkable = await fs
    .access(path.join(WORKSPACE_DIR, "node_modules", "typescript"))
    .then(() => true)
    .catch(() => false);
  if (!checkable) {
    log.warn("Workspace has no installed typescript — skipping typecheck");
    return null;
  }

  try {
    await execFileAsync("npx", ["tsc", "--noEmit"], {
      cwd: WORKSPACE_DIR,
      timeout: 120_000,
    });
    return null;
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return (e.stdout || "") + (e.stderr || "") || e.message || "Unknown tsc failure";
  }
}

const SYSTEM_PROMPT = `You are the Code Agent in an AI-native SDLC pipeline.

You receive architecture decisions, design assets, and (optionally) infrastructure
state, then generate implementation code.

## Platform Routing:
### iOS (platform === "ios"):
- Generate .swift files with SwiftUI views and ViewModels
- Follow the architecture pattern (MVVM or TCA) from architectureDecisions
- Use NavigationStack for navigation
- Integrate Lottie animations from designAssets.lottieFiles
- Use conventional commits: feat:, fix:, refactor:, docs:, chore:
- Follow the DESIGN.md color tokens and component inventory

### Web (platform === "web"):
The workspace ALREADY CONTAINS a complete Next.js 16 scaffold: App Router,
TypeScript, Tailwind CSS, with app/layout.tsx, app/page.tsx, app/globals.css,
package.json and all config files in place. You generate ONLY feature files
on top of it:
Generate EXACTLY these files and NO others (no components/, no extra lib files):

1. lib/storage.ts — PLAIN TypeScript (no JSX, no React imports) exporting
   EXACTLY this API and nothing else:
   \`\`\`ts
   export interface Note { id: string; title: string; content: string; updatedAt: string; }
   export function getNotes(): Note[]
   export function saveNotes(notes: Note[]): void
   \`\`\`
   Implemented with localStorage, guarded by typeof window !== "undefined".

2. app/page.tsx — "use client" home screen. Imports ONLY
   { getNotes, saveNotes, type Note } from "@/lib/storage" plus react/next
   built-ins. All add/edit/delete logic works by reading the full list with
   getNotes() and writing it back with saveNotes().

3. One additional app/<route>/page.tsx per extra screen if truly needed,
   with the same import rules. Prefer a single page when the app is simple.

Hard rules:
- NEVER modify app/layout.tsx or app/globals.css — the scaffold versions work
- Use ONLY dependencies already in the scaffold: react, next, and Tailwind
  classes. Do NOT import any other npm package (no zustand, framer-motion,
  icon libraries, supabase, etc.) — they are not installed and will break the build
- Import React APIs by name ("import { useState } from 'react'"); never
  reference a React global. No React Context anywhere
- NEVER create or modify package.json, lockfiles, or any config file
  (next.config, tsconfig, postcss, eslint)
- The finished workspace must run with just: npm install && npm run dev

### Both:
- Generate platform-specific frontends from shared API contracts
- Ensure consistent data models

## Required Workflow — deliver code ONLY through tool calls, in this order:
1. Call fs_write_file once per generated file to write it to disk. Paths are
   relative to the workspace root (e.g. "app/page.tsx", "components/NoteList.tsx").
   Write each file EXACTLY ONCE — never rewrite a file that was written
   successfully. You may issue several fs_write_file calls in one turn.
2. When every planned file is written, STOP calling tools and write your final reply.

Your final reply must contain:
- A short human-readable summary of what was generated and why.
- A JSON block in \`\`\`json fences. List file PATHS only — NEVER include file
  contents in the JSON or anywhere else in the reply. Every JSON string must be
  a single line.
{
  "codeArtifacts": {
    "files": [
      { "path": "src/...", "content": "File was written to disk." }
    ],
    "prUrl": null,
    "branch": "feat/feature-name"
  }
}`;

export async function codeAgentNode(
  state: SDLCStateType
): Promise<Partial<SDLCStateType>> {
  const contextMessage = `Project config: ${JSON.stringify(state.projectConfig, null, 2)}
Architecture decisions: ${JSON.stringify(state.architectureDecisions, null, 2)}
Design assets summary: ${JSON.stringify(
    state.designAssets
      ? {
          screenCount: state.designAssets.screens.length,
          screens: state.designAssets.screens.map((s) => s.name),
          animations: state.designAssets.lottieFiles.map((l) => l.name),
        }
      : null,
    null,
    2
  )}
Infra state: ${JSON.stringify(state.infraState, null, 2)}
QA feedback (if any): ${JSON.stringify(state.qaResults, null, 2)}`;

  log.info({ platform: state.projectConfig.platform }, "Starting code generation");
  const start = Date.now();

  const mcpTools = await getToolsForAgent("code_agent");
  const localTools = getLocalToolsForAgent("code_agent");
  const tools = [...mcpTools, ...localTools];
  log.info({ toolCount: tools.length }, "Loaded MCP and local tools");

  const conversation = [
    new SystemMessage(SYSTEM_PROMPT),
    ...state.messages,
    new HumanMessage(`[Context]\n${contextMessage}`),
  ];

  let response = await invokeWithTools(getDemoModel(), conversation, tools);

  // Verify-and-repair: type-check the workspace and feed compiler errors back
  // for a bounded number of fix rounds. Proceeds regardless after the cap.
  if (state.projectConfig.platform !== "ios") {
    for (let round = 0; round <= MAX_REPAIR_ROUNDS; round++) {
      const errors = await typecheckWorkspace();
      if (!errors) {
        log.info({ repairRounds: round }, "Workspace type-check passed");
        break;
      }
      if (round === MAX_REPAIR_ROUNDS) {
        log.warn({ errors: errors.slice(0, 500) }, "Type-check still failing after final repair — proceeding");
        break;
      }
      log.warn({ round: round + 1, errors: errors.slice(0, 500) }, "Type-check failed — requesting repair");
      conversation.push(response);
      conversation.push(
        new HumanMessage(
          `The generated workspace fails TypeScript compilation. Fix ALL of these errors by rewriting the affected files in full with fs_write_file. Remember: imports must match real files and exports, no packages outside the scaffold, no JSX outside .tsx files, lib/ stays plain TypeScript:\n\n${errors.slice(0, 4000)}`
        )
      );
      response = await invokeWithTools(getDemoModel(), conversation, tools);
    }
  }

  const elapsed = Date.now() - start;

  const content =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  let codeArtifacts = state.codeArtifacts;

  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.codeArtifacts) {
        codeArtifacts = parsed.codeArtifacts;
        log.info({ fileCount: parsed.codeArtifacts.files.length, branch: parsed.codeArtifacts.branch }, "Generated code artifacts");
      }
    } catch {
      log.warn("Failed to parse codeArtifacts JSON from response");
    }
  }

  // Deterministic GitHub push — local models don't reliably call the GitHub
  // tools themselves, so the node pushes the whole workspace (scaffold +
  // generated files) to a feature branch. Best-effort: never blocks the run.
  if (isGitHubConfigured()) {
    try {
      const slug = (state.projectConfig.name || "sdlc-demo")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const requestedBranch = codeArtifacts?.branch || `feat/${slug}`;
      const pushed = await pushDirectoryToBranch(
        WORKSPACE_DIR,
        requestedBranch,
        `feat: ${state.projectConfig.name || "generated app"} (AI SDLC demo)`
      );
      codeArtifacts = {
        files: pushed.files.map((p) => ({ path: p, content: "Committed to GitHub." })),
        prUrl: null,
        branch: pushed.branch,
      };
      log.info({ branch: pushed.branch, fileCount: pushed.files.length }, "Workspace pushed to GitHub");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.warn({ err: errMsg }, "GitHub push failed — continuing with local artifacts");
    }
  } else {
    log.info("GitHub env not configured — skipping push");
  }

  log.info({ elapsed }, "Completed code generation");

  return {
    messages: [new AIMessage({ content, name: "code_agent" })],
    currentPhase: "implementation",
    codeArtifacts,
  };
}
