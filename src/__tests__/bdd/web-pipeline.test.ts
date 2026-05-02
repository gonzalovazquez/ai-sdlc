import { describe, it, expect, vi, beforeEach } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import type { SDLCStateType } from "@/lib/graph/state";

/**
 * BDD-style tests for the Web / Full-stack SDLC pipeline.
 *
 * Scenarios cover:
 * - Web app with Vercel + Supabase
 * - Platform "both" (iOS + Web) shared backend
 * - Infra agent always included for web
 */

vi.mock("@/lib/llm", () => {
  const mockInvoke = vi.fn();
  return {
    getSonnetModel: () => ({ invoke: mockInvoke }),
    getOpusModel: () => ({ invoke: mockInvoke }),
    __mockInvoke: mockInvoke,
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockInvoke: any;

function mockAgentResponse(content: string) {
  mockInvoke.mockResolvedValueOnce({ content });
}

function makeWebState(
  overrides: Partial<SDLCStateType> = {}
): SDLCStateType {
  return {
    messages: [new HumanMessage("Build me a SaaS dashboard")],
    currentPhase: "intake",
    projectConfig: {
      name: "Dashboard",
      description: "SaaS analytics dashboard",
      platform: "web",
      cloudProvider: "vercel-supabase",
      hasBackend: true,
      hasAuth: true,
      screenCount: 6,
      dataSources: ["supabase"],
    },
    architectureDecisions: null,
    designAssets: null,
    codeArtifacts: null,
    infraState: null,
    qaResults: null,
    awaitingApproval: false,
    ...overrides,
  };
}

beforeEach(async () => {
  vi.resetModules();
  const llmModule = await import("@/lib/llm");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockInvoke = (llmModule as any).__mockInvoke;
  mockInvoke.mockReset();
});

describe("Feature: Web App Development Pipeline", () => {
  describe("Scenario: SaaS dashboard with Vercel + Supabase", () => {
    it("Given a web project, When architect completes, Then routing always forks to design + infra", async () => {
      const { routeAfterArchitect } = await import("@/lib/graph/sdlc-graph");
      const state = makeWebState();
      const route = routeAfterArchitect(state);
      expect(route).toEqual(["design_agent", "infra_agent"]);
    });

    it("Given a web project, When architect decides, Then it should choose component-based pattern with Supabase", async () => {
      const { architectAgentNode } = await import(
        "@/lib/agents/architect-agent"
      );

      mockAgentResponse(`\`\`\`json
{
  "architectureDecisions": {
    "uiPattern": "component-based",
    "dataLayer": "supabase",
    "navigation": "Next.js App Router with parallel routes",
    "packages": ["@supabase/ssr", "drizzle-orm", "zustand", "recharts"],
    "adrContent": "# ADR: Next.js App Router with Supabase"
  }
}
\`\`\``);

      const state = makeWebState();
      const result = await architectAgentNode(state);

      expect(result.architectureDecisions!.uiPattern).toBe("component-based");
      expect(result.architectureDecisions!.dataLayer).toBe("supabase");
      expect(result.architectureDecisions!.packages).toContain("@supabase/ssr");
    });

    it("Given infra agent runs for web, Then it should provision Supabase resources", async () => {
      const { infraAgentNode } = await import("@/lib/agents/infra-agent");

      mockAgentResponse(`\`\`\`json
{
  "infraState": {
    "provider": "vercel-supabase",
    "stackName": "dashboard-dev",
    "endpoints": {
      "web": "https://dashboard.vercel.app",
      "api": "https://dashboard.supabase.co",
      "auth": "https://dashboard.supabase.co/auth/v1"
    },
    "status": "provisioned"
  }
}
\`\`\``);

      const state = makeWebState();
      const result = await infraAgentNode(state);

      expect(result.infraState!.provider).toBe("vercel-supabase");
      expect(result.infraState!.endpoints).toHaveProperty("auth");
      expect(result.infraState!.status).toBe("provisioned");
    });

    it("Given both design and infra complete, When human review runs, Then summary includes all three sections", async () => {
      const { humanReviewNode } = await import("@/lib/agents/human-review");

      const state = makeWebState({
        architectureDecisions: {
          uiPattern: "component-based",
          dataLayer: "supabase",
          navigation: "App Router",
          packages: ["@supabase/ssr"],
          adrContent: "ADR",
        },
        designAssets: {
          screens: [
            { name: "Dashboard", stitchId: "", status: "draft" },
            { name: "Analytics", stitchId: "", status: "draft" },
            { name: "Settings", stitchId: "", status: "draft" },
          ],
          lottieFiles: [],
          designMdContent: "# Design",
        },
        infraState: {
          provider: "vercel-supabase",
          stackName: "dev",
          endpoints: { web: "https://app.vercel.app" },
          status: "provisioned",
        },
      });

      const result = await humanReviewNode(state);
      const content = (result.messages![0] as { content: string }).content;

      expect(content).toContain("component-based");
      expect(content).toContain("3 screens");
      expect(content).toContain("vercel-supabase");
    });
  });
});

describe("Feature: Cross-platform (iOS + Web) Pipeline", () => {
  describe("Scenario: Both platform always routes to infra", () => {
    it("Given platform is 'both', When architect completes, Then routing forks to design + infra regardless of hasBackend", async () => {
      const { routeAfterArchitect } = await import("@/lib/graph/sdlc-graph");

      // Even with hasBackend: false, "both" platform needs infra
      const state = makeWebState({
        projectConfig: {
          name: "CrossApp",
          description: "Cross-platform app",
          platform: "both",
          cloudProvider: "vercel-supabase",
          hasBackend: false,
          hasAuth: false,
          screenCount: 4,
          dataSources: [],
        },
      });

      const route = routeAfterArchitect(state);
      expect(route).toContain("infra_agent");
      expect(route).toContain("design_agent");
    });
  });
});

describe("Feature: Phase Progression", () => {
  describe("Scenario: Full web pipeline phase sequence", () => {
    it("PM sets phase to requirements", async () => {
      const { pmAgentNode } = await import("@/lib/agents/pm-agent");
      mockAgentResponse("Gathering requirements...");
      const result = await pmAgentNode(makeWebState());
      expect(result.currentPhase).toBe("requirements");
    });

    it("Architect sets phase to architecture", async () => {
      const { architectAgentNode } = await import(
        "@/lib/agents/architect-agent"
      );
      mockAgentResponse("Architecture plan...");
      const result = await architectAgentNode(makeWebState());
      expect(result.currentPhase).toBe("architecture");
    });

    it("Design sets phase to design", async () => {
      const { designAgentNode } = await import("@/lib/agents/design-agent");
      mockAgentResponse("Design assets...");
      const result = await designAgentNode(makeWebState());
      expect(result.currentPhase).toBe("design");
    });

    it("Infra sets phase to infrastructure", async () => {
      const { infraAgentNode } = await import("@/lib/agents/infra-agent");
      mockAgentResponse("Infra setup...");
      const result = await infraAgentNode(makeWebState());
      expect(result.currentPhase).toBe("infrastructure");
    });

    it("Human review sets phase to review", async () => {
      const { humanReviewNode } = await import("@/lib/agents/human-review");
      const result = await humanReviewNode(makeWebState());
      expect(result.currentPhase).toBe("review");
    });

    it("Code sets phase to implementation", async () => {
      const { codeAgentNode } = await import("@/lib/agents/code-agent");
      mockAgentResponse("Code generated...");
      const result = await codeAgentNode(makeWebState());
      expect(result.currentPhase).toBe("implementation");
    });

    it("QA sets phase to testing", async () => {
      const { qaAgentNode } = await import("@/lib/agents/qa-agent");
      mockAgentResponse("Tests ran...");
      const result = await qaAgentNode(makeWebState());
      expect(result.currentPhase).toBe("qa");
    });

    it("Release sets phase to release", async () => {
      const { releaseAgentNode } = await import("@/lib/agents/release-agent");
      mockAgentResponse("Release ready...");
      const result = await releaseAgentNode(makeWebState());
      expect(result.currentPhase).toBe("release");
    });

    it("Monitor sets phase to monitoring", async () => {
      const { monitorAgentNode } = await import(
        "@/lib/agents/monitor-agent"
      );
      mockAgentResponse("Monitoring setup...");
      const result = await monitorAgentNode(makeWebState());
      expect(result.currentPhase).toBe("monitoring");
    });
  });
});
