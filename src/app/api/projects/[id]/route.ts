import { NextRequest, NextResponse } from "next/server";
import { projects } from "../route";

/**
 * PATCH /api/projects/[id] — Update project status fields
 * Accepts: { currentPhase?, status?, awaitingApproval? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = projects.get(id);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await req.json();

  if (body.currentPhase !== undefined) {
    project.currentPhase = body.currentPhase;
  }
  if (body.status !== undefined) {
    project.status = body.status;
  }
  if (body.awaitingApproval !== undefined) {
    project.awaitingApproval = body.awaitingApproval;
  }

  project.updatedAt = new Date().toISOString();
  projects.set(id, project);

  return NextResponse.json(project);
}
