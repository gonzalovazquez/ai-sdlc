import { describe, it, expect } from "vitest";
import type {
  ProjectConfig,
  ArchitectureDecisions,
  DesignAssets,
  CodeArtifacts,
  InfraState,
  QAResults,
  SDLCStateType,
} from "@/lib/graph/state";

/**
 * Unit tests for the SDLC state schema types and default shapes.
 *
 * Note: Annotation.Root produces opaque internals, so we test types
 * and structure via TypeScript satisfaction and constructed instances.
 */

function makeDefaultState(): SDLCStateType {
  return {
    messages: [],
    currentPhase: "intake",
    projectConfig: {
      name: "",
      description: "",
      platform: "ios",
      cloudProvider: "none",
      hasBackend: false,
      hasAuth: false,
      screenCount: 0,
      dataSources: [],
    },
    architectureDecisions: null,
    designAssets: null,
    codeArtifacts: null,
    infraState: null,
    qaResults: null,
    awaitingApproval: false,
  };
}

describe("SDLCState schema", () => {
  describe("default state shape", () => {
    it("should have all required fields with correct defaults", () => {
      const state = makeDefaultState();
      expect(state.messages).toEqual([]);
      expect(state.currentPhase).toBe("intake");
      expect(state.projectConfig.platform).toBe("ios");
      expect(state.projectConfig.cloudProvider).toBe("none");
      expect(state.projectConfig.hasBackend).toBe(false);
      expect(state.architectureDecisions).toBeNull();
      expect(state.designAssets).toBeNull();
      expect(state.codeArtifacts).toBeNull();
      expect(state.infraState).toBeNull();
      expect(state.qaResults).toBeNull();
      expect(state.awaitingApproval).toBe(false);
    });
  });

  describe("ProjectConfig", () => {
    it("should accept all valid platform values", () => {
      const platforms: Array<ProjectConfig["platform"]> = [
        "ios",
        "web",
        "both",
      ];
      for (const p of platforms) {
        const config: ProjectConfig = {
          ...makeDefaultState().projectConfig,
          platform: p,
        };
        expect(config.platform).toBe(p);
      }
    });

    it("should accept all valid cloudProvider values", () => {
      const providers: Array<ProjectConfig["cloudProvider"]> = [
        "aws",
        "azure",
        "gcp",
        "vercel-supabase",
        "none",
      ];
      for (const p of providers) {
        const config: ProjectConfig = {
          ...makeDefaultState().projectConfig,
          cloudProvider: p,
        };
        expect(config.cloudProvider).toBe(p);
      }
    });
  });

  describe("ArchitectureDecisions", () => {
    it("should accept valid uiPattern values", () => {
      const patterns: ArchitectureDecisions["uiPattern"][] = [
        "mvvm",
        "tca",
        "component-based",
      ];
      for (const p of patterns) {
        const decisions: ArchitectureDecisions = {
          uiPattern: p,
          dataLayer: "swiftdata",
          navigation: "NavigationStack",
          packages: [],
          adrContent: "",
        };
        expect(decisions.uiPattern).toBe(p);
      }
    });

    it("should accept valid dataLayer values", () => {
      const layers: ArchitectureDecisions["dataLayer"][] = [
        "swiftdata",
        "rest",
        "graphql",
        "supabase",
        "none",
      ];
      for (const l of layers) {
        const decisions: ArchitectureDecisions = {
          uiPattern: "mvvm",
          dataLayer: l,
          navigation: "",
          packages: [],
          adrContent: "",
        };
        expect(decisions.dataLayer).toBe(l);
      }
    });
  });

  describe("DesignAssets", () => {
    it("should support screens with status tracking", () => {
      const assets: DesignAssets = {
        screens: [
          { name: "Home", stitchId: "s1", status: "draft" },
          { name: "Settings", stitchId: "s2", status: "approved" },
        ],
        lottieFiles: [],
        designMdContent: "",
      };
      expect(assets.screens).toHaveLength(2);
      expect(assets.screens[1].status).toBe("approved");
    });
  });

  describe("CodeArtifacts", () => {
    it("should support nullable prUrl", () => {
      const artifacts: CodeArtifacts = {
        files: [{ path: "src/main.swift", content: "import Foundation" }],
        prUrl: null,
        branch: "feat/init",
      };
      expect(artifacts.prUrl).toBeNull();

      const withPr: CodeArtifacts = {
        ...artifacts,
        prUrl: "https://github.com/org/repo/pull/1",
      };
      expect(withPr.prUrl).toBeTruthy();
    });
  });

  describe("InfraState", () => {
    it("should track deployment status", () => {
      const infra: InfraState = {
        provider: "aws",
        stackName: "prod",
        endpoints: { api: "https://api.example.com" },
        status: "deployed",
      };
      expect(infra.status).toBe("deployed");
    });
  });

  describe("QAResults", () => {
    it("should calculate pass rate", () => {
      const qa: QAResults = {
        testsPassed: 8,
        testsFailed: 2,
        coverage: 75,
        issues: ["Missing edge case"],
        approved: false,
      };
      const passRate =
        qa.testsPassed / (qa.testsPassed + qa.testsFailed);
      expect(passRate).toBe(0.8);
    });

    it("should approve when all tests pass", () => {
      const qa: QAResults = {
        testsPassed: 10,
        testsFailed: 0,
        coverage: 90,
        issues: [],
        approved: true,
      };
      expect(qa.approved).toBe(true);
      expect(qa.issues).toHaveLength(0);
    });
  });
});
