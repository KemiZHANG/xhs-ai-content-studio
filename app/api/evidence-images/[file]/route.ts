import { NextResponse } from "next/server";
import { readEvidenceImage } from "@/lib/storage/evidence-images";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const image = await readEvidenceImage(file);

  if (!image) {
    return NextResponse.json({ error: "证据图片不存在" }, { status: 404 });
  }

  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "public, max-age=86400"
    }
  });
}
