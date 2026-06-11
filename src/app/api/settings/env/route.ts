import { NextRequest, NextResponse } from "next/server";
import {
  clearRuntimeEnv,
  getEnvStatus,
  isAllowedEnvKey,
  setRuntimeEnv,
} from "@/lib/runtime-env";

/**
 * GET /api/settings/env
 *
 * Returns the status of known and runtime-set environment keys.
 * Values are never returned — only masked previews.
 */
export async function GET() {
  return NextResponse.json({ keys: getEnvStatus() });
}

/**
 * PUT /api/settings/env
 *
 * Sets a runtime environment key. Body: { key: string, value: string }
 * Applies to new LLM/tool calls; held in server memory only.
 */
export async function PUT(req: NextRequest) {
  let body: { key?: string; value?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const key = body.key?.trim();
  const value = body.value;
  if (!key || typeof value !== "string" || value.length === 0) {
    return NextResponse.json(
      { error: "key and a non-empty value are required" },
      { status: 400 }
    );
  }
  if (!isAllowedEnvKey(key)) {
    return NextResponse.json(
      { error: `"${key}" is not a valid key or cannot be set at runtime` },
      { status: 400 }
    );
  }

  setRuntimeEnv(key, value);
  return NextResponse.json({ keys: getEnvStatus() });
}

/**
 * DELETE /api/settings/env
 *
 * Clears a runtime override, restoring the original .env value if there
 * was one. Body: { key: string }
 */
export async function DELETE(req: NextRequest) {
  let body: { key?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  clearRuntimeEnv(body.key);
  return NextResponse.json({ keys: getEnvStatus() });
}
