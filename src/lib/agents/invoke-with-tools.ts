import { type BaseMessage, AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseChatModel, BindToolsInput } from "@langchain/core/language_models/chat_models";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import { logger } from "../logger";

const log = logger.child({ module: "invoke-with-tools" });

const MAX_TOOL_ROUNDS = 10;

/**
 * Invoke any LangChain chat model with tools bound.
 * Runs the tool-calling loop: if the model returns tool_calls, execute them
 * and feed results back until the model produces a final text response.
 *
 * If `tools` is empty, falls back to a plain invoke (no tool binding).
 */
export async function invokeWithTools(
  model: BaseChatModel,
  messages: BaseMessage[],
  tools: DynamicStructuredTool[]
): Promise<AIMessage> {
  if (tools.length === 0) {
    return model.invoke(messages) as Promise<AIMessage>;
  }

  const boundModel = model.bindTools!(tools as BindToolsInput[]);
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  const currentMessages = [...messages];
  let nudgedForFinalReply = false;
  // Local models can loop, re-issuing an identical tool call every round.
  // Track call signatures and short-circuit repeats with corrective feedback.
  const seenCalls = new Set<string>();

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = (await boundModel.invoke(currentMessages)) as AIMessage;

    const toolCalls = response.tool_calls ?? [];
    if (toolCalls.length === 0) {
      // Some models (e.g. qwen via Ollama) finish a tool session with an
      // empty message. Nudge once for the final text reply instead of
      // returning nothing to the caller.
      const text =
        typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);
      if (round > 0 && text.trim().length === 0 && !nudgedForFinalReply) {
        nudgedForFinalReply = true;
        log.debug({ round }, "Empty final response after tool calls — nudging for summary");
        currentMessages.push(response);
        currentMessages.push(
          new HumanMessage(
            "All tool calls are complete. Now write your final reply, including the required JSON block."
          )
        );
        continue;
      }
      return response;
    }

    log.debug(
      { round, tools: toolCalls.map((tc) => tc.name) },
      "Model requested tool calls"
    );

    currentMessages.push(response);

    for (const toolCall of toolCalls) {
      const signature = `${toolCall.name}:${JSON.stringify(toolCall.args)}`;
      if (seenCalls.has(signature)) {
        log.warn({ tool: toolCall.name }, "Duplicate tool call — skipping");
        currentMessages.push(
          new ToolMessage({
            tool_call_id: toolCall.id!,
            content: `You already called ${toolCall.name} with these exact arguments and it succeeded. Do NOT repeat it. Continue with the remaining work or write your final reply.`,
          })
        );
        continue;
      }
      seenCalls.add(signature);

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
