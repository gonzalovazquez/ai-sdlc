import { resetLLMClients } from "./llm";

/**
 * Runtime environment overrides set from the UI (Environment Keys dialog).
 *
 * Values are written straight into process.env so SDKs that read it
 * implicitly (ChatAnthropic, Octokit) pick them up, and tracked on
 * globalThis so all route bundles in the Next.js dev server share the
 * same state. Overrides live in server memory only: they are lost on
 * restart and are never written to disk.
 */

export interface KnownEnvKey {
  key: string;
  label: string;
  hint: string;
}

export const KNOWN_ENV_KEYS: KnownEnvKey[] = [
  {
    key: "ANTHROPIC_API_KEY",
    label: "Anthropic API Key",
    hint: "Used by the agents when LLM Provider is Anthropic",
  },
  {
    key: "ANTHROPIC_MODEL",
    label: "Anthropic Model",
    hint: "Optional model override, e.g. claude-opus-4-8",
  },
  {
    key: "GITHUB_TOKEN",
    label: "GitHub Token",
    hint: "Lets the code agent push generated code",
  },
  {
    key: "GITHUB_OWNER",
    label: "GitHub Owner",
    hint: "Account or org the code agent pushes to",
  },
  {
    key: "GITHUB_REPO",
    label: "GitHub Repo",
    hint: "Repository the code agent pushes to",
  },
  {
    key: "OLLAMA_BASE_URL",
    label: "Ollama Base URL",
    hint: "Local inference endpoint (default http://localhost:11434)",
  },
  {
    key: "OLLAMA_MODEL",
    label: "Ollama Model",
    hint: "Optional local model override",
  },
];

const KEY_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

// Never allow the UI to override process-level configuration.
const BLOCKED_KEYS = new Set([
  "NODE_ENV",
  "NODE_OPTIONS",
  "PATH",
  "HOME",
  "PWD",
  "SHELL",
  "NEXT_RUNTIME",
  "DATABASE_URL", // read once at checkpointer startup; a runtime change would not apply
]);
const BLOCKED_PREFIXES = ["VERCEL", "AWS_", "LD_", "NEXT_PUBLIC_"];

interface RuntimeEnvState {
  overrides: Record<string, string>;
  /** process.env value before the first override, so Clear can restore it. */
  originals: Record<string, string | undefined>;
}

const globalState = globalThis as typeof globalThis & {
  __runtimeEnvState?: RuntimeEnvState;
};

function getState(): RuntimeEnvState {
  if (!globalState.__runtimeEnvState) {
    globalState.__runtimeEnvState = { overrides: {}, originals: {} };
  }
  return globalState.__runtimeEnvState;
}

export function isAllowedEnvKey(key: string): boolean {
  if (!KEY_PATTERN.test(key)) return false;
  if (BLOCKED_KEYS.has(key)) return false;
  return !BLOCKED_PREFIXES.some((p) => key.startsWith(p));
}

export function setRuntimeEnv(key: string, value: string): void {
  if (!isAllowedEnvKey(key)) {
    throw new Error(`"${key}" cannot be set at runtime`);
  }
  const state = getState();
  if (!(key in state.originals)) {
    state.originals[key] = process.env[key];
  }
  state.overrides[key] = value;
  process.env[key] = value;
  resetLLMClients();
}

export function clearRuntimeEnv(key: string): void {
  const state = getState();
  if (!(key in state.overrides)) return;
  const original = state.originals[key];
  if (original === undefined) delete process.env[key];
  else process.env[key] = original;
  delete state.overrides[key];
  delete state.originals[key];
  resetLLMClients();
}

function maskValue(value: string): string {
  return value.length > 8 ? `••••${value.slice(-4)}` : "••••";
}

export interface EnvKeyStatus extends KnownEnvKey {
  /** Where the current value comes from; null when unset. */
  source: "runtime" | "env" | null;
  /** Masked preview of the current value; null when unset. */
  preview: string | null;
  /** True for user-added keys outside the known list. */
  custom: boolean;
}

export function getEnvStatus(): EnvKeyStatus[] {
  const state = getState();
  const known = KNOWN_ENV_KEYS.map((meta): EnvKeyStatus => {
    const value = process.env[meta.key];
    return {
      ...meta,
      source:
        meta.key in state.overrides ? "runtime" : value ? "env" : null,
      preview: value ? maskValue(value) : null,
      custom: false,
    };
  });
  const customKeys = Object.keys(state.overrides)
    .filter((key) => !KNOWN_ENV_KEYS.some((meta) => meta.key === key))
    .sort()
    .map(
      (key): EnvKeyStatus => ({
        key,
        label: key,
        hint: "Custom key",
        source: "runtime",
        preview: maskValue(state.overrides[key]),
        custom: true,
      })
    );
  return [...known, ...customKeys];
}
