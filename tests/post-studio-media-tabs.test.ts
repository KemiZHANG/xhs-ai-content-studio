import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AssetPanelSummary } from "@/app/components/asset-panel-summary";
import { PostStudioGeneratedTab, PostStudioReferencesTab } from "@/app/components/post-studio-media-tabs";
import type { StudioTabSummary } from "@/app/components/studio-tab-summary";
import type { AssetRecord, PostProject } from "@/app/types";

const asset: AssetRecord = {
  id: "asset-1",
  kind: "upload",
  name: "产品图",
  originalName: "product.png",
  mimeType: "image/png",
  size: 1024,
  createdAt: "2026-06-02T08:00:00.000Z"
};

const generatedAsset: AssetRecord = {
  ...asset,
  id: "asset-2",
  kind: "generated",
  name: "生成图",
  promptVersionId: "prompt-v1",
  basedOnEvidenceIds: ["evidence-1"]
};

const summary: StudioTabSummary = {
  headline: "已有素材可选",
  detail: "选择图片进入最终帖子。",
  state: "ready",
  primaryActionLabel: "选择图片",
  primaryAction: "select_images"
};

const assetSummary: AssetPanelSummary = {
  headline: "当前展示 1 张关键图片",
  detail: "默认只显示关键图片。",
  selectedCount: 1,
  hiddenCount: 0,
  previewAssets: [asset],
  compressionLine: "更多素材放在 Assets。",
  actionHint: "可以继续上传。",
  state: "ready"
};

const generatedSummary: AssetPanelSummary = {
  ...assetSummary,
  previewAssets: [generatedAsset],
  actionHint: "可以继续生成图文卡片。"
};

const project = {
  visualDirection: {
    mood: "自然光",
    composition: "桌面近景",
    colorPalette: "暖白",
    mustHave: ["咖啡杯"],
    mustAvoid: ["虚假 logo"],
    basedOnEvidenceIds: ["evidence-1"],
    confirmationStatus: "confirmed",
    confirmedAt: "2026-06-02T09:00:00.000Z"
  },
  finalPost: {
    title: "广州咖啡馆",
    content: "正文",
    tags: ["广州探店"],
    imageIds: ["asset-1"],
    imagePromptVersionIds: [],
    basedOnEvidenceIds: []
  },
  generatedImages: [
    {
      id: "generated-1",
      assetId: "asset-2",
      promptVersionId: "prompt-v1",
      basedOnEvidenceIds: ["evidence-1"]
    }
  ]
} as unknown as PostProject;

describe("post studio media tabs", () => {
  it("renders reference assets with upload and asset management actions", () => {
    const html = renderToStaticMarkup(createElement(PostStudioReferencesTab, {
      summary,
      assetSummary,
      publishAssetIds: ["asset-1"],
      project,
      onQuickAction: () => undefined,
      onSelectPostImages: () => undefined,
      onUploadReferenceFiles: () => undefined,
      onOpenImageStudio: () => undefined,
      onNavigate: () => undefined
    }));

    expect(html).toContain("图片参考");
    expect(html).toContain("拖入或粘贴产品图");
    expect(html).toContain("上传产品图 / 参考图");
    expect(html).toContain("素材管理与高级工具");
    expect(html).toContain("管理全部素材");
    expect(html).toContain("最终帖子图片");
  });

  it("renders generated assets with evidence-bound prompt metadata", () => {
    const html = renderToStaticMarkup(createElement(PostStudioGeneratedTab, {
      summary,
      assetSummary: generatedSummary,
      publishAssetIds: ["asset-2"],
      project,
      onQuickAction: () => undefined,
      onSelectPostImages: () => undefined,
      onOpenImageStudio: () => undefined
    }));

    expect(html).toContain("已生成素材");
    expect(html).toContain("Agent 生成配图");
    expect(html).toContain("生成图文卡片");
    expect(html).toContain("更多生成参数");
    expect(html).toContain("Prompt prompt-v1");
    expect(html).toContain("证据 1");
  });

  it("requires visual direction confirmation before generated-image actions", () => {
    const unconfirmedProject = {
      ...project,
      visualDirection: {
        ...project.visualDirection,
        confirmationStatus: "pending",
        confirmedAt: undefined
      }
    } as unknown as PostProject;
    const html = renderToStaticMarkup(createElement(PostStudioGeneratedTab, {
      summary,
      assetSummary: generatedSummary,
      publishAssetIds: ["asset-2"],
      project: unconfirmedProject,
      onQuickAction: () => undefined,
      onSelectPostImages: () => undefined,
      onOpenImageStudio: () => undefined
    }));

    expect(html).toContain("先确认图片方向");
    expect(html).toContain("图片方向必须人工确认后才能生成配图。");
    expect(html).toContain("disabled=");
  });
});
