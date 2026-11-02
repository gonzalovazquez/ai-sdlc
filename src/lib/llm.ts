import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOllama } from "@langchain/ollama";

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

const _anthropic = new Map<string, ChatAnthropic>();
let _ollama: ChatOllama | null = null;

/**
 * Qwen3.5 35B via local Ollama.
 * Requires Ollama running at OLLAMA_BASE_URL (default: http://localhost:11434).
 * Override model with OLLAMA_MODEL env var.
 */
export function getOllamaModel(): ChatOllama {
  if (!_ollama) {
    _ollama = new ChatOllama({
      model: process.env.OLLAMA_MODEL ?? "qwen3.5:35b",
      baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
      temperature: 0.2,
      // Ollama's server default context is 4096 tokens, which truncates the
      // code agent's multi-file output mid-response. Raise it explicitly.
      numCtx: Number(process.env.OLLAMA_NUM_CTX ?? 16384),
    });
  }
  return _ollama;
}

/**
 * Drop cached clients so the next call re-reads process.env. Called when
 * runtime env keys change (e.g. the user sets ANTHROPIC_API_KEY in the UI).
 */
export function resetLLMClients(): void {
  _anthropic.clear();
  _ollama = null;
}

export type DemoProvider = "ollama" | "anthropic";

// Runtime override set from the UI. Kept on globalThis so all route bundles
// in the Next.js dev server see the same value.
const globalState = globalThis as typeof globalThis & {
  __demoProviderOverride?: DemoProvider;
};

export function setDemoProvider(provider: DemoProvider): void {
  globalState.__demoProviderOverride = provider;
}

export function getDemoProvider(): DemoProvider {
  if (globalState.__demoProviderOverride) {
    return globalState.__demoProviderOverride;
  }
  return process.env.LLM_PROVIDER === "ollama" ? "ollama" : "anthropic";
}

/**
 * Chat model for an agent, selected by LLM_PROVIDER:
 * - "anthropic" (default) — Claude API, requires ANTHROPIC_API_KEY. Uses the
 *   agent's requested model unless ANTHROPIC_MODEL overrides it for all agents.
 * - "ollama" — local inference; the requested model is ignored.
 */
export function getDemoModel(model?: string): ChatAnthropic | ChatOllama {
  if (getDemoProvider() === "ollama") return getOllamaModel();

  const id = process.env.ANTHROPIC_MODEL ?? model ?? DEFAULT_ANTHROPIC_MODEL;
  let client = _anthropic.get(id);
  if (!client) {
    // No temperature: sampling params are rejected on newer Opus models.
    client = new ChatAnthropic({ model: id, maxTokens: 16384 });
    _anthropic.set(id, client);
  }
  return client;
}
