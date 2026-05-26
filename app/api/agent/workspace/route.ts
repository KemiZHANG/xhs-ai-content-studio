import { NextResponse } from "next/server";
import { readWorkspaceState, updateWorkspaceState } from "@/lib/agent/state";
import { requireLocalActionToken } from "@/lib/security/action-token";
import type { WorkspaceState } from "@/lib/agent/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const workspace = await readWorkspaceState();
    return NextResponse.json({ workspace });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read workspace state" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const authError = await requireLocalActionToken(request);
    if (authError) return authError;

    const body = (await request.json()) as Partial<WorkspaceState>;
    const workspace = await updateWorkspaceState({
      topic: typeof body.topic === "string" ? body.topic : undefined,
      researchRunId: typeof body.researchRunId === "string" ? body.researchRunId : undefined,
      evidenceSummary: body.evidenceSummary,
      selectedSamples: Array.isArray(body.selectedSamples) ? body.selectedSamples : undefined,
      currentDraftId: typeof body.currentDraftId === "string" ? body.currentDraftId : undefined,
      currentDraft: body.currentDraft,
      selectedImageIds: Array.isArray(body.selectedImageIds) ? body.selectedImageIds.map(String) : undefined,
      productImageIds: Array.isArray(body.productImageIds) ? body.productImageIds.map(String) : undefined,
      publishPlan: body.publishPlan,
      lastUserIntent: typeof body.lastUserIntent === "string" ? body.lastUserIntent : undefined,
      recentJobIds: Array.isArray(body.recentJobIds) ? body.recentJobIds.map(String) : undefined,
      recentRunIds: Array.isArray(body.recentRunIds) ? body.recentRunIds.map(String) : undefined,
      recentConversationIds: Array.isArray(body.recentConversationIds) ? body.recentConversationIds.map(String) : undefined
    });
    return NextResponse.json({ workspace });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update workspace state" },
      { status: 500 }
    );
  }
}
