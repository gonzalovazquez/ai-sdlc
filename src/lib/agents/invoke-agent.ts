import { spawn } from "node:child_process";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { getDemoProvider, getOllamaModel } from "../llm";
import { getMCPServersForAgent, type MCPServerConfig } from "../mcp/config";
import { getToolsForAgent } from "../mcp/tools";
import { getLocalToolsForAgent } from "../local-tools";
import { invokeWithTools } from "./invoke-with-tools";
import { logger } from "../logger";

const log = logger.child({ module: "invoke-agent" });

export interface InvokeAgentParams {
  agentName: string;
  systemPrompt: string;
  messages: BaseMessage[];
  contextMessage?: string;
  model?: string;
  /** Working directory for Claude Code (used by code_agent) */
  cwd?: string;
}

function buildMCPConfig(configs: MCPServerConfig[]): string | null {
  if (configs.length === 0) return null;
  const mcpServers: Record<string, object> = {};
  for (const config of configs) {
    const token = config.authEnvVar ? process.env[config.authEnvVar] : undefined;
    const headers: Record<string, string> = {};
    if (token) {
      const headerName = config.authHeader ?? "Authorization";
      headers[headerName] = config.rawToken ? token : `Bearer ${token}`;
    }
    mcpServers[config.name] = {
      type: "sse",
      url: config.url,
      ...(Object.keys(headers).length > 0 && { headers }),
    };
  }
  return JSON.stringify({ mcpServers });
}

function buildPrompt(messages: BaseMessage[], contextMessage?: string): string {
  const parts: string[] = [];
  for (const msg of messages) {
    const content =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
    const type = msg._getType();
    if (type === "human") parts.push(`Human: ${content}`);
    else if (type === "ai") parts.push(`Assistant: ${content}`);
  }
  if (contextMessage) {
    parts.push(`Human: [Context]\n${contextMessage}`);
  }
  return parts.join("\n\n") || "Begin the task as instructed.";
}

async function invokeWithClaudeCode(params: InvokeAgentParams): Promise<AIMessage> {
  const { agentName, systemPrompt, messages, contextMessage, model = "claude-sonnet-4-6", cwd } = params;

  const mcpServers = getMCPServersForAgent(agentName);
  const mcpConfig = buildMCPConfig(mcpServers);
  const prompt = buildPrompt(messages, contextMessage);

  // Resolve the claude binary: prefer CLAUDE_BIN env override, then PATH
  const claudeBin = process.env.CLAUDE_BIN ?? "claude";

  // Pre-grant the tools the agent will need so no interactive prompt fires.
  // --allowed-tools works without the enterprise opt-in that
  // --dangerously-skip-permissions requires.
  const allowedTools = process.env.CLAUDE_ALLOWED_TOOLS ?? "Write Edit Bash";

  const args = [
    "--print",
    "--output-format", "json",
    "--model", model,
    "--system-prompt", systemPrompt,
    "--allowed-tools", allowedTools,
    "--dangerously-skip-permissions",
  ];

  if (mcpConfig) {
    args.push("--mcp-config", mcpConfig);
  }

  log.debug({ agentName, model, mcpCount: mcpServers.length }, "Spawning Claude Code subprocess");

  return new Promise<AIMessage>((resolve, reject) => {
    const proc = spawn(claudeBin, args, {
      cwd: cwd ?? process.cwd(),
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Send the prompt via stdin to avoid argument-length limits on large contexts
    proc.stdin.write(prompt, "utf8");
    proc.stdin.end();

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("close", (code) => {
      if (code !== 0 && !stdout) {
        log.error({ agentName, code, stderr: stderr.slice(0, 500) }, "Claude Code subprocess failed");
        return reject(new Error(`Claude Code subprocess exited with code ${code}: ${stderr.slice(0, 200)}`));
      }

      try {
        const result = JSON.parse(stdout.trim());
        const text: string = result.result ?? result.message ?? stdout;
        if (result.is_error) {
          log.warn({ agentName }, "Claude Code reported an error result");
        }
        resolve(new AIMessage({ content: text }));
      } catch {
        // JSON parse failed — use raw stdout (may happen with older CLI versions)
        resolve(new AIMessage({ content: stdout || `Agent ${agentName} produced no output.` }));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn Claude Code: ${err.message}`));
    });
  });
}

/**
 * Invoke an SDLC agent.
 *
 * Routes to Claude Code (default) or Ollama based on LLM_PROVIDER.
 * The Claude Code path uses ambient session credentials — no ANTHROPIC_API_KEY needed.
 */
export async function invokeAgent(params: InvokeAgentParams): Promise<AIMessage> {
  const { agentName, systemPrompt, messages, contextMessage } = params;
  const provider = getDemoProvider();

  log.debug({ agentName, provider }, "Invoking agent");

  if (provider === "ollama") {
    const mcpTools = await getToolsForAgent(agentName);
    const localTools = getLocalToolsForAgent(agentName);
    const allTools = [...mcpTools, ...localTools];
    const allMessages = [
      new SystemMessage(systemPrompt),
      ...messages,
      ...(contextMessage ? [new HumanMessage(`[Context]\n${contextMessage}`)] : []),
    ];
    return invokeWithTools(getOllamaModel(), allMessages, allTools);
  }

  return invokeWithClaudeCode(params);
}
