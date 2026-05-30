import { NextResponse } from "next/server";
import { requireLocalActionToken } from "@/lib/security/action-token";
import { resetPostProject } from "@/lib/post-project/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authError = await requireLocalActionToken(request);
  if (authError) return authError;

  const seed = await request.json().catch(() => ({}));
  const project = await resetPostProject(seed);
  return NextResponse.json({ project });
}
