import { NextRequest } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import { getDemoGraph, ensureDemoGraphReady } from "@/lib/graph";
import { logger } from "@/lib/logger";

const log = logger.child({ route: "/api/agent/stream" });

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for long-running agent chains

/**
 * POST /api/agent/stream
 *
 * Accepts: { message: string, threadId: string }
 * Returns: SSE stream of agent events (node starts, messages, state updates)
 */
export async function POST(req: NextRequest) {
  const { message, threadId } = await req.json();

  if (!message || !threadId) {
    return new Response(
      JSON.stringify({ error: "message and threadId are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Ensure Postgres checkpoint tables exist before first graph use
  await ensureDemoGraphReady();
  const graph = getDemoGraph();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        const config = {
          configurable: { thread_id: threadId },
          streamMode: "updates" as const,
        };

        const input = {
          messages: [new HumanMessage(message)],
        };

        log.info({ threadId }, "Starting agent stream");
        sendEvent("start", { threadId, timestamp: Date.now() });

        const streamResult = await graph.stream(input, config);

        for await (const event of streamResult) {
          // Each event is { nodeName: { ...stateUpdates } }
          for (const [nodeName, updates] of Object.entries(event)) {
            sendEvent("node_update", {
              node: nodeName,
              updates,
              timestamp: Date.now(),
            });

            // Extract messages for the chat UI
            const nodeUpdates = updates as Record<string, unknown>;
            if (nodeUpdates.messages && Array.isArray(nodeUpdates.messages)) {
              for (const msg of nodeUpdates.messages) {
                sendEvent("message", {
                  node: nodeName,
                  content:
                    typeof msg.content === "string"
                      ? msg.content
                      : JSON.stringify(msg.content),
                  timestamp: Date.now(),
                });
              }
            }

            // Signal phase changes
            if (nodeUpdates.currentPhase) {
              sendEvent("phase_change", {
                phase: nodeUpdates.currentPhase,
                timestamp: Date.now(),
              });
            }

            // Signal human review gate
            if (nodeUpdates.awaitingApproval) {
              sendEvent("awaiting_approval", {
                node: nodeName,
                timestamp: Date.now(),
              });
            }
          }
        }

        log.info({ threadId }, "Agent stream completed");
        sendEvent("end", { threadId, timestamp: Date.now() });
      } catch (error) {
        log.error({ threadId, err: error }, "Agent stream error");
        sendEvent("error", {
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
          timestamp: Date.now(),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
