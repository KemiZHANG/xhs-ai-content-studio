import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createAssetRecord, listAssets, saveAsset, uploadDir } from "@/lib/storage/assets";

export const runtime = "nodejs";

export async function GET() {
  const assets = await listAssets();
  return NextResponse.json({ assets });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请选择图片文件" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "只支持图片文件" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const dir = uploadDir();
    await mkdir(dir, { recursive: true });
    const safeName = safeFileName(file.name);
    const filePath = path.join(dir, `${Date.now()}-${safeName}`);
    await writeFile(filePath, bytes);

    const asset = await saveAsset(
      createAssetRecord({
        kind: "upload",
        originalName: file.name,
        absolutePath: filePath,
        mimeType: file.type,
        size: file.size
      })
    );

    return NextResponse.json({ asset });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "上传失败" },
      { status: 500 }
    );
  }
}

function safeFileName(name: string): string {
  const extension = path.extname(name) || ".png";
  const basename = path.basename(name, extension).replace(/[^\w\u4e00-\u9fa5-]+/g, "-") || "image";
  return `${basename}${extension}`;
}
