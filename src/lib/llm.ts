import { ChatOllama } from "@langchain/ollama";

let _ollama: ChatOllama | null = null;

export function getOllamaModel(): ChatOllama {
  if (!_ollama) {
    _ollama = new ChatOllama({
      model: process.env.OLLAMA_MODEL ?? "qwen3.5:35b",
      baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
      temperature: 0.2,
      numCtx: Number(process.env.OLLAMA_NUM_CTX ?? 16384),
    });
  }
  return _ollama;
}

export function resetLLMClients(): void {
  _ollama = null;
}

export type DemoProvider = "ollama" | "claude-code";

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
  return process.env.LLM_PROVIDER === "ollama" ? "ollama" : "claude-code";
}
