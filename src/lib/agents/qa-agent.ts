import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getDemoModel } from "../llm";
import { agentLogger } from "../logger";
import type { SDLCStateType } from "../graph/state";

const log = agentLogger("qa_agent");

const SYSTEM_PROMPT = `You are the QA Agent in an AI-native SDLC pipeline.

You receive code artifacts and review them for quality, correctness, and adherence
to the architecture and design system.

## Responsibilities:
1. Review generated code for bugs, logic errors, and security vulnerabilities
2. Check adherence to the chosen architecture pattern (MVVM/TCA/Component-based)
3. Verify design system compliance (colors, typography, spacing from DESIGN.md)
4. Generate test cases (XCTest for iOS, Vitest for web)
5. Check for common issues: memory leaks, concurrency safety, performance
6. Verify SwiftLint / ESLint compliance
7. Decide: APPROVE (pass to release) or REJECT (loop back to code agent with feedback)

## Output
Respond with a JSON block in \`\`\`json fences:
{
  "qaResults": {
    "testsPassed": number,
    "testsFailed": number,
    "coverage": number (0-100),
    "issues": ["list of issues found"],
    "approved": true/false
  }
}

If approved is false, clearly explain what needs to be fixed so the Code Agent
can address it in the next iteration.`;

export async function qaAgentNode(
  state: SDLCStateType
): Promise<Partial<SDLCStateType>> {
  const contextMessage = `Project config: ${JSON.stringify(state.projectConfig, null, 2)}
Architecture decisions: ${JSON.stringify(state.architectureDecisions, null, 2)}
Design assets: ${JSON.stringify(state.designAssets ? { designMd: state.designAssets.designMdContent?.slice(0, 2000) } : null, null, 2)}
Code artifacts: ${JSON.stringify(
    state.codeArtifacts
      ? {
          fileCount: state.codeArtifacts.files.length,
          files: state.codeArtifacts.files.map((f) => ({
            path: f.path,
            lines: f.content.split("\n").length,
          })),
          branch: state.codeArtifacts.branch,
        }
      : null,
    null,
    2
  )}

Full code for review:
${state.codeArtifacts?.files.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n") ?? "No code artifacts"}`;

  log.info({ fileCount: state.codeArtifacts?.files.length ?? 0 }, "Starting QA review");
  const start = Date.now();

  const response = await getDemoModel().invoke([
    new SystemMessage(SYSTEM_PROMPT),
    ...state.messages,
    new HumanMessage(`[Context]\n${contextMessage}`),
  ]);

  const elapsed = Date.now() - start;

  const content =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  let qaResults = state.qaResults;

  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.qaResults) {
        qaResults = parsed.qaResults;
        log.info({ approved: parsed.qaResults.approved, passed: parsed.qaResults.testsPassed, failed: parsed.qaResults.testsFailed, coverage: parsed.qaResults.coverage }, "QA results");
      }
    } catch {
      log.warn("Failed to parse qaResults JSON from response");
    }
  }

  log.info({ elapsed }, "Completed QA review");

  return {
    messages: [new AIMessage({ content, name: "qa_agent" })],
    currentPhase: "qa",
    qaResults,
  };
}
