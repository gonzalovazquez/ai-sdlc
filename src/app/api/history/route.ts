import { NextRequest, NextResponse } from "next/server";
import { getSDLCGraph } from "@/lib/graph";

/**
 * GET /api/history?threadId=xxx
 *
 * Returns the current state snapshot for a given thread.
 */
export async function GET(req: NextRequest) {
  const threadId = req.nextUrl.searchParams.get("threadId");

  if (!threadId) {
    return NextResponse.json(
      { error: "threadId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const graph = getSDLCGraph();
    const state = await graph.getState({
      configurable: { thread_id: threadId },
    });

    if (!state || !state.values) {
      return NextResponse.json(
        { error: "No state found for this thread" },
        { status: 404 }
      );
    }

    // Serialize messages to a simpler format for the frontend
    const values = state.values as Record<string, unknown>;
    const messages = Array.isArray(values.messages)
      ? values.messages.map((m: { content: unknown; name?: string; _getType?: () => string }) => ({
          role: typeof m._getType === "function" ? m._getType() : "unknown",
          content:
            typeof m.content === "string"
              ? m.content
              : JSON.stringify(m.content),
          name: m.name || undefined,
        }))
      : [];

    return NextResponse.json({
      threadId,
      messages,
      currentPhase: values.currentPhase,
      projectConfig: values.projectConfig,
      architectureDecisions: values.architectureDecisions,
      designAssets: values.designAssets
        ? {
            screenCount: (values.designAssets as { screens: unknown[] }).screens
              ?.length,
            animationCount: (
              values.designAssets as { lottieFiles: unknown[] }
            ).lottieFiles?.length,
          }
        : null,
      codeArtifacts: values.codeArtifacts
        ? {
            fileCount: (values.codeArtifacts as { files: unknown[] }).files
              ?.length,
            branch: (values.codeArtifacts as { branch: string }).branch,
            prUrl: (values.codeArtifacts as { prUrl: string | null }).prUrl,
          }
        : null,
      infraState: values.infraState,
      qaResults: values.qaResults,
      awaitingApproval: values.awaitingApproval,
      next: state.next,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get thread state",
      },
      { status: 500 }
    );
  }
}
