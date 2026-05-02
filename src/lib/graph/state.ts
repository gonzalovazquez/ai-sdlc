import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";

// ---------------------------------------------------------------------------
// Type definitions for the SDLC state machine
// ---------------------------------------------------------------------------

/** Target platform — drives conditional routing in the graph */
export type Platform = "ios" | "web" | "both";

/** Cloud / infra provider selection */
export type CloudProvider =
  | "aws"
  | "azure"
  | "gcp"
  | "vercel-supabase"
  | "none";

/** Architecture pattern chosen by the Architect agent */
export type UIPattern = "mvvm" | "tca" | "component-based";

/** Data layer selected by the Architect agent */
export type DataLayer =
  | "swiftdata"
  | "rest"
  | "graphql"
  | "supabase"
  | "none";

// ---------------------------------------------------------------------------
// Sub-schemas (nested objects stored in checkpointed state)
// ---------------------------------------------------------------------------

export interface ProjectConfig {
  name: string;
  description: string;
  platform: Platform;
  cloudProvider: CloudProvider;
  hasBackend: boolean;
  hasAuth: boolean;
  screenCount: number;
  dataSources: string[];
}

export interface ArchitectureDecisions {
  uiPattern: UIPattern;
  dataLayer: DataLayer;
  navigation: string;
  packages: string[];
  adrContent: string;
}

export interface DesignAssets {
  screens: { name: string; stitchId: string; status: string }[];
  lottieFiles: { name: string; url: string }[];
  designMdContent: string;
}

export interface CodeArtifacts {
  files: { path: string; content: string }[];
  prUrl: string | null;
  branch: string;
}

export interface InfraState {
  provider: CloudProvider;
  stackName: string;
  endpoints: Record<string, string>;
  status: string;
}

export interface QAResults {
  testsPassed: number;
  testsFailed: number;
  coverage: number;
  issues: string[];
  approved: boolean;
}

// ---------------------------------------------------------------------------
// LangGraph Annotation — the shared state every agent reads / writes
// Checkpointed to PostgreSQL after every node execution.
// ---------------------------------------------------------------------------

export const SDLCState = Annotation.Root({
  /** Chat history (append-only via reducer) */
  messages: Annotation<BaseMessage[]>({
    reducer: (curr, update) => [...curr, ...update],
    default: () => [],
  }),

  /** Current phase in the SDLC pipeline */
  currentPhase: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "intake",
  }),

  /** Project configuration — set during intake by the PM agent */
  projectConfig: Annotation<ProjectConfig>({
    reducer: (_, update) => update,
    default: () => ({
      name: "",
      description: "",
      platform: "ios",
      cloudProvider: "none",
      hasBackend: false,
      hasAuth: false,
      screenCount: 0,
      dataSources: [],
    }),
  }),

  /** Architecture decisions — written by the Architect agent */
  architectureDecisions: Annotation<ArchitectureDecisions | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  /** Design assets — written by the Design agent */
  designAssets: Annotation<DesignAssets | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  /** Code artifacts — written by the Code agent */
  codeArtifacts: Annotation<CodeArtifacts | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  /** Infrastructure state — written by the Infra agent */
  infraState: Annotation<InfraState | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  /** QA results — written by the QA agent */
  qaResults: Annotation<QAResults | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  /** Human-in-the-loop interrupt flag */
  awaitingApproval: Annotation<boolean>({
    reducer: (_, update) => update,
    default: () => false,
  }),
});

/** Inferred TypeScript type for the full state object */
export type SDLCStateType = typeof SDLCState.State;
