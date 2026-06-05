import { describe, expect, it } from "vitest";
import { buildViralLibraryHealth } from "@/app/components/viral-library-health";
import type { ViralCase } from "@/app/types";

const makeCase = (id: string, overrides: Partial<ViralCase> = {}): ViralCase => ({
  id,
  platform: "xiaohongshu",
  sourceSampleId: `sample-${id}`,
  topic: "coffee",
  category: "探店",
  title: "周末咖啡馆",
  bodyExcerpt: "只保留摘要，不保存完整原文。",
  tags: ["咖啡"],
  imageStyle: "自然光桌面近景",
  hookType: "场景利益前置",
  contentStructure: ["场景", "价格", "适合人群"],
  painPoint: "不知道周末去哪",
  audience: "广州探店用户",
  emotionalTrigger: "松弛感",
  metrics: { likes: 600, collects: 500, comments: 40, shares: 10, score: 1500 },
  sourceUrl: "https://www.xiaohongshu.com/explore/note",
  createdAt: "2026-06-01T00:00:00.000Z",
  embedding: [],
  extractedInsights: {
    titleHooks: ["把场景和收益前置"],
    copyStructures: ["先讲适合谁，再讲体验和避坑"],
    tagPatterns: ["城市 + 场景 + 人群"],
    visualPatterns: ["自然光、真实桌面、信息层级清楚"],
    audienceSignals: ["周末想找地方的人"],
    painPoints: ["担心踩雷"],
    emotionalTriggers: ["松弛感"],
    commentConcerns: ["价格", "位置"],
    reusableRules: ["用具体场景承接人群需求", "正文补足决策信息", "图片突出真实氛围"],
    avoidCopying: ["不要复用原文句式"]
  },
  creativeSafety: {
    summary: "只学习结构和画面层级。",
    reusablePatterns: ["场景前置", "决策信息完整"],
    doNotCopy: ["不要复制原文", "不要复刻原图构图"],
    transformationGuidance: ["换成自己的产品/店铺和真实细节"]
  },
  quality: {
    score: 0.78,
    structuredFieldCount: 8,
    reusableRuleCount: 5,
    safetyRuleCount: 4,
    warnings: []
  },
  extraction: {
    sourceSampleId: `sample-${id}`,
    method: "model",
    extractedAt: "2026-06-01T00:00:00.000Z"
  },
  ...overrides
});

describe("viral library health", () => {
  it("explains the empty library state without pretending RAG is ready", () => {
    const health = buildViralLibraryHealth([]);

    expect(health.status).toBe("empty");
    expect(health.headline).toContain("还没有");
    expect(health.recommendations.length).toBeGreaterThan(0);
  });

  it("warns when the library relies on low-quality heuristic cases", () => {
    const health = buildViralLibraryHealth([
      makeCase("weak", {
        quality: { score: 0.35, structuredFieldCount: 2, reusableRuleCount: 1, safetyRuleCount: 1, warnings: ["too thin"] },
        creativeSafety: undefined,
        extraction: { sourceSampleId: "sample-weak", method: "heuristic", extractedAt: "2026-06-01T00:00:00.000Z" }
      })
    ]);

    expect(health.status).toBe("warn");
    expect(health.warnings.join(" ")).toContain("AI 提炼比例偏低");
    expect(health.recommendations.join(" ")).toContain("配置文本模型");
  });

  it("separates forced weak references from usable viral samples", () => {
    const health = buildViralLibraryHealth([
      makeCase("usable"),
      makeCase("forced-weak", {
        quality: {
          score: 0.78,
          structuredFieldCount: 8,
          reusableRuleCount: 5,
          safetyRuleCount: 4,
          warnings: ["低质量样本被人工强制入库：质量分 0/100，正文过短"]
        }
      })
    ]);

    expect(health.status).toBe("warn");
    expect(health.stats.find((item) => item.label === "样本")?.value).toBe("2");
    expect(health.stats.find((item) => item.label === "可用样本")?.value).toBe("1");
    expect(health.stats.find((item) => item.label === "弱参考")?.value).toBe("1");
    expect(health.warnings.join(" ")).toContain("弱参考");
    expect(health.recommendations.join(" ")).toContain("替换弱参考样本");
  });

  it("marks a diverse model-extracted library as ready", () => {
    const cases = Array.from({ length: 8 }, (_, index) => makeCase(`case-${index}`));
    const health = buildViralLibraryHealth(cases);

    expect(health.status).toBe("ready");
    expect(health.stats.find((item) => item.label === "AI 提炼")?.value).toBe("100%");
    expect(health.warnings).toEqual([]);
  });
});
