import { NextRequest, NextResponse } from "next/server";
import { getFlowMode, setFlowMode, type FlowMode } from "@/lib/graph";

/**
 * GET /api/settings/flow
 *
 * Returns the currently active pipeline flow ("simplified" | "full").
 */
export async function GET() {
  return NextResponse.json({ flow: getFlowMode() });
}

/**
 * PUT /api/settings/flow
 *
 * Switches the pipeline flow at runtime. Body: { flow: "simplified" | "full" }
 * Applies to newly started runs; threads should finish on the flow they
 * started on.
 */
export async function PUT(req: NextRequest) {
  let body: { flow?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.flow !== "simplified" && body.flow !== "full") {
    return NextResponse.json(
      { error: 'flow must be "simplified" or "full"' },
      { status: 400 }
    );
  }

  setFlowMode(body.flow as FlowMode);
  return NextResponse.json({ flow: getFlowMode() });
}
