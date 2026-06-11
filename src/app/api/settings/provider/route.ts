import { NextRequest, NextResponse } from "next/server";
import { getDemoProvider, setDemoProvider, type DemoProvider } from "@/lib/llm";

/**
 * GET /api/settings/provider
 *
 * Returns the currently active LLM provider for the demo agents.
 */
export async function GET() {
  return NextResponse.json({ provider: getDemoProvider() });
}

/**
 * PUT /api/settings/provider
 *
 * Switches the LLM provider at runtime. Body: { provider: "ollama" | "anthropic" }
 */
export async function PUT(req: NextRequest) {
  let body: { provider?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.provider !== "ollama" && body.provider !== "anthropic") {
    return NextResponse.json(
      { error: 'provider must be "ollama" or "anthropic"' },
      { status: 400 }
    );
  }

  setDemoProvider(body.provider as DemoProvider);
  return NextResponse.json({ provider: getDemoProvider() });
}
