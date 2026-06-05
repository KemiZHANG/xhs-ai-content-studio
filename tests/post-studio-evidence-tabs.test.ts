import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PostStudioBriefTab,
  PostStudioEvidenceTab,
  PostStudioInsightsTab
} from "@/app/components/post-studio-evidence-tabs";
import type { EvidencePanelModel } from "@/app/components/evidence-display";
import type { StudioTabSummary } from "@/app/components/studio-tab-summary";
import type { ViralEvidenceSummaryModel } from "@/app/components/viral-evidence-summary";
import type { ViralSaveCandidateModel } from "@/app/components/viral-save-candidates";
import type { CreatorMemoryProfile, PostProject, SampleEvidence } from "@/app/types";
import type { EvidenceCitationReport, EvidenceReferenceSummary } from "@/lib/post-project/citations";

type EvidenceInsight = PostProject["evidencePack"]["insights"][number];
type CreativeBrief = NonNullable<PostProject["creativeBrief"]>;

const sample: SampleEvidence = {
  id: "sample-1",
  title: "广州咖啡馆收藏攻略",
  author: "咖啡探店号",
  likes: 1200,
  collects: 980,
  comments: 80,
  shares: 12,
  score: 4300,
  url: "https://example.com/note",
  imageUrls: ["https://example.com/image.jpg"],
  cachedImageUrls: [],
  detailText: "用路线、价格和适合拍照的位置做结构，收藏价值很明确。",
  commentSnippets: ["求地址", "这个清单很实用"],
  reasonHighlights: ["高收藏说明清单结构有用"]
};

const viralSummary: ViralEvidenceSummaryModel = {
  hasEvidence: true,
  headline: "爆款库规律已接入",
  detail: "只复用结构和决策逻辑，不复制原文原图。",
  sourceLine: "爆款库 evidencePack 2 条",
  keyInsights: [
    {
      id: "viral-insight-1",
      type: "hook",
      insight: "标题先给具体城市和可收藏结果。",
      confidence: 0.9,
      sourceSampleIds: ["viral-1"],
      isFocused: true,
      isCited: true
    }
  ],
  coverage: [
    { id: "title", label: "标题", status: "cited", evidenceIds: ["viral-insight-1"], line: "已引用 1 条" },
    { id: "copy", label: "正文", status: "ready", evidenceIds: ["viral-insight-2"], line: "可用 1 条" },
    { id: "tag", label: "标签", status: "missing", evidenceIds: [], line: "缺少证据" },
    { id: "visual", label: "图片", status: "ready", evidenceIds: ["viral-insight-3"], line: "可用 1 条" }
  ],
  sourceCases: [
    {
      id: "viral-1",
      title: "城市咖啡清单",
      hookType: "清单型钩子",
      category: "探店",
      score: 88,
      safetySummary: "只学习结构。",
      reusablePatterns: ["城市 + 清单 + 适用人群"],
      doNotCopy: ["不要复制原句"]
    }
  ],
  traceLine: "已被 Brief / 文案引用 1 条"
};

const insight: EvidenceInsight = {
  id: "insight-1",
  sourceType: "realtime",
  type: "structure",
  insight: "正文按路线、预算、适合人群分段，读者更容易收藏。",
  sourceSampleIds: ["sample-1"],
  confidence: 0.86,
  createdAt: "2026-06-02T08:00:00.000Z"
};

const citationReport: EvidenceCitationReport = {
  allEvidenceIds: ["insight-1"],
  missingEvidenceIds: [],
  sourceCounts: { realtime: 1, viral_library: 0, user_input: 0 },
  hasRealtimeEvidence: true,
  hasViralEvidence: false,
  hasUserInputEvidence: false,
  summary: "当前草稿引用 1 条证据。",
  warnings: [],
  sections: [
    {
      field: "title",
      evidenceIds: ["insight-1"],
      insights: [insight],
      missingEvidenceIds: [],
      sourceCounts: { realtime: 1, viral_library: 0, user_input: 0 }
    }
  ]
};

