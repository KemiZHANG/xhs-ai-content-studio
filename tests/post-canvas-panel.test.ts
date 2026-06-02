import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PostCanvasPanel } from "@/app/components/post-canvas-panel";
import type { CanvasVersionDisplay } from "@/app/components/post-version-display";
import type { CreationProvenanceCard } from "@/app/components/creation-provenance";
import type { AssetRecord, PostProject, PublishDraftState } from "@/app/types";
import type { EvidenceCitationReport } from "@/lib/post-project/citations";
import type { PostVersionDiffReport, PostVersionStatus } from "@/lib/post-project/versioning";
import { createBlankPostProject } from "@/lib/post-project/store";

const publishDraft: PublishDraftState = {
  title: "广州咖啡馆周末探店",
  content: "这家咖啡馆适合周末安静坐一下午，环境、出片和菜单都很稳。",
  tagsText: "#广州咖啡 #周末探店",
  imagePrompt: "自然光咖啡馆桌面近景，小红书真实探店风格"
};

const selectedAssets: AssetRecord[] = [
  {
    id: "asset-1",
    kind: "generated",
    name: "cover.png",
    originalName: "cover.png",
    mimeType: "image/png",
    size: 128,
    createdAt: "2026-06-02T10:00:00.000Z",
    promptVersionId: "prompt-v1",
    basedOnEvidenceIds: ["visual-1"]
  },
  {
    id: "asset-2",
    kind: "generated",
    name: "detail.png",
    originalName: "detail.png",
    mimeType: "image/png",
    size: 128,
    createdAt: "2026-06-02T10:01:00.000Z",
    promptVersionId: "prompt-v1",
    basedOnEvidenceIds: ["visual-1"]
  }
];

const project: PostProject = createBlankPostProject({
  topic: "广州咖啡馆",
  creativeBrief: {
    audience: "周末探店人群",
    painPoint: "想找安静、好拍、不踩雷的咖啡馆",
    contentAngle: "真实周末探店清单",
    emotionalHook: "给自己留一个舒服下午",
    proofPoints: ["环境稳定", "出片自然", "菜单不踩雷"],
    tone: "真实分享",
    visualMood: "自然光、安静、温暖",
    imageMustHave: ["咖啡杯", "窗边光线"],
    imageMustAvoid: ["虚假 logo", "夸张功效"],
    platformStyle: "小红书真实探店",
    tabooWords: ["最强", "必爆"],
    complianceNotes: ["不虚构销量和认证"],
    basedOnEvidenceIds: ["title-1", "copy-1", "visual-1"]
  },
  visualDirection: {
    mood: "自然光",
    composition: "桌面近景",
    colorPalette: "暖白和咖啡色",
    mustHave: ["咖啡杯", "窗边光线"],
    mustAvoid: ["过度商业感"],
    basedOnEvidenceIds: ["visual-1"],
    confirmationStatus: "confirmed",
    confirmedAt: "2026-06-02T09:00:00.000Z"
  },
  copyDraft: {
    id: "draft-1",
    updatedAt: "2026-06-02T08:30:00.000Z",
    draft: {
      title: publishDraft.title,
      content: publishDraft.content,
      tags: ["广州咖啡", "周末探店"],
      structure: ["适合谁", "真实体验", "收藏理由"],
      imagePrompt: publishDraft.imagePrompt,
      basedOnEvidenceIds: ["title-1", "copy-1", "tag-1", "visual-1"]
    },
    images: [],
    visibility: "仅自己可见"
  },
  copyVersions: [{
    id: "copy-v1",
    label: "真实分享版",
    createdAt: "2026-06-02T08:00:00.000Z",
    value: {
      title: publishDraft.title,
      content: publishDraft.content,
      tags: ["广州咖啡", "周末探店"],
      structure: ["适合谁", "真实体验", "收藏理由"],
      imagePrompt: publishDraft.imagePrompt,
      basedOnEvidenceIds: ["title-1", "copy-1", "tag-1", "visual-1"]
    },
    basedOnEvidenceIds: ["title-1", "copy-1", "tag-1"]
  }],
  imagePrompts: [{
    id: "prompt-v1",
    label: "自然光 Prompt",
    createdAt: "2026-06-02T09:00:00.000Z",
    value: {
      prompt: publishDraft.imagePrompt,
      negativePrompt: "不要虚假 logo，不要夸大功效"
    },
    basedOnEvidenceIds: ["visual-1"]
  }],
  selectedImages: ["asset-1", "asset-2"],
  finalPost: {
    title: publishDraft.title,
    content: publishDraft.content,
    tags: ["广州咖啡", "周末探店"],
    imageIds: ["asset-1", "asset-2"],
    copyVersionId: "copy-v1",
    imagePromptVersionIds: ["prompt-v1"],
    basedOnEvidenceIds: ["title-1", "copy-1", "tag-1", "visual-1"]
  }
});

const canvasVersionDisplay: CanvasVersionDisplay = {
  tone: "ok",
  label: "最终帖子已锁定",
  detail: "文案、图片、Prompt 和 Quality Gate 一致。",
  changedLabels: [],
  lanes: [
    { id: "copy", label: "文案版本", value: "copy-v1", state: "ok" },
    { id: "images", label: "图片版本", value: "Prompt 1 个", state: "ok" },
    { id: "final", label: "最终稿", value: "已锁定", state: "ok" }
  ]
};

