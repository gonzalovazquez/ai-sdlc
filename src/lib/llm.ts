import { ChatAnthropic } from "@langchain/anthropic";

let _opus: ChatAnthropic | null = null;
let _sonnet: ChatAnthropic | null = null;

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