const creatorMemory: CreatorMemoryProfile = {
  liked: [{ text: "生活化口吻" }],
  disliked: [{ text: "太硬广" }],
  tone: [{ text: "真实分享" }],
  tags: [{ name: "广州探店" }],
  products: []
};

const brief: CreativeBrief = {
  audience: "周末想找咖啡馆的广州女生",
  painPoint: "不知道哪家适合拍照和办公",
  contentAngle: "一周内高收藏咖啡馆清单",
  emotionalHook: "少踩雷",
  proofPoints: ["路线清楚", "价格明确"],
  tone: "真实探店",
  visualMood: "明亮、干净、有生活感",
  imageMustHave: ["门头", "咖啡", "座位"],
  imageMustAvoid: ["虚假门店", "过度滤镜"],
  platformStyle: "小红书探店",
  tabooWords: ["全网第一"],
  complianceNotes: ["不虚构价格", "只学习爆款结构，不复制原文表达"],
  basedOnEvidenceIds: ["insight-1"]
};

const tabSummary: StudioTabSummary = {
  state: "ready",
  headline: "Brief 已生成",
  detail: "可以进入文案或图片生成。",
  primaryAction: "generate_copy",
  primaryActionLabel: "生成文案"
};

const evidenceReference: EvidenceReferenceSummary = {
  summary: "引用结构规律。",
  evidenceIds: ["insight-1"],
  missingEvidenceIds: [],
  insights: [insight],
  sourceCounts: { realtime: 1, viral_library: 0, user_input: 0 },
  hasRealtimeEvidence: true,
  hasViralEvidence: false,
  hasUserInputEvidence: false
};

const evidencePanel: EvidencePanelModel = {
  visibleSamples: [sample],
  hiddenCount: 0,
  totalCount: 1,
  visibleCount: 1,
  inlineTitle: "高价值摘要 1/1",
  summary: "已压缩展示 1 条高价值摘要",
  detailHint: "点击查看全部证据。",
  compressionLine: "完整原文放进证据详情。",
  primaryActionLabel: "打开完整证据目录",
  stats: [
    { label: "摘要", value: "1" },
    { label: "全部", value: "1" }
  ]
};

const saveCandidates: ViralSaveCandidateModel = {
  candidates: [
    {
      sample,
      score: 86,
      reasons: ["互动信号强", "正文信息足够"],
      warnings: [],
      shouldSave: true
    }
  ],
  rejectedSamples: [],
  rejectedCount: 0,
  hiddenCandidateCount: 0,
  totalCount: 1,
  headline: "发现 1 条爆款库候选",
  detail: "适合提取标题钩子和结构规律。",
  actionLabel: "一键沉淀 1 条候选"
};

