import { NextResponse } from "next/server";
import { deleteAsset } from "@/lib/storage/assets";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deleteAsset(id);
  return NextResponse.json({ deleted });
}
