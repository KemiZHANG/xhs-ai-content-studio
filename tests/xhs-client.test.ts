import { describe, expect, it } from "vitest";
import { buildSearchFeedsArguments } from "@/lib/mcp/xhs";

describe("buildSearchFeedsArguments", () => {
  it("omits MCP UI filters because filtered search can hang in the MCP browser flow", () => {
    expect(buildSearchFeedsArguments("咖啡探店", { timeRange: "一周内" })).toEqual({
      keyword: "咖啡探店"
    });
  });
});