describe("post studio evidence tabs", () => {
  it("renders learning insights with citations and creator memory", () => {
    const html = renderToStaticMarkup(createElement(PostStudioInsightsTab, {
      realtimeCount: 1,
      viralCount: 1,
      weakViralCount: 2,
      viralEvidenceSummary: viralSummary,
      keyLearningInsights: [insight],
      totalInsightCount: 2,
      citationReport,
      creatorMemory,
      projectMemory: ["喜欢真实分享"],
      onOpenViral: () => undefined
    }));

    expect(html).toContain("可学习结论");
    expect(html).toContain("实时证据 1");
    expect(html).toContain("可用爆款 1");
    expect(html).toContain("弱参考 2");
    expect(html).toContain("证据来源构成");
    expect(html).toContain("实时搜索 1");
    expect(html).toContain("可用爆款 1");
    expect(html).toContain("用户输入 0");
    expect(html).toContain("爆款库规律已接入");
    expect(html).toContain("当前草稿证据引用");
    expect(html).toContain("创作记忆");
  });

  it("renders creative brief and referenced evidence", () => {
    const html = renderToStaticMarkup(createElement(PostStudioBriefTab, {
      summary: tabSummary,
      brief,
      briefEvidenceSummary: evidenceReference,
      visualEvidenceSummary: evidenceReference,
      onQuickAction: () => undefined
    }));

    expect(html).toContain("CreativeBrief");
    expect(html).toContain("周末想找咖啡馆的广州女生");
    expect(html).toContain("Brief 参考证据");
    expect(html).toContain("图片方向参考证据");
    expect(html).toContain("门头");
    expect(html).toContain("禁忌词");
    expect(html).toContain("全网第一");
    expect(html).toContain("合规 / 原创边界");
    expect(html).toContain("只学习爆款结构，不复制原文表达");
  });

  it("renders compressed evidence with viral-library save actions", () => {
    const html = renderToStaticMarkup(createElement(PostStudioEvidenceTab, {
      evidencePanel,
      viralSaveCandidates: saveCandidates,
      saveableSamples: [sample],
      summarizeEvidenceSample: (item) => item.reasonHighlights[0] ?? item.detailText,
      onOpenEvidenceCatalog: () => undefined,
      onOpenWorkflow: () => undefined,
      onSaveManyToViralLibrary: () => undefined,
      onOpenSample: () => undefined,
      onSaveToViralLibrary: () => undefined
    }));

    expect(html).toContain("研究证据");
    expect(html).toContain("高价值摘要 1/1");
    expect(html).toContain("发现 1 条爆款库候选");
    expect(html).toContain("保存到爆款库");
    expect(html).toContain("打开完整证据目录");
  });

  it("keeps viral save candidates compressed by default", () => {
    const candidates = Array.from({ length: 5 }, (_, index) => ({
      ...saveCandidates.candidates[0],
      sample: {
        ...sample,
        id: `sample-${index + 1}`,
        title: `候选样本 ${index + 1}`
      }
    }));
    const html = renderToStaticMarkup(createElement(PostStudioEvidenceTab, {
      evidencePanel: { ...evidencePanel, totalCount: 5 },
      viralSaveCandidates: { ...saveCandidates, candidates, hiddenCandidateCount: 2, totalCount: 5 },
      saveableSamples: candidates.map((item) => item.sample),
      summarizeEvidenceSample: (item) => item.reasonHighlights[0] ?? item.detailText,
      onOpenEvidenceCatalog: () => undefined,
      onOpenWorkflow: () => undefined,
      onSaveManyToViralLibrary: () => undefined,
      onOpenSample: () => undefined,
      onSaveToViralLibrary: () => undefined
    }));

    expect(html).toContain("候选样本 1");
    expect(html).toContain("候选样本 3");
    expect(html).not.toContain("候选样本 4");
    expect(html).toContain("还有 2 条候选已收起");
  });

  it("explains rejected viral-library samples without expanding raw evidence", () => {
    const rejectedSample = {
      ...sample,
      id: "sample-weak",
      title: "证据偏薄样本",
      likes: 2,
      collects: 1,
      comments: 0,
      detailText: "短"
    };
    const html = renderToStaticMarkup(createElement(PostStudioEvidenceTab, {
      evidencePanel,
      viralSaveCandidates: {
        candidates: [],
        rejectedSamples: [{
          sample: rejectedSample,
          score: 18,
          reasons: [],
          warnings: ["互动数据偏弱", "正文证据偏少"],
          shouldSave: false
        }],
        rejectedCount: 1,
        hiddenCandidateCount: 0,
        totalCount: 1,
        headline: "暂未发现适合入库的高质量样本",
        detail: "当前样本证据偏薄，可继续搜索、打开详情人工判断，或补充更高互动/更完整正文和评论的样本。",
        actionLabel: "先继续研究"
      },
      saveableSamples: [],
      summarizeEvidenceSample: (item) => item.reasonHighlights[0] ?? item.detailText,
      onOpenEvidenceCatalog: () => undefined,
      onOpenWorkflow: () => undefined,
      onSaveManyToViralLibrary: () => undefined,
      onOpenSample: () => undefined,
      onSaveToViralLibrary: () => undefined
    }));

    expect(html).toContain("暂未发现适合入库的高质量样本");
    expect(html).toContain("已过滤 1 条证据较薄的样本");
    expect(html).toContain("查看被过滤原因");
    expect(html).toContain("证据偏薄样本");
    expect(html).toContain("候选分 18");
    expect(html).toContain("互动数据偏弱 / 正文证据偏少");
  });
});
