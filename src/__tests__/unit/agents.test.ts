import { describe, it, expect, vi, beforeEach } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import type { SDLCStateType } from "@/lib/graph/state";

// ---------------------------------------------------------------------------
// Mock the LLM module so we never call the real Anthropic API
// ---------------------------------------------------------------------------
vi.mock("@/lib/llm", () => {
  const mockInvoke = vi.fn();
  const mockModel = {
    invoke: mockInvoke,
    bindTools: () => ({ invoke: mockInvoke }),
  };
  return {
    getSonnetModel: () => mockModel,
    getOpusModel: () => mockModel,
    getOllamaModel: () => mockModel,
    getDemoModel: () => mockModel,
    __mockInvoke: mockInvoke,
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockInvoke: any;

beforeEach(async () => {
  const llmModule = await import("@/lib/llm");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockInvoke = (llmModule as any).__mockInvoke;
  mockInvoke.mockReset();
});

function makeBaseState(overrides: Partial<SDLCStateType> = {}): SDLCStateType {
  return {
    messages: [new HumanMessage("Build me a todo app for iOS")],
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PM Agent
// ---------------------------------------------------------------------------
describe("pmAgentNode", () => {
  it("should extract projectConfig from LLM JSON response", async () => {
    const { pmAgentNode } = await import("@/lib/agents/pm-agent");

    mockInvoke.mockResolvedValueOnce({
      content: `Here's the project config:
\`\`\`json
{
  "projectConfig": {
    "name": "TodoApp",
    "description": "A simple todo app",
    "platform": "ios",
    "cloudProvider": "none",
    "hasBackend": false,
    "hasAuth": false,
    "screenCount": 3,
    "dataSources": ["swiftdata"]
  },
  "requirements": "- Create task\\n- Delete task\\n- Mark complete"
}
\`\`\``,
    });

    const state = makeBaseState();
    const result = await pmAgentNode(state);

    expect(result.projectConfig).toBeDefined();
    expect(result.projectConfig!.name).toBe("TodoApp");
    expect(result.projectConfig!.platform).toBe("ios");
    expect(result.projectConfig!.screenCount).toBe(3);
    expect(result.currentPhase).toBe("requirements");
    expect(result.messages).toHaveLength(1);
  });

  it("should keep existing config when LLM response has no JSON", async () => {
    const { pmAgentNode } = await import("@/lib/agents/pm-agent");

    mockInvoke.mockResolvedValueOnce({
      content: "Can you tell me more about what features you want?",
    });

    const state = makeBaseState();
    const result = await pmAgentNode(state);

    expect(result.projectConfig).toEqual(state.projectConfig);
    expect(result.messages).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Architect Agent
// ---------------------------------------------------------------------------
describe("architectAgentNode", () => {
  it("should extract architectureDecisions from LLM response", async () => {
    const { architectAgentNode } = await import(
      "@/lib/agents/architect-agent"
    );

    mockInvoke.mockResolvedValueOnce({
      content: `Based on the project requirements:
\`\`\`json
{
  "architectureDecisions": {
    "uiPattern": "mvvm",
    "dataLayer": "swiftdata",
    "navigation": "NavigationStack with path-based routing",
    "packages": ["swift-dependencies", "swift-navigation"],
    "adrContent": "# ADR: MVVM with SwiftData"
  }
}
\`\`\``,
    });

    const state = makeBaseState({
      projectConfig: {
        ...makeBaseState().projectConfig,
        name: "TodoApp",
        platform: "ios",
        screenCount: 3,
      },
    });

    const result = await architectAgentNode(state);

    expect(result.architectureDecisions).toBeDefined();
    expect(result.architectureDecisions!.uiPattern).toBe("mvvm");
    expect(result.architectureDecisions!.dataLayer).toBe("swiftdata");
    expect(result.currentPhase).toBe("architecture");
  });
});

// ---------------------------------------------------------------------------
// Design Agent
// ---------------------------------------------------------------------------
describe("designAgentNode", () => {
  it("should extract designAssets from LLM response", async () => {
    const { designAgentNode } = await import("@/lib/agents/design-agent");

    mockInvoke.mockResolvedValueOnce({
      content: `\`\`\`json
{
  "designAssets": {
    "screens": [
      { "name": "TaskList", "stitchId": "s001", "status": "draft" },
      { "name": "TaskDetail", "stitchId": "s002", "status": "draft" }
    ],
    "lottieFiles": [
      { "name": "checkmark", "url": "/animations/checkmark.lottie" }
    ],
    "designMdContent": "# Design System\\n## Colors\\n- Primary: #007AFF"
  }
}
\`\`\``,
    });

    const state = makeBaseState();
    const result = await designAgentNode(state);

    expect(result.designAssets).toBeDefined();
    expect(result.designAssets!.screens).toHaveLength(2);
    expect(result.designAssets!.lottieFiles).toHaveLength(1);
    expect(result.currentPhase).toBe("design");
  });
});

// ---------------------------------------------------------------------------
// Infra Agent
// ---------------------------------------------------------------------------
describe("infraAgentNode", () => {
  it("should extract infraState from LLM response", async () => {
    const { infraAgentNode } = await import("@/lib/agents/infra-agent");

    mockInvoke.mockResolvedValueOnce({
      content: `\`\`\`json
{
  "infraState": {
    "provider": "vercel-supabase",
    "stackName": "dev",
    "endpoints": { "api": "https://myapp.supabase.co", "web": "https://myapp.vercel.app" },
    "status": "planned"
  }
}
\`\`\``,
    });

    const state = makeBaseState({
      projectConfig: {
        ...makeBaseState().projectConfig,
        platform: "web",
        cloudProvider: "vercel-supabase",
        hasBackend: true,
      },
    });
    const result = await infraAgentNode(state);

    expect(result.infraState).toBeDefined();
    expect(result.infraState!.provider).toBe("vercel-supabase");
    expect(result.infraState!.status).toBe("planned");
    expect(result.currentPhase).toBe("infrastructure");
  });
});

// ---------------------------------------------------------------------------
// Code Agent
// ---------------------------------------------------------------------------
describe("codeAgentNode", () => {
  it("should extract codeArtifacts from LLM response", async () => {
    const { codeAgentNode } = await import("@/lib/agents/code-agent");

    mockInvoke.mockResolvedValueOnce({
      content: `\`\`\`json
{
  "codeArtifacts": {
    "files": [
      { "path": "Sources/Views/TaskListView.swift", "content": "import SwiftUI\\nstruct TaskListView: View { var body: some View { Text(\\"Tasks\\") } }" }
    ],
    "prUrl": null,
    "branch": "feat/task-list"
  }
}
\`\`\``,
    });

    const state = makeBaseState();
    const result = await codeAgentNode(state);

    expect(result.codeArtifacts).toBeDefined();
    expect(result.codeArtifacts!.files).toHaveLength(1);
    expect(result.codeArtifacts!.branch).toBe("feat/task-list");
    expect(result.currentPhase).toBe("implementation");
  });
});

// ---------------------------------------------------------------------------
// QA Agent
// ---------------------------------------------------------------------------
describe("qaAgentNode", () => {
  it("should approve when tests pass", async () => {
    const { qaAgentNode } = await import("@/lib/agents/qa-agent");

    mockInvoke.mockResolvedValueOnce({
      content: `\`\`\`json
{
  "qaResults": {
    "testsPassed": 12,
    "testsFailed": 0,
    "coverage": 87,
    "issues": [],
    "approved": true
  }
}
\`\`\``,
    });

    const state = makeBaseState({
      codeArtifacts: {
        files: [{ path: "test.swift", content: "code" }],
        prUrl: null,
        branch: "feat/test",
      },
    });
    const result = await qaAgentNode(state);

    expect(result.qaResults).toBeDefined();
    expect(result.qaResults!.approved).toBe(true);
    expect(result.qaResults!.testsFailed).toBe(0);
  });

  it("should reject with issues when tests fail", async () => {
    const { qaAgentNode } = await import("@/lib/agents/qa-agent");

    mockInvoke.mockResolvedValueOnce({
      content: `\`\`\`json
{
  "qaResults": {
    "testsPassed": 8,
    "testsFailed": 3,
    "coverage": 55,
    "issues": ["Missing error handling in TaskViewModel", "No tests for edge case: empty list"],
    "approved": false
  }
}
\`\`\``,
    });

    const state = makeBaseState({
      codeArtifacts: {
        files: [{ path: "test.swift", content: "code" }],
        prUrl: null,
        branch: "feat/test",
      },
    });
    const result = await qaAgentNode(state);

    expect(result.qaResults!.approved).toBe(false);
    expect(result.qaResults!.issues).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Human Review Node
// ---------------------------------------------------------------------------
describe("humanReviewNode", () => {
  it("should set awaitingApproval to true", async () => {
    const { humanReviewNode } = await import("@/lib/agents/human-review");

    const state = makeBaseState({
      architectureDecisions: {
        uiPattern: "mvvm",
        dataLayer: "swiftdata",
        navigation: "NavigationStack",
        packages: [],
        adrContent: "ADR",
      },
      designAssets: {
        screens: [{ name: "Home", stitchId: "s1", status: "draft" }],
        lottieFiles: [],
        designMdContent: "# Design",
      },
    });

    const result = await humanReviewNode(state);

    expect(result.awaitingApproval).toBe(true);
    expect(result.currentPhase).toBe("review");
    expect(result.messages).toHaveLength(1);
  });

  it("should include architecture and design summary in review message", async () => {
    const { humanReviewNode } = await import("@/lib/agents/human-review");

    const state = makeBaseState({
      architectureDecisions: {
        uiPattern: "tca",
        dataLayer: "rest",
        navigation: "Coordinator",
        packages: ["tca"],
        adrContent: "ADR",
      },
      designAssets: {
        screens: [
          { name: "A", stitchId: "", status: "draft" },
          { name: "B", stitchId: "", status: "draft" },
        ],
        lottieFiles: [{ name: "loading", url: "" }],
        designMdContent: "# Design",
      },
      infraState: {
        provider: "aws",
        stackName: "dev",
        endpoints: {},
        status: "planned",
      },
    });

    const result = await humanReviewNode(state);
    const content = (result.messages![0] as { content: string }).content;

    expect(content).toContain("tca");
    expect(content).toContain("2 screens");
    expect(content).toContain("1 animations");
    expect(content).toContain("aws");
  });
});
