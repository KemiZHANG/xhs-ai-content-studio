import { describe, expect, it } from "vitest";
import { buildCopyCreativeBrief, buildImageCreativeBrief } from "@/lib/workflows/creative-briefs";
import type { OneClickResult } from "@/lib/workflows/one-click";

const researchResult: OneClickResult = {
  status: "research_ready",
  steps: [],
  samples: [],
  evidence: [
    {
      id: "note-1",
      title: "广州咖啡馆样本标题",
      author: "探店人",
      likes: 1200,
      collects: 900,
      comments: 88,
      shares: 12,
      score: 4000,
      url: "https://www.xiaohongshu.com/explore/note-1",
      imageUrls: ["https://sns-webpic-qc.xhscdn.com/sample.webp"],
      cachedImageUrls: [],
      detailText: "原帖正文写了插座、价格、路线和窗边座位。",
      commentSnippets: ["求地址"],
      reasonHighlights: ["收藏高，适合参考"]
    }
  ],
  researchSummary: {
    contentStrengths: ["标题先给明确场景，再给真实体验"],
    imageStrengths: ["首图使用自然光和窗边座位"],
    learningsForContent: ["正文按痛点、体验、实用信息、互动问题展开"],
    learningsForImages: ["图片要突出真实环境、自然光、产品或场景主体"],
    nextQuestions: ["需要补充店名、地址、目标人群"]
  },
  report: "完整研究报告里可能包含很多样本细节。",
  imageStyleReport: "图片多为自然光、低饱和、桌面构图。",
  draft: null,
  images: [],
  publishResult: { skipped: true }
};

describe("creative briefs", () => {
  it("builds a compact copy brief without raw post body or image evidence", () => {
    const brief = buildCopyCreativeBrief(researchResult, "想写得更真实一点");

    expect(brief).toContain("标题先给明确场景");
    expect(brief).toContain("正文按痛点");
    expect(brief).toContain("需要补充店名");
    expect(brief).toContain("想写得更真实一点");
    expect(brief).not.toContain("原帖正文写了插座");
    expect(brief).not.toContain("sns-webpic");
    expect(brief).not.toContain("图片多为自然光");
    expect(brief).not.toContain("广州咖啡馆样本标题");
  });

  it("builds an image brief without carrying raw post body", () => {
    const brief = buildImageCreativeBrief(researchResult, "生成首图封面");

    expect(brief).toContain("首图使用自然光");
    expect(brief).toContain("图片要突出真实环境");
    expect(brief).toContain("图片多为自然光");
    expect(brief).toContain("生成首图封面");
    expect(brief).not.toContain("原帖正文写了插座");
  });
});
