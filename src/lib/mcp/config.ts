/**
 * MCP Server configuration — maps agent names to the MCP servers they use.
 * Each server is connected at runtime via SSE transport with optional auth.
 */
export interface MCPServerConfig {
  name: string;
  url: string;
  description: string;
  usedBy: string[];
  /** Environment variable name that holds the auth token for this server. */
  authEnvVar: string | null;
  /** Custom header name for authentication. Defaults to "Authorization" with "Bearer " prefix. */
  authHeader?: string;
  /** When true, send the token value directly without "Bearer " prefix. */
  rawToken?: boolean;
}

export const MCP_SERVERS: Record<string, MCPServerConfig> = {
  stitch: {
    name: "Google Stitch",
    url: process.env.MCP_STITCH_URL || "https://stitch.googleapis.com/mcp",
    description: "UI design generation and DESIGN.md export",
    usedBy: ["design_agent"],
    authEnvVar: "GOOGLE_STITCH_API_KEY",
    authHeader: "X-Goog-Api-Key",
    rawToken: true,
  },
  linear: {
    name: "Linear",
    url: process.env.MCP_LINEAR_URL || "https://mcp.linear.app/mcp",
    description: "Create and manage project tickets",
    usedBy: ["pm_agent", "monitor_agent"],
    authEnvVar: "LINEAR_API_KEY",
  },
  pulumi: {
    name: "Pulumi Neo",
    url: process.env.MCP_PULUMI_URL || "https://mcp.pulumi.com",
    description: "Infrastructure as Code generation and deployment",
    usedBy: ["infra_agent"],
    authEnvVar: "PULUMI_ACCESS_TOKEN",
  },
  notion: {
    name: "Notion",
    url: process.env.MCP_NOTION_URL || "https://mcp.notion.com/mcp",
    description: "Knowledge base, ADRs, and documentation",
    usedBy: ["architect_agent", "pm_agent"],
    authEnvVar: "NOTION_API_KEY",
  },
  supabase: {
    name: "Supabase",
    url: process.env.MCP_SUPABASE_URL || "https://mcp.supabase.com/mcp",
    description: "Database schema, auth, and edge functions",
    usedBy: ["infra_agent", "code_agent"],
    authEnvVar: "SUPABASE_ACCESS_TOKEN",
  },
};

/**
 * Get the MCP servers relevant to a specific agent node.
 * Only returns servers whose auth token is configured in the environment.
 */
export function getMCPServersForAgent(agentName: string): MCPServerConfig[] {
  return Object.values(MCP_SERVERS).filter(
    (server) =>
      server.usedBy.includes(agentName) &&
      (!server.authEnvVar || process.env[server.authEnvVar])
  );
}

/**
 * Get ALL MCP servers for an agent, regardless of whether auth is configured.
 * Useful for tests and configuration validation.
 */
export function getAllMCPServersForAgent(agentName: string): MCPServerConfig[] {
  return Object.values(MCP_SERVERS).filter((server) =>
    server.usedBy.includes(agentName)
  );
}
