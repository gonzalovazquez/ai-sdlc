import { NextRequest } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import { getDemoGraph, ensureDemoGraphReady } from "@/lib/graph";

export const runtime = "nodejs";

/**
 * POST /api/agent/approve
 *
 * Resumes a paused graph after human review.
 * Accepts: { threadId: string, approved: boolean, feedback?: string }
 */
export async function POST(req: NextRequest) {
  const { threadId, approved, feedback } = await req.json();

  if (!threadId || typeof approved !== "boolean") {
    return new Response(
      JSON.stringify({ error: "threadId and approved (boolean) are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  await ensureDemoGraphReady();
  const graph = getDemoGraph();
  const config = { configurable: { thread_id: threadId } };

  try {
    if (approved) {
      // Resume the graph — update state to clear approval flag and continue
      await graph.updateState(config, {
        awaitingApproval: false,
        messages: [
          new HumanMessage(
            feedback
              ? `Approved with feedback: ${feedback}`
              : "Approved. Proceed with code generation."
          ),
        ],
      });
    } else {
      // Rejected — send feedback and loop back to architect
      await graph.updateState(
        config,
        {
          awaitingApproval: false,
          messages: [
            new HumanMessage(
              `Review rejected. Feedback: ${feedback || "Please revise the architecture and design."}`
            ),
          ],
        },
        // Resume from architect to re-do decisions
        "architect_agent"
      );
    }

    // Stream the resumed graph
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          sendEvent("resumed", { threadId, approved, timestamp: Date.now() });

          const streamResult = await graph.stream(null, {
            ...config,
            streamMode: "updates" as const,
          });

          for await (const event of streamResult) {
            for (const [nodeName, updates] of Object.entries(event)) {
              sendEvent("node_update", {
                node: nodeName,
                updates,
                timestamp: Date.now(),
              });

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

              if (nodeUpdates.currentPhase) {
                sendEvent("phase_change", {
                  phase: nodeUpdates.currentPhase,
                  timestamp: Date.now(),
                });
              }

              if (nodeUpdates.awaitingApproval) {
                sendEvent("awaiting_approval", {
                  node: nodeName,
                  timestamp: Date.now(),
                });
              }
            }
          }

          sendEvent("end", { threadId, timestamp: Date.now() });
        } catch (error) {
          sendEvent("error", {
            message:
              error instanceof Error
                ? error.message
                : "Unknown error occurred",
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
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Failed to resume graph",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
