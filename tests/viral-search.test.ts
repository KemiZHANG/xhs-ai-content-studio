import { describe, expect, it } from "vitest";
import { buildViralKnowledgeSearchParams } from "@/app/components/viral-search";

describe("viral knowledge search params", () => {
  it("passes the full RAG filter surface to the viral knowledge API", () => {
    const params = buildViralKnowledgeSearchParams({
      query: " 广州咖啡馆 ",
      category: "探店",
      tags: "咖啡,拍照",
      audience: "上班族",
      painPoint: "不知道怎么选",
      createdAfter: "2026-05-01",
      createdBefore: "2026-05-31",
      minLikes: "100",
      minCollects: "300",
      minComments: "20",
      minShares: "8",
      minScore: "500",
      sortBy: "comments",
      sortOrder: "asc"
    }, 9);

    expect(params.get("limit")).toBe("9");
    expect(params.get("q")).toBe("广州咖啡馆");
    expect(params.get("createdAfter")).toBe("2026-05-01T00:00:00.000Z");
    expect(params.get("createdBefore")).toBe("2026-05-31T00:00:00.000Z");
    expect(params.get("minComments")).toBe("20");
    expect(params.get("minShares")).toBe("8");
    expect(params.get("sortBy")).toBe("comments");
    expect(params.get("sortOrder")).toBe("asc");
  });

  it("drops invalid number filters instead of sending noisy params", () => {
    const params = buildViralKnowledgeSearchParams({
      minLikes: "many",
      minCollects: "  ",
      minShares: "12"
    });

    expect(params.has("minLikes")).toBe(false);
    expect(params.has("minCollects")).toBe(false);
    expect(params.get("minShares")).toBe("12");
  });
});
