import { NextRequest, NextResponse } from "next/server";
import { getDemoProvider, setDemoProvider, type DemoProvider } from "@/lib/llm";

const VALID_PROVIDERS: DemoProvider[] = ["ollama", "claude-code"];

export async function GET() {
  return NextResponse.json({ provider: getDemoProvider() });
}

export async function PUT(req: NextRequest) {
  let body: { provider?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!VALID_PROVIDERS.includes(body.provider as DemoProvider)) {
    return NextResponse.json(
      { error: `provider must be one of: ${VALID_PROVIDERS.join(", ")}` },
      { status: 400 }
    );
  }

  setDemoProvider(body.provider as DemoProvider);
  return NextResponse.json({ provider: getDemoProvider() });
}
