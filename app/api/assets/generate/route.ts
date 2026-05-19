import { NextResponse } from "next/server";
import { buildImageStudioPrompt } from "@/lib/images/studio";
import { createModelProvider } from "@/lib/models/provider";
import { createAssetRecord, getAsset, saveAsset } from "@/lib/storage/assets";
import { readSettings } from "@/lib/storage/settings";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      assetIds?: string[];
      productName?: string;
      sellingPoints?: string;
      scene?: string;
      style?: string;
      extraPrompt?: string;
      evidenceContext?: string;
    };
    const assetIds = body.assetIds ?? [];
    const assets = (await Promise.all(assetIds.map((id) => getAsset(id)))).filter(Boolean);

    const settings = await readSettings();
    const prompt = buildImageStudioPrompt({
      productName: body.productName || "产品",
      sellingPoints: body.sellingPoints || "请突出产品卖点",
      scene: body.scene || "真实生活场景",
      style: body.style || "小红书真实种草风",
      extraPrompt: body.extraPrompt,
      evidenceContext: body.evidenceContext,
      hasSourceImages: assets.length > 0
    });
    const model = createModelProvider(settings);
    const image = assets.length
      ? await model.generateImageFromReference(
          prompt,
          assets.map((asset) => asset!.absolutePath)
        )
      : await model.generateImage(prompt);

    if (!image?.path) {
      return NextResponse.json({ error: "图片模型没有返回可保存图片" }, { status: 500 });
    }

    const generated = await saveAsset(
      createAssetRecord({
        kind: "generated",
        originalName: "xhs-image-studio.png",
        absolutePath: image.path,
        mimeType: "image/png",
        size: 0,
        prompt,
        sourceAssetIds: assetIds
      })
    );

    return NextResponse.json({ asset: generated, prompt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成图片失败" },
      { status: 500 }
    );
  }
}
