import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for POST /api/agent/stream
 *
 * These test the API route handler directly (without a running server),
 * mocking the LLM and checkpointer layers.
 */

// Mock checkpointer — no real Postgres
vi.mock("@/lib/graph/checkpointer", () => {
  const { MemorySaver } = require("@langchain/langgraph");
  const memSaver = new MemorySaver();
  return {
    getCheckpointer: () => memSaver,
    ensureCheckpointerReady: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock LLM
vi.mock("@/lib/llm", () => {
  const mockInvoke = vi.fn();
  return {
    getSonnetModel: () => ({ invoke: mockInvoke }),
    getOpusModel: () => ({ invoke: mockInvoke }),
    __mockInvoke: mockInvoke,
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockInvoke: any;

beforeEach(async () => {
  vi.resetModules();
  const llmModule = await import("@/lib/llm");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockInvoke = (llmModule as any).__mockInvoke;
  mockInvoke.mockReset();
});

describe("POST /api/agent/stream", () => {
  it("should return 400 when message is missing", async () => {
    const { POST } = await import("@/app/api/agent/stream/route");

    const req = new Request("http://localhost:3000/api/agent/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: "t1" }),
    });

    // NextRequest wraps Request
    const response = await POST(req as never);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain("message");
  });

  it("should return 400 when threadId is missing", async () => {
    const { POST } = await import("@/app/api/agent/stream/route");

    const req = new Request("http://localhost:3000/api/agent/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });

    const response = await POST(req as never);
    expect(response.status).toBe(400);
  });

  it("should return SSE stream with correct content-type", async () => {
    const { POST } = await import("@/app/api/agent/stream/route");

    // Mock PM agent response (first node in the graph)
    mockInvoke.mockResolvedValue({
      content: `\`\`\`json
{"projectConfig":{"name":"Test","description":"test","platform":"ios","cloudProvider":"none","hasBackend":false,"hasAuth":false,"screenCount":1,"dataSources":[]}}
\`\`\``,
    });

    const req = new Request("http://localhost:3000/api/agent/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Build a test app",
        threadId: "test-thread-1",
      }),
    });

    const response = await POST(req as never);

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
  });
});
