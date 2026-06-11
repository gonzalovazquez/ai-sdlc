import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { AIMessage } from "@langchain/core/messages";
import { WORKSPACE_DIR } from "../local-tools/fs";
import { agentLogger } from "../logger";
import type { SDLCStateType } from "../graph/state";

const execFileAsync = promisify(execFile);
const log = agentLogger("scaffold");

// Pinned so the generated layout doesn't drift under the Code agent's prompt.
const CREATE_NEXT_APP = "create-next-app@16";

/**
 * Scaffold Node — deterministic (no LLM). Runs create-next-app into the
 * workspace so the Code agent only generates feature files on top of a
 * complete, runnable Next.js project.
 *
 * Idempotent: skipped when workspace/package.json already exists. A stale
 * workspace without package.json (leftover generated files from older runs)
 * is wiped first, since create-next-app refuses non-empty directories.
 */
export async function scaffoldNode(
  state: SDLCStateType
): Promise<Partial<SDLCStateType>> {
  const platform = state.projectConfig.platform;

  if (platform === "ios") {
    log.info("iOS platform — skipping web scaffold");
    return {
      messages: [
        new AIMessage({
          content: "Scaffold step skipped: iOS projects have no web scaffold.",
          name: "scaffold",
        }),
      ],
    };
  }

  const start = Date.now();

  const hasPackageJson = await fs
    .access(path.join(WORKSPACE_DIR, "package.json"))
    .then(() => true)
    .catch(() => false);

  if (hasPackageJson) {
    log.info({ workspace: WORKSPACE_DIR }, "Workspace already scaffolded — skipping");
    return {
      messages: [
        new AIMessage({
          content: `Workspace already contains a Next.js scaffold at \`${WORKSPACE_DIR}\` — reusing it.`,
          name: "scaffold",
        }),
      ],
    };
  }

  // Wipe stale non-scaffold leftovers; create-next-app needs an empty target.
  await fs.rm(WORKSPACE_DIR, { recursive: true, force: true });

  log.info({ workspace: WORKSPACE_DIR }, "Scaffolding Next.js app");

  await execFileAsync(
    "npx",
    [
      "-y",
      CREATE_NEXT_APP,
      WORKSPACE_DIR,
      "--ts",
      "--app",
      "--tailwind",
      "--eslint",
      "--import-alias",
      "@/*",
      "--use-npm",
      "--disable-git",
      "--yes",
    ],
    // Includes npm install so the workspace is immediately type-checkable
    // by the Code agent's repair loop (and runnable for the demo).
    { timeout: 360_000 }
  );

  const elapsed = Date.now() - start;
  log.info({ elapsed, workspace: WORKSPACE_DIR }, "Scaffold complete");

  return {
    messages: [
      new AIMessage({
        content: `## Scaffold Ready

Created a Next.js 16 scaffold (App Router, TypeScript, Tailwind CSS) in \`${WORKSPACE_DIR}\`.
The Code agent will now generate the feature files on top of it.

To run the finished app: \`cd workspace && npm install && npm run dev\``,
        name: "scaffold",
      }),
    ],
  };
}
