import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { getDemoModel } from "../llm";
import { getToolsForAgent } from "../mcp/tools";
import { getLocalToolsForAgent } from "../local-tools";
import { invokeWithTools } from "./invoke-with-tools";
import { logger } from "../logger";

const log = logger.child({ module: "invoke-agent" });

export interface InvokeAgentParams {
  agentName: string;
  systemPrompt: string;
  messages: BaseMessage[];
  contextMessage?: string;
  /** Claude model ID; ignored when LLM_PROVIDER=ollama. */
  model?: string;
}

/**
 * Invoke an SDLC agent with its MCP and local tools bound, using the
 * provider selected by LLM_PROVIDER (Claude API by default, or Ollama).
 */
export async function invokeAgent({
  agentName,
  systemPrompt,
  messages,
  contextMessage,
  model,
}: InvokeAgentParams): Promise<AIMessage> {
  const tools = [
    ...(await getToolsForAgent(agentName)),
    ...getLocalToolsForAgent(agentName),
  ];
  log.debug({ agentName, model, toolCount: tools.length }, "Invoking agent");

  return invokeWithTools(
    getDemoModel(model),
    [
      new SystemMessage(systemPrompt),
      ...messages,
      ...(contextMessage ? [new HumanMessage(`[Context]\n${contextMessage}`)] : []),
    ],
    tools
  );
}
