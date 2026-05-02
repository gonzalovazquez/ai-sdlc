import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for POST /api/agent/approve
 */

// Mock checkpointer
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

beforeEach(() => {
  vi.resetModules();
});

describe("POST /api/agent/approve", () => {
  it("should return 400 when threadId is missing", async () => {
    const { POST } = await import("@/app/api/agent/approve/route");

    const req = new Request("http://localhost:3000/api/agent/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: true }),
    });

    const response = await POST(req as never);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain("threadId");
  });

  it("should return 400 when approved is not boolean", async () => {
    const { POST } = await import("@/app/api/agent/approve/route");

    const req = new Request("http://localhost:3000/api/agent/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: "t1", approved: "yes" }),
    });

    const response = await POST(req as never);
    expect(response.status).toBe(400);
  });
});