const creationProvenance: CreationProvenanceCard[] = [
  {
    id: "brief",
    label: "Brief",
    headline: "策略来自研究证据",
    detail: "标题、正文和图片方向共享同一组 evidencePack。",
    state: "ready",
    sourceLine: "实时 3 / 爆款库 1",
    evidenceCount: 4,
    missingCount: 0,
    safetyLine: "只学习结构，不复制原文。"
  }
];

const versionStatus: PostVersionStatus = {
  activeCopyVersionId: "copy-v1",
  activeImagePromptVersionIds: ["prompt-v1"],
  finalPostMatchesCanvas: true,
  qualityGateFresh: true,
  needsReassemble: false,
  needsQualityGate: false,
  summary: "当前画布和最终帖子一致。",
  warnings: []
};

const versionDiff: PostVersionDiffReport = {
  hasChanges: false,
  changedFields: [],
  summary: "当前画布一致",
  changes: []
};

const citationReport: EvidenceCitationReport = {
  sections: [
    {
      field: "title",
      evidenceIds: ["title-1"],
      insights: [{
        id: "title-1",
        sourceType: "realtime",
        type: "title",
        insight: "标题先说城市和场景",
        sourceSampleIds: ["note-1"],
        confidence: 0.8,
        createdAt: "2026-06-02T00:00:00.000Z"
      }],
      missingEvidenceIds: [],
      sourceCounts: { realtime: 1, viral_library: 0, user_input: 0 }
    }
  ],
  allEvidenceIds: ["title-1"],
  missingEvidenceIds: [],
  sourceCounts: { realtime: 1, viral_library: 0, user_input: 0 },
  hasRealtimeEvidence: true,
  hasViralEvidence: false,
  hasUserInputEvidence: false,
  warnings: [],
  summary: "字段级引用 1 条"
};

describe("post canvas panel", () => {
  it("shows a compact starter guide before copy and images exist", () => {
    const emptyDraft: PublishDraftState = {
      title: "",
      content: "",
      tagsText: "",
      imagePrompt: ""
    };
    const html = renderToStaticMarkup(createElement(PostCanvasPanel, {
      canGenerateCopy: false,
      generatedCopyPrompt: "生成探店文案",
      creationProvenance: [],
      canvasVersionDisplay: {
        tone: "neutral",
        label: "待生成",
        detail: "等待文案和图片。",
        changedLabels: [],
        lanes: []
      },
      canvasDirty: false,
      selectedAssets: [],
      copyVersions: [],
      copyVersionGuidance: { state: "empty", label: "待生成", detail: "暂无版本" },
      publishDraft: emptyDraft,
      latestImagePrompt: "",
      project: null,
      imagePromptVersions: [],
      promptVersionGuidance: { state: "empty", label: "待生成", detail: "暂无 Prompt" },
      versionStatus: null,
      versionDiff: null,
      citationReport: null,
      onGenerateCopy: () => undefined,
      onOpenEvidence: () => undefined,
      onDraftChange: () => undefined,
      onSelectCopyVersion: () => undefined,
      onSelectImagePromptVersion: () => undefined,
      onQuickAction: () => undefined,
      onCommitCanvas: () => undefined
    }));

    expect(html).toContain("Post Canvas 起步引导");
    expect(html).toContain("空画布");
    expect(html).toContain("先让 Agent 建立证据");
    expect(html).toContain("搜索真实笔记");
    expect(html).toContain("选择图片");
  });

  it("renders a readable unified copy, image, version, final post, and evidence canvas", () => {
    const html = renderToStaticMarkup(createElement(PostCanvasPanel, {
      canGenerateCopy: true,
      generatedCopyPrompt: "生成探店文案",
      creationProvenance,
      canvasVersionDisplay,
      canvasDirty: false,
      selectedAssets,
      copyVersions: project.copyVersions,
      copyVersionGuidance: { state: "ok", label: "可回滚", detail: "最近版本可切换" },
      publishDraft,
      latestImagePrompt: publishDraft.imagePrompt,
      project,
      imagePromptVersions: project.imagePrompts,
      promptVersionGuidance: { state: "ok", label: "可使用", detail: "Prompt 可切换" },
      versionStatus,
      versionDiff,
      citationReport,
      onGenerateCopy: () => undefined,
      onOpenEvidence: () => undefined,
      onDraftChange: () => undefined,
      onSelectCopyVersion: () => undefined,
      onSelectImagePromptVersion: () => undefined,
      onQuickAction: () => undefined,
      onCommitCanvas: () => undefined
    }));

    expect(html).toContain("Post Canvas");
    expect(html).toContain("最终帖子画布");
    expect(html).toContain("为什么这样创作");
    expect(html).toContain("创作依据");
    expect(html).toContain("文案和图片共享当前 CreativeBrief");
    expect(html).toContain("最终帖子已锁定");
    expect(html).toContain("已选 2 张发布图片");
    expect(html).toContain("文案版本");
    expect(html).toContain("最近 1 个可回滚版本");
    expect(html).toContain("广州咖啡馆周末探店");
    expect(html).toContain("Prompt 版本");
    expect(html).toContain("最近 1 个可切换 Prompt");
    expect(html).toContain("图片方向已确认");
    expect(html).toContain("最终帖子快照");
    expect(html).toContain("版本已确认");
    expect(html).toContain("证据引用");
    expect(html).toContain("发布检查");
  });
});
