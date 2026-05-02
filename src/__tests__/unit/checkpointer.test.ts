import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the postgres module so we don't need a real DB
vi.mock("@langchain/langgraph-checkpoint-postgres", () => ({
  PostgresSaver: {
    fromConnString: vi.fn(() => ({
      setup: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

vi.mock("@langchain/langgraph", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@langchain/langgraph")>();
  return {
    ...actual,
  };
});

describe("getCheckpointer", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("should return MemorySaver when DATABASE_URL is not set", async () => {
    const { getCheckpointer } = await import("@/lib/graph/checkpointer");
    const saver = getCheckpointer();
    expect(saver).toBeDefined();
  });

  it("should return PostgresSaver when DATABASE_URL is set", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    const { getCheckpointer } = await import("@/lib/graph/checkpointer");
    const saver = getCheckpointer();
    expect(saver).toBeDefined();
    expect(saver).toHaveProperty("setup");
  });

  it("ensureCheckpointerReady should resolve without error", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    const { ensureCheckpointerReady } = await import(
      "@/lib/graph/checkpointer"
    );
    await expect(ensureCheckpointerReady()).resolves.toBeUndefined();
  });
});
