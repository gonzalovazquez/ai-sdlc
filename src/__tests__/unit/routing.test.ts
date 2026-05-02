import { describe, it, expect } from "vitest";
import { routeAfterArchitect, routeAfterQA } from "@/lib/graph/sdlc-graph";
import type { SDLCStateType } from "@/lib/graph/state";

/**
 * Helper to create a minimal state for routing tests.
 */
function makeState(overrides: Partial<SDLCStateType> = {}): SDLCStateType {
  return {
    messages: [],
    currentPhase: "architecture",
    projectConfig: {
      name: "Test",
      description: "Test project",
      platform: "ios",
      cloudProvider: "none",
      hasBackend: false,
      hasAuth: false,
      screenCount: 3,
      dataSources: [],
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

describe("routeAfterArchitect", () => {
  it("should route to design only for iOS without backend", () => {
    const state = makeState({
      projectConfig: {
        ...makeState().projectConfig,
        platform: "ios",
        hasBackend: false,
      },
    });
    const result = routeAfterArchitect(state);
    expect(result).toEqual(["design_agent"]);
  });

  it("should route to design + infra for iOS with backend", () => {
    const state = makeState({
      projectConfig: {
        ...makeState().projectConfig,
        platform: "ios",
        hasBackend: true,
      },
    });
    const result = routeAfterArchitect(state);
    expect(result).toEqual(["design_agent", "infra_agent"]);
  });

  it("should always route to design + infra for web platform", () => {
    const state = makeState({
      projectConfig: {
        ...makeState().projectConfig,
        platform: "web",
        hasBackend: false, // doesn't matter for web
      },
    });
    const result = routeAfterArchitect(state);
    expect(result).toEqual(["design_agent", "infra_agent"]);
  });

  it("should always route to design + infra for both platform", () => {
    const state = makeState({
      projectConfig: {
        ...makeState().projectConfig,
        platform: "both",
        hasBackend: false,
      },
    });
    const result = routeAfterArchitect(state);
    expect(result).toEqual(["design_agent", "infra_agent"]);
  });
});

describe("routeAfterQA", () => {
  it("should route to release_agent when QA approves", () => {
    const state = makeState({
      qaResults: {
        testsPassed: 10,
        testsFailed: 0,
        coverage: 85,
        issues: [],
        approved: true,
      },
    });
    expect(routeAfterQA(state)).toBe("release_agent");
  });

  it("should loop back to code_agent when QA rejects", () => {
    const state = makeState({
      qaResults: {
        testsPassed: 8,
        testsFailed: 2,
        coverage: 60,
        issues: ["Memory leak in ViewModel"],
        approved: false,
      },
    });
    expect(routeAfterQA(state)).toBe("code_agent");
  });

  it("should loop back to code_agent when qaResults is null", () => {
    const state = makeState({ qaResults: null });
    expect(routeAfterQA(state)).toBe("code_agent");
  });
});
