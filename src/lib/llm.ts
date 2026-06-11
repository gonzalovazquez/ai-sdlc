import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOllama } from "@langchain/ollama";

let _opus: ChatAnthropic | null = null;
let _sonnet: ChatAnthropic | null = null;
let _ollama: ChatOllama | null = null;
let _demoAnthropic: ChatAnthropic | null = null;

/**
 * Opus 4.6 — used for complex reasoning agents (Architect, Code).
 * Lazily initialized to avoid API key validation at build time.
 */
export function getOpusModel(): ChatAnthropic {
  if (!_opus) {
    _opus = new ChatAnthropic({
      model: "claude-opus-4-6",
      maxTokens: 8192,
      temperature: 0.3,
    });
  }
  return _opus;
}

/**
 * Sonnet 4.6 — used for routine agents (PM, QA, Monitor, Design, Infra, Release).
 * Lazily initialized to avoid API key validation at build time.
 */
export function getSonnetModel(): ChatAnthropic {
  if (!_sonnet) {
    _sonnet = new ChatAnthropic({
      model: "claude-sonnet-4-6",
      maxTokens: 4096,
      temperature: 0.2,
    });
  }
  return _sonnet;
}

/**
 * Qwen3.5 35B via local Ollama — used for all demo agents.
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

export type DemoProvider = "ollama" | "anthropic";

export function getDemoProvider(): DemoProvider {
  return process.env.LLM_PROVIDER === "anthropic" ? "anthropic" : "ollama";
}

/**
 * Model for the demo agents (PM, Architect, Code), selected by LLM_PROVIDER:
 * - "ollama" (default) — local inference, free but slow
 * - "anthropic" — hosted Claude, requires ANTHROPIC_API_KEY
 * Override the Anthropic model with ANTHROPIC_MODEL.
 */
export function getDemoModel(): ChatAnthropic | ChatOllama {
  if (getDemoProvider() === "anthropic") {
    if (!_demoAnthropic) {
      _demoAnthropic = new ChatAnthropic({
        model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
        maxTokens: 16384,
        // No temperature: sampling params are rejected on Opus 4.7+.
      });
    }
    return _demoAnthropic;
  }
  return getOllamaModel();
}
