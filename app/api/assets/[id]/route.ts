import { NextResponse } from "next/server";
import { requireLocalActionToken } from "@/lib/security/action-token";
import { deleteAsset } from "@/lib/storage/assets";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireLocalActionToken(request);
  if (authError) return authError;

  const { id } = await params;
  const deleted = await deleteAsset(id);
  return NextResponse.json({ deleted });
}
