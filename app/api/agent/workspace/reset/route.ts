import { NextResponse } from "next/server";
import { resetWorkspaceState } from "@/lib/agent/state";
import { requireLocalActionToken } from "@/lib/security/action-token";
import { writeCurrentDraft } from "@/lib/storage/drafts";
import type { WorkspaceState } from "@/lib/agent/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authError = await requireLocalActionToken(request);
    if (authError) return authError;

    const body = (await request.json().catch(() => ({}))) as Partial<WorkspaceState>;
    await writeCurrentDraft(null);
    const workspace = await resetWorkspaceState({
      topic: typeof body.topic === "string" ? body.topic : undefined,
      lastUserIntent: typeof body.lastUserIntent === "string" ? body.lastUserIntent : "start_new_workspace"
    });

    return NextResponse.json({ workspace });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reset workspace state" },
      { status: 500 }
    );
  }
}
