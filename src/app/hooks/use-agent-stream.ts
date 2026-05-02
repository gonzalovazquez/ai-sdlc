"use client";

import { useCallback, useRef, useState } from "react";

export interface AgentMessage {
  id: string;
  node: string;
  content: string;
  timestamp: number;
}

export interface StreamState {
  messages: AgentMessage[];
  currentPhase: string;
  isStreaming: boolean;
  awaitingApproval: boolean;
  error: string | null;
}

/**
 * Hook that manages an SSE connection to the agent stream API.
 */
export function useAgentStream() {
  const [state, setState] = useState<StreamState>({
    messages: [],
    currentPhase: "intake",
    isStreaming: false,
    awaitingApproval: false,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const msgIdCounter = useRef(0);

  const processStream = useCallback(
    async (response: Response) => {
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
                  setState((prev) => ({
                    ...prev,
                    messages: [
                      ...prev.messages,
                      {
                        id: `msg-${++msgIdCounter.current}`,
                        node: data.node,
                        content: data.content,
                        timestamp: data.timestamp,
                      },
                    ],
                  }));
                  break;

                case "phase_change":
                  setState((prev) => ({
                    ...prev,
                    currentPhase: data.phase,
                  }));
                  break;

                case "awaiting_approval":
                  setState((prev) => ({
                    ...prev,
                    awaitingApproval: true,
                    isStreaming: false,
                  }));
                  break;

                case "error":
                  setState((prev) => ({
                    ...prev,
                    error: data.message,
                    isStreaming: false,
                  }));
                  break;

                case "end":
                  setState((prev) => ({
                    ...prev,
                    isStreaming: false,
                  }));
                  break;
              }
            } catch {
              // Skip malformed JSON
            }
            currentEvent = "";
          }
        }
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (message: string, threadId: string) => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setState((prev) => ({
        ...prev,
        isStreaming: true,
        error: null,
        messages: [
          ...prev.messages,
          {
            id: `msg-${++msgIdCounter.current}`,
            node: "user",
            content: message,
            timestamp: Date.now(),
          },
        ],
      }));

      try {
        const response = await fetch("/api/agent/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, threadId }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`Stream failed: ${response.statusText}`);
        }

        await processStream(response);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: error instanceof Error ? error.message : "Stream failed",
        }));
      }
    },
    [processStream]
  );

  const approve = useCallback(
    async (threadId: string, approved: boolean, feedback?: string) => {
      setState((prev) => ({
        ...prev,
        isStreaming: true,
        awaitingApproval: false,
        error: null,
      }));

      try {
        const response = await fetch("/api/agent/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId, approved, feedback }),
        });

        if (!response.ok) {
          throw new Error(`Approval failed: ${response.statusText}`);
        }

        await processStream(response);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: error instanceof Error ? error.message : "Approval failed",
        }));
      }
    },
    [processStream]
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({
      messages: [],
      currentPhase: "intake",
      isStreaming: false,
      awaitingApproval: false,
      error: null,
    });
  }, []);

  return { ...state, sendMessage, approve, reset };
}
