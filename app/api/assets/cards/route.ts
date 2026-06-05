import { NextResponse } from "next/server";
import {
  renderXhsCardSet,
  type CardPaginationMode,
  type CardTheme
} from "@/lib/cards/renderer";
import { requireLocalActionToken } from "@/lib/security/action-token";
import { createAssetRecord, createGenerationBatchId, saveAsset, toPublicAssetRecord } from "@/lib/storage/assets";

export const runtime = "nodejs";

type CardGenerationBody = {
  title?: string;
  subtitle?: string;
  body?: string;
  tags?: string[];
  theme?: CardTheme;
  mode?: CardPaginationMode;
  width?: number;
  height?: number;
  maxHeight?: number;
  dpr?: number;
};

export async function POST(request: Request) {
  try {
    const authError = await requireLocalActionToken(request);
    if (authError) return authError;

    const body = (await request.json()) as CardGenerationBody;
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "请填写卡片标题" }, { status: 400 });
    }
    if (!body.body?.trim()) {
      return NextResponse.json({ error: "请填写卡片正文" }, { status: 400 });
    }

    const rendered = await renderXhsCardSet({
      title: body.title,
      subtitle: body.subtitle,
      body: body.body,
      tags: body.tags ?? [],
      theme: body.theme,
      mode: body.mode,
      width: body.width,
      height: body.height,
      maxHeight: body.maxHeight,
      dpr: body.dpr
    });

    const prompt = JSON.stringify({
      type: "xhs-card-set",
      title: body.title,
      subtitle: body.subtitle,
      theme: rendered.theme,
      mode: rendered.mode,
      width: rendered.width,
      height: rendered.height
    });

    const generationBatchId = createGenerationBatchId("card-set");
    const assets = [];
    for (const file of rendered.files) {
      const asset = await saveAsset(
        createAssetRecord({
          kind: "generated",
          originalName: file.kind === "cover" ? "xhs-card-cover.png" : `xhs-card-${file.pageIndex}.png`,
          absolutePath: file.absolutePath,
          mimeType: file.mimeType,
          size: file.size,
          prompt,
          generationBatchId
        })
      );
      assets.push(asset);
    }

    return NextResponse.json({
      assets: assets.map(toPublicAssetRecord),
      pages: rendered.pages,
      theme: rendered.theme,
      mode: rendered.mode,
      width: rendered.width,
      height: rendered.height
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成图文卡片失败" },
      { status: 500 }
    );
  }
}
