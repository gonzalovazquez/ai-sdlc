import { describe, it, expect } from "vitest";
import {
  MCP_SERVERS,
  getMCPServersForAgent,
  getAllMCPServersForAgent,
} from "@/lib/mcp/config";

describe("MCP Server Configuration", () => {
  it("should define all 5 MCP servers", () => {
    expect(Object.keys(MCP_SERVERS)).toEqual([
      "stitch",
      "linear",
      "pulumi",
      "notion",
      "supabase",
    ]);
  });

  it("each server should have required fields", () => {
    for (const [key, server] of Object.entries(MCP_SERVERS)) {
      expect(server.name, `${key}.name`).toBeTruthy();
      expect(server.url, `${key}.url`).toBeTruthy();
      expect(server.description, `${key}.description`).toBeTruthy();
      expect(server.usedBy.length, `${key}.usedBy`).toBeGreaterThan(0);
      expect(server.authEnvVar, `${key}.authEnvVar`).toBeTruthy();
    }
  });

  describe("getAllMCPServersForAgent", () => {
    it("should return Stitch for design_agent", () => {
      const servers = getAllMCPServersForAgent("design_agent");
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe("Google Stitch");
    });

    it("should return Linear + Notion for pm_agent", () => {
      const servers = getAllMCPServersForAgent("pm_agent");
      const names = servers.map((s) => s.name).sort();
      expect(names).toEqual(["Linear", "Notion"]);
    });

    it("should return Pulumi + Supabase for infra_agent", () => {
      const servers = getAllMCPServersForAgent("infra_agent");
      const names = servers.map((s) => s.name).sort();
      expect(names).toContain("Pulumi Neo");
      expect(names).toContain("Supabase");
    });

    it("should return Supabase for code_agent", () => {
      const servers = getAllMCPServersForAgent("code_agent");
      const names = servers.map((s) => s.name);
      expect(names).toContain("Supabase");
    });

    it("should return empty for unknown agent", () => {
      const servers = getAllMCPServersForAgent("nonexistent_agent");
      expect(servers).toHaveLength(0);
    });
  });

  describe("getMCPServersForAgent", () => {
    it("should return empty when no auth tokens are configured", () => {
      const servers = getMCPServersForAgent("design_agent");
      expect(servers).toHaveLength(0);
    });

    it("should return empty for unknown agent", () => {
      const servers = getMCPServersForAgent("nonexistent_agent");
      expect(servers).toHaveLength(0);
    });
  });
});
