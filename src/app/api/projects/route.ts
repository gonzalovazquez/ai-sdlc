import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

/**
 * In-memory project store for MVP. Replace with PostgreSQL in production.
 */
export interface Project {
  id: string;
  threadId: string;
  name: string;
  description: string;
  platform: string;
  currentPhase: string;
  status: "running" | "awaiting_approval" | "completed" | "error";
  awaitingApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

export const projects = new Map<string, Project>();

/**
 * GET /api/projects — List all projects
 */
export async function GET() {
  const list = Array.from(projects.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  return NextResponse.json(list);
}

/**
 * POST /api/projects — Create a new project
 * Accepts: { name: string, description: string, platform: string }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, description, platform } = body;

  if (!name) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }

  const id = uuidv4();
  const threadId = uuidv4();
  const now = new Date().toISOString();

  const project: Project = {
    id,
    threadId,
    name,
    description: description || "",
    platform: platform || "ios",
    currentPhase: "intake",
    status: "running",
    awaitingApproval: false,
    createdAt: now,
    updatedAt: now,
  };

  projects.set(id, project);

  return NextResponse.json(project, { status: 201 });
}
