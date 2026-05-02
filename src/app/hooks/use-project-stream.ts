import type { AgentMessage } from "./use-agent-stream";

export type StreamEventType =
  | "message"
  | "phase_change"
  | "awaiting_approval"
  | "error"
  | "end";

export interface StreamEvent {
  type: StreamEventType;
  data: Record<string, unknown>;
}

export type OnStreamEvent = (projectId: string, event: StreamEvent) => void;

/**
 * Stateless stream manager that supports multiple concurrent project streams.
 * Instead of holding React state, it dispatches events via `onEvent` callback
 * so the caller (ProjectsContext) can route updates to the correct project slot.
 */
export function createProjectStreamManager(onEvent: OnStreamEvent) {
  const controllers = new Map<string, AbortController>();
  const msgCounters = new Map<string, number>();

  function nextMsgId(projectId: string): string {
    const count = (msgCounters.get(projectId) ?? 0) + 1;
    msgCounters.set(projectId, count);
    return `msg-${projectId}-${count}`;
  }

  async function processStream(projectId: string, response: Response) {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let currentEvent = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7);
        } else if (line.startsWith("data: ") && currentEvent) {
          try {
            const data = JSON.parse(line.slice(6));

            switch (currentEvent) {
              case "message":
                onEvent(projectId, {
                  type: "message",
                  data: {
                    id: nextMsgId(projectId),
                    node: data.node,
                    content: data.content,
                    timestamp: data.timestamp,
                  },
                });
                break;

              case "phase_change":
                onEvent(projectId, {
                  type: "phase_change",
                  data: { phase: data.phase },
                });
                break;

              case "awaiting_approval":
                onEvent(projectId, {
                  type: "awaiting_approval",
                  data: {},
                });
                break;

              case "error":
                onEvent(projectId, {
                  type: "error",
                  data: { message: data.message },
                });
                break;

              case "end":
                onEvent(projectId, { type: "end", data: {} });
                break;
            }
          } catch {
            // Skip malformed JSON
          }
          currentEvent = "";
        }
      }
    }
  }

  async function sendMessage(
    projectId: string,
    message: string,
    threadId: string
  ) {
    // Abort any existing stream for this project
    controllers.get(projectId)?.abort();
    const controller = new AbortController();
    controllers.set(projectId, controller);

    // Emit the user message immediately
    onEvent(projectId, {
      type: "message",
      data: {
        id: nextMsgId(projectId),
        node: "user",
        content: message,
        timestamp: Date.now(),
      },
    });

    try {
      const response = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, threadId }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Stream failed: ${response.statusText}`);
      }

      await processStream(projectId, response);
      onEvent(projectId, { type: "end", data: {} });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      onEvent(projectId, {
        type: "error",
        data: {
          message: error instanceof Error ? error.message : "Stream failed",
        },
      });
    } finally {
      controllers.delete(projectId);
    }
  }

  async function approve(
    projectId: string,
    threadId: string,
    approved: boolean,
    feedback?: string
  ) {
    try {
      const response = await fetch("/api/agent/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, approved, feedback }),
      });

      if (!response.ok) {
        throw new Error(`Approval failed: ${response.statusText}`);
      }

      await processStream(projectId, response);
      onEvent(projectId, { type: "end", data: {} });
    } catch (error) {
      onEvent(projectId, {
        type: "error",
        data: {
          message:
            error instanceof Error ? error.message : "Approval failed",
        },
      });
    }
  }

  function abort(projectId: string) {
    controllers.get(projectId)?.abort();
    controllers.delete(projectId);
  }

  return { sendMessage, approve, abort };
}
