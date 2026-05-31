import type { AssetRecord } from "@/app/types";

export type AssetPanelSummary = {
  headline: string;
  detail: string;
  selectedCount: number;
  hiddenCount: number;
  previewAssets: AssetRecord[];
  actionHint: string;
  state: "ready" | "empty" | "needs_selection";
};

export function buildReferenceAssetSummary({
  selectedAssets,
  referenceAssets,
  totalUploadCount,
  limit = 4
}: {
  selectedAssets: AssetRecord[];
  referenceAssets: AssetRecord[];
  totalUploadCount: number;
  limit?: number;
}): AssetPanelSummary {
  const previewAssets = uniqueAssets([...selectedAssets, ...referenceAssets]).slice(0, limit);
  const hiddenCount = Math.max(0, Math.max(totalUploadCount, referenceAssets.length) - previewAssets.length);
  return {
    headline: selectedAssets.length ? `已选 ${selectedAssets.length} 张发布图片` : "还没有选中发布图片",
    detail: selectedAssets.length
      ? "默认只展示当前选图和少量参考图，避免素材库挤占创作空间。"
      : "先上传产品图/参考图，或从最近生成图中选择发布图片。",
    selectedCount: selectedAssets.length,
    hiddenCount,
    previewAssets,
    actionHint: hiddenCount ? `还有 ${hiddenCount} 张素材放在 Assets 中管理。` : "当前参考图数量较少，可以继续上传。",
    state: selectedAssets.length ? "ready" : previewAssets.length ? "needs_selection" : "empty"
  };
}

export function buildGeneratedAssetSummary({
  selectedAssets,
  generatedAssets,
  totalGeneratedCount,
  limit = 4
}: {
  selectedAssets: AssetRecord[];
  generatedAssets: AssetRecord[];
  totalGeneratedCount: number;
  limit?: number;
}): AssetPanelSummary {
  const previewAssets = uniqueAssets([...selectedAssets, ...generatedAssets]).slice(0, limit);
  const hiddenCount = Math.max(0, Math.max(totalGeneratedCount, generatedAssets.length) - previewAssets.length);
  return {
    headline: previewAssets.length ? `当前展示 ${previewAssets.length} 张关键图片` : "还没有生成图",
    detail: selectedAssets.length
      ? "已选图片会固定优先展示；更多历史生成图不默认铺开。"
      : "这里优先显示最近生成图。满意后点选图片进入最终帖子。",
    selectedCount: selectedAssets.length,
    hiddenCount,
    previewAssets,
    actionHint: hiddenCount ? `还有 ${hiddenCount} 张历史生成图，可到 Assets 查看。` : "可以继续让 Agent 生成配图或图文卡片。",
    state: selectedAssets.length ? "ready" : previewAssets.length ? "needs_selection" : "empty"
  };
}

function uniqueAssets(assets: AssetRecord[]): AssetRecord[] {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    if (seen.has(asset.id)) return false;
    seen.add(asset.id);
    return true;
  });
}
