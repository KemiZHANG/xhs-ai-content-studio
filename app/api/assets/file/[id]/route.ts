import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getAsset } from "@/lib/storage/assets";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await getAsset(id);

  if (!asset) {
    return NextResponse.json({ error: "素材不存在" }, { status: 404 });
  }

  const bytes = await readFile(asset.absolutePath);
  return new Response(bytes, {
    headers: {
      "Content-Type": asset.mimeType,
      "Cache-Control": "public, max-age=3600"
    }
  });
}
