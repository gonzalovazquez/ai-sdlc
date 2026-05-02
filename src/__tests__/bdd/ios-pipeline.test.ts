import { describe, it, expect, vi, beforeEach } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import type { SDLCStateType } from "@/lib/graph/state";

/**
 * BDD-style tests for the iOS-only SDLC pipeline.
 *
 * These tests verify the full pipeline behaviour through the state machine
 * without calling the real Anthropic API. Each scenario describes a
 * user journey in Given/When/Then style.
 */

// Mock LLM to return controlled responses per agent
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

function makeInitialState(): SDLCStateType {
  return {
    messages: [new HumanMessage("Build me a todo app for iPhone")],
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

beforeEach(async () => {
  vi.resetModules();
  const llmModule = await import("@/lib/llm");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockInvoke = (llmModule as any).__mockInvoke;
  mockInvoke.mockReset();
});

describe("Feature: iOS App Development Pipeline", () => {
  describe("Scenario: Simple iOS app without backend", () => {
    it("Given a user describes a simple iOS todo app, When the PM agent processes the request, Then it should extract iOS platform with no backend", async () => {
      const { pmAgentNode } = await import("@/lib/agents/pm-agent");

      mockAgentResponse(`\`\`\`json
{
  "projectConfig": {
    "name": "TodoApp",
    "description": "Simple iPhone todo list",
    "platform": "ios",
    "cloudProvider": "none",
    "hasBackend": false,
    "hasAuth": false,
    "screenCount": 3,
    "dataSources": ["swiftdata"]
  }
}
\`\`\``);

      const state = makeInitialState();
      const result = await pmAgentNode(state);

      expect(result.projectConfig!.platform).toBe("ios");
      expect(result.projectConfig!.hasBackend).toBe(false);
      expect(result.projectConfig!.cloudProvider).toBe("none");
    });

    it("Given an iOS project without backend, When the architect completes, Then routing should skip infra and go to design only", async () => {
      const { routeAfterArchitect } = await import("@/lib/graph/sdlc-graph");

      const state: SDLCStateType = {
        ...makeInitialState(),
        projectConfig: {
          name: "TodoApp",
          description: "Simple todo",
          platform: "ios",
          cloudProvider: "none",
          hasBackend: false,
          hasAuth: false,
          screenCount: 3,
          dataSources: ["swiftdata"],
        },
      };

      const route = routeAfterArchitect(state);
      expect(route).toEqual(["design_agent"]);
      expect(route).not.toContain("infra_agent");
    });

    it("Given design is complete, When human review runs, Then it should pause for approval", async () => {
      const { humanReviewNode } = await import("@/lib/agents/human-review");

      const state: SDLCStateType = {
        ...makeInitialState(),
        architectureDecisions: {
          uiPattern: "mvvm",
          dataLayer: "swiftdata",
          navigation: "NavigationStack",
          packages: [],
          adrContent: "ADR",
        },
        designAssets: {
          screens: [{ name: "TaskList", stitchId: "", status: "draft" }],
          lottieFiles: [],
          designMdContent: "# Design",
        },
      };

      const result = await humanReviewNode(state);
      expect(result.awaitingApproval).toBe(true);
      expect(result.currentPhase).toBe("review");
    });

    it("Given QA passes all tests, When routing decision is made, Then it should proceed to release", async () => {
      const { routeAfterQA } = await import("@/lib/graph/sdlc-graph");

      const state: SDLCStateType = {
        ...makeInitialState(),
        qaResults: {
          testsPassed: 15,
          testsFailed: 0,
          coverage: 90,
          issues: [],
          approved: true,
        },
      };

      expect(routeAfterQA(state)).toBe("release_agent");
    });
  });

  describe("Scenario: QA rejection triggers code revision loop", () => {
    it("Given QA finds issues, When routing decision is made, Then it should loop back to code agent", async () => {
      const { routeAfterQA } = await import("@/lib/graph/sdlc-graph");

      const state: SDLCStateType = {
        ...makeInitialState(),
        qaResults: {
          testsPassed: 5,
          testsFailed: 3,
          coverage: 45,
          issues: [
            "Missing @MainActor annotation on ViewModel",
            "Force unwrap on line 42",
            "No error handling for network calls",
          ],
          approved: false,
        },
      };

      expect(routeAfterQA(state)).toBe("code_agent");
    });

    it("Given code agent fixes issues and QA re-approves, Then it should proceed to release", async () => {
      const { routeAfterQA } = await import("@/lib/graph/sdlc-graph");

      // After revision, QA approves
      const state: SDLCStateType = {
        ...makeInitialState(),
        qaResults: {
          testsPassed: 8,
          testsFailed: 0,
          coverage: 78,
          issues: [],
          approved: true,
        },
      };

      expect(routeAfterQA(state)).toBe("release_agent");
    });
  });
});

describe("Feature: iOS App with Backend", () => {
  describe("Scenario: iOS app with AWS backend", () => {
    it("Given an iOS project with backend, When architect completes, Then routing should fork to both design and infra", async () => {
      const { routeAfterArchitect } = await import("@/lib/graph/sdlc-graph");

      const state: SDLCStateType = {
        ...makeInitialState(),
        projectConfig: {
          name: "SocialApp",
          description: "Social app with API",
          platform: "ios",
          cloudProvider: "aws",
          hasBackend: true,
          hasAuth: true,
          screenCount: 8,
          dataSources: ["rest", "s3"],
        },
      };

      const route = routeAfterArchitect(state);
      expect(route).toEqual(["design_agent", "infra_agent"]);
    });

    it("Given a complex iOS project, When architect decides, Then it should choose TCA pattern", async () => {
      const { architectAgentNode } = await import(
        "@/lib/agents/architect-agent"
      );

      mockAgentResponse(`\`\`\`json
{
  "architectureDecisions": {
    "uiPattern": "tca",
    "dataLayer": "rest",
    "navigation": "NavigationStack with coordinator pattern",
    "packages": ["swift-composable-architecture", "swift-dependencies", "alamofire"],
    "adrContent": "# ADR: TCA for complex state management"
  }
}
\`\`\``);

      const state: SDLCStateType = {
        ...makeInitialState(),
        projectConfig: {
          name: "SocialApp",
          description: "Complex social app",
          platform: "ios",
          cloudProvider: "aws",
          hasBackend: true,
          hasAuth: true,
          screenCount: 12,
          dataSources: ["rest", "s3", "dynamodb"],
        },
      };

      const result = await architectAgentNode(state);
      expect(result.architectureDecisions!.uiPattern).toBe("tca");
      expect(result.architectureDecisions!.dataLayer).toBe("rest");
    });
  });
});
