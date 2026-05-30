import { NextResponse } from "next/server";
import { requireLocalActionToken } from "@/lib/security/action-token";
import { readPostProject, updatePostProject } from "@/lib/post-project/store";

export const runtime = "nodejs";

export async function GET() {
  const project = await readPostProject();
  return NextResponse.json({ project });
}

export async function PATCH(request: Request) {
  const authError = await requireLocalActionToken(request);
  if (authError) return authError;

  const patch = await request.json();
  const project = await updatePostProject(patch);
  return NextResponse.json({ project });
}
