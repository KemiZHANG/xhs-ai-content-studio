import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EvidenceCatalogDrawer, EvidenceDrawer } from "@/app/components/post-studio-drawers";
import type { SampleEvidence } from "@/app/types";

const sample: SampleEvidence = {
  id: "sample-full",
  title: "广州咖啡馆收藏清单",
  author: "探店作者",
  likes: 1200,
  collects: 980,
  comments: 80,
  shares: 12,
  score: 4300,
  url: "https://example.com/note",
  imageUrls: Array.from({ length: 8 }, (_, index) => `https://example.com/image-${index + 1}.jpg`),
  cachedImageUrls: [],
  detailText: "用路线、价格和适合拍照的位置做结构，收藏价值很明确。",
  commentSnippets: Array.from({ length: 10 }, (_, index) => `评论关注点 ${index + 1}`),
  reasonHighlights: Array.from({ length: 8 }, (_, index) => `参考理由 ${index + 1}`)
};

describe("post studio drawers", () => {
  it("keeps evidence details compressed but expandable for all comments and images", () => {
    const html = renderToStaticMarkup(createElement(EvidenceDrawer, {
      sample,
      onClose: () => undefined,
      onSave: () => undefined
    }));

    expect(html).toContain("证据详情");
    expect(html).toContain("广州咖啡馆收藏清单");
    expect(html).toContain("参考理由 1");
    expect(html).toContain("参考理由 8");
    expect(html).toContain("评论关注点 1");
    expect(html).toContain("评论关注点 10");
    expect(html).toContain("还有 2 条，展开全部");
    expect(html).toContain("还有 2 张，展开全部");
    expect(html).toContain("https://example.com/image-8.jpg");
  });

  it("explains that catalog entries open expandable single-sample details", () => {
    const html = renderToStaticMarkup(createElement(EvidenceCatalogDrawer, {
      samples: [sample],
      onClose: () => undefined,
      onOpenSample: () => undefined,
      onSaveSample: () => undefined
    }));

    expect(html).toContain("研究证据目录");
    expect(html).toContain("超出摘要的内容可继续展开");
    expect(html).toContain("打开详情");
    expect(html).toContain("保存到爆款库");
  });
});
