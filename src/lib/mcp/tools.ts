import { DynamicStructuredTool } from "@langchain/core/tools";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { z } from "zod";
import { logger } from "../logger";
import { getMCPClient } from "./client";
import { getMCPServersForAgent, type MCPServerConfig } from "./config";

const log = logger.child({ module: "mcp-tools" });

/**
 * Convert a JSON Schema property to a Zod schema.
 * Handles the common types returned by MCP tool schemas.
 */
function jsonSchemaPropertyToZod(prop: Record<string, unknown>): z.ZodTypeAny {
  const type = prop.type as string | undefined;
  const description = prop.description as string | undefined;

  let schema: z.ZodTypeAny;

  switch (type) {
    case "string":
      if (prop.enum) {
        const values = prop.enum as [string, ...string[]];
        schema = z.enum(values);
      } else {
        schema = z.string();
      }
      break;
    case "number":
    case "integer":
      schema = z.number();
      break;
    case "boolean":
      schema = z.boolean();
      break;
    case "array":
      schema = z.array(
        prop.items
          ? jsonSchemaPropertyToZod(prop.items as Record<string, unknown>)
          : z.unknown()
      );
      break;
    case "object":
      if (prop.properties) {
        schema = jsonSchemaToZodObject(prop as Record<string, unknown>);
      } else {
        schema = z.record(z.string(), z.unknown());
      }
      break;
    default:
      schema = z.unknown();
  }

  if (description) {
    schema = schema.describe(description);
  }

  return schema;
}

/**
 * Convert a JSON Schema object definition to a Zod object schema.
 */
function jsonSchemaToZodObject(
  schema: Record<string, unknown>
): z.ZodObject<z.ZodRawShape> {
  const properties = (schema.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const required = (schema.required ?? []) as string[];

  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(properties)) {
    let field = jsonSchemaPropertyToZod(prop);
    if (!required.includes(key)) {
      field = field.optional();
    }
    shape[key] = field;
  }

  return z.object(shape) as z.ZodObject<z.ZodRawShape>;
}

/**
 * Convert MCP tools from a single client into LangChain DynamicStructuredTools.
 */
async function mcpToolsFromClient(
  client: Client,
  serverName: string
): Promise<DynamicStructuredTool[]> {
  const { tools: mcpTools } = await client.listTools();

  log.info(
    { server: serverName, toolCount: mcpTools.length },
    "Discovered MCP tools"
  );

  return mcpTools.map((mcpTool) => {
    const zodSchema = mcpTool.inputSchema
      ? jsonSchemaToZodObject(mcpTool.inputSchema as Record<string, unknown>)
      : z.object({});

    return new DynamicStructuredTool({
      name: mcpTool.name,
      description: mcpTool.description ?? `Tool from ${serverName}`,
      schema: zodSchema,
      func: async (input) => {
        log.debug(
          { server: serverName, tool: mcpTool.name },
          "Calling MCP tool"
        );

        const result = await client.callTool({
          name: mcpTool.name,
          arguments: input,
        });

        if (result.isError) {
          const errText = Array.isArray(result.content)
            ? result.content
                .filter((c) => c.type === "text")
                .map((c) => (c as { text: string }).text)
                .join("\n")
            : String(result.content);
          log.warn(
            { server: serverName, tool: mcpTool.name, error: errText },
            "MCP tool returned error"
          );
          return `Error: ${errText}`;
        }

        if (Array.isArray(result.content)) {
          return result.content
            .filter((c) => c.type === "text")
            .map((c) => (c as { text: string }).text)
            .join("\n");
        }

        return String(result.content);
      },
    });
  });
}

/**
 * Get all LangChain tools for a given agent by connecting to its configured
 * MCP servers. Only connects to servers with valid auth tokens.
 *
 * Returns an empty array if no MCP servers are configured for the agent.
 */
export async function getToolsForAgent(
  agentName: string
): Promise<DynamicStructuredTool[]> {
  const servers = getMCPServersForAgent(agentName);

  if (servers.length === 0) {
    return [];
  }

  const allTools: DynamicStructuredTool[] = [];

  for (const server of servers) {
    try {
      const client = await getMCPClient(server);
      const tools = await mcpToolsFromClient(client, server.name);
      allTools.push(...tools);
    } catch (err) {
      log.warn(
        { server: server.name, err },
        "Failed to connect to MCP server — skipping"
      );
    }
  }

  log.info(
    { agent: agentName, totalTools: allTools.length },
    "Loaded MCP tools for agent"
  );

  return allTools;
}
