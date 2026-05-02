import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { logger } from "../logger";
import type { MCPServerConfig } from "./config";

const log = logger.child({ module: "mcp-client" });

const clientCache = new Map<string, Client>();

/**
 * Build auth headers for a given MCP server config.
 */
function getAuthHeaders(server: MCPServerConfig): Record<string, string> {
  const headers: Record<string, string> = {};
  if (server.authEnvVar) {
    const token = process.env[server.authEnvVar];
    if (token) {
      const headerName = server.authHeader ?? "Authorization";
      headers[headerName] = server.rawToken ? token : `Bearer ${token}`;
    }
  }
  return headers;
}

/**
 * Try connecting with the Streamable HTTP transport (preferred by newer MCP servers).
 */
async function connectStreamableHTTP(
  url: string,
  headers: Record<string, string>
): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers },
  });
  const client = new Client({ name: "sdlc-ai", version: "0.1.0" });
  await client.connect(transport);
  return client;
}

/**
 * Try connecting with the legacy SSE transport (for older MCP servers).
 */
async function connectSSE(
  url: string,
  headers: Record<string, string>
): Promise<Client> {
  const transport = new SSEClientTransport(new URL(url), {
    eventSourceInit: {
      fetch: (fetchUrl, init) =>
        fetch(fetchUrl, {
          ...init,
          headers: { ...(init?.headers as Record<string, string>), ...headers },
        }),
    },
    requestInit: { headers },
  });
  const client = new Client({ name: "sdlc-ai", version: "0.1.0" });
  await client.connect(transport);
  return client;
}

/**
 * Get or create an MCP client for the given server config.
 * Tries Streamable HTTP first, falls back to SSE.
 * Clients are cached by server URL so connections are reused across invocations.
 */
export async function getMCPClient(server: MCPServerConfig): Promise<Client> {
  const cacheKey = server.url;

  const cached = clientCache.get(cacheKey);
  if (cached) return cached;

  const headers = getAuthHeaders(server);

  log.info({ server: server.name, url: server.url }, "Connecting to MCP server");

  let client: Client;

  try {
    client = await connectStreamableHTTP(server.url, headers);
    log.info({ server: server.name, transport: "streamable-http" }, "Connected to MCP server");
  } catch (err) {
    log.debug(
      { server: server.name, err: err instanceof Error ? err.message : err },
      "Streamable HTTP failed, trying SSE"
    );
    client = await connectSSE(server.url, headers);
    log.info({ server: server.name, transport: "sse" }, "Connected to MCP server");
  }

  clientCache.set(cacheKey, client);
  return client;
}

/**
 * Close all cached MCP client connections.
 */
export async function closeAllMCPClients(): Promise<void> {
  for (const [url, client] of clientCache) {
    try {
      await client.close();
      log.debug({ url }, "Closed MCP client");
    } catch {
      // Ignore close errors
    }
  }
  clientCache.clear();
}
