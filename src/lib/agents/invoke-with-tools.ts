import { type BaseMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import type { ChatAnthropic } from "@langchain/anthropic";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import { logger } from "../logger";

const log = logger.child({ module: "invoke-with-tools" });

const MAX_TOOL_ROUNDS = 10;

/**
 * Invoke a ChatAnthropic model with MCP tools bound.
 * Runs the tool-calling loop: if the model returns tool_calls, execute them
 * and feed results back until the model produces a final text response.
 *
 * If `tools` is empty, falls back to a plain invoke (no tool binding).
 */
export async function invokeWithTools(
  model: ChatAnthropic,
  messages: BaseMessage[],
  tools: DynamicStructuredTool[]
): Promise<AIMessage> {
  if (tools.length === 0) {
    return model.invoke(messages) as Promise<AIMessage>;
  }

  const boundModel = model.bindTools(tools);
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  const currentMessages = [...messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = (await boundModel.invoke(currentMessages)) as AIMessage;

    const toolCalls = response.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return response;
    }

    log.debug(
      { round, tools: toolCalls.map((tc) => tc.name) },
      "Model requested tool calls"
    );

    currentMessages.push(response);

    for (const toolCall of toolCalls) {
      const tool = toolMap.get(toolCall.name);
      if (!tool) {
        log.warn({ tool: toolCall.name }, "Model called unknown tool");
        currentMessages.push(
          new ToolMessage({
            tool_call_id: toolCall.id!,
            content: `Error: unknown tool "${toolCall.name}"`,
          })
        );
        continue;
      }

      try {
        const result = await tool.invoke(toolCall.args);
        currentMessages.push(
          new ToolMessage({
            tool_call_id: toolCall.id!,
            content: typeof result === "string" ? result : JSON.stringify(result),
          })
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.warn({ tool: toolCall.name, err: errMsg }, "Tool execution failed");
        currentMessages.push(
          new ToolMessage({
            tool_call_id: toolCall.id!,
            content: `Error executing tool: ${errMsg}`,
          })
        );
      }
    }
  }

  log.warn("Reached max tool rounds, returning last response");
  return (await boundModel.invoke(currentMessages)) as AIMessage;
}
