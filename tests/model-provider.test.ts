import { describe, expect, it } from "vitest";
import { buildReferenceImagePrompt } from "@/lib/models/provider";

describe("buildReferenceImagePrompt", () => {
  it("keeps the product as the visual anchor", () => {
    const prompt = buildReferenceImagePrompt({
      productName: "咖啡杯",
      sellingPoints: "保温、防漏、适合通勤",
      scene: "早晨办公桌",
      style: "小红书真实种草风",
      extraPrompt: "加三条讲解文字"
    });

    expect(prompt).toContain("咖啡杯");
    expect(prompt).toContain("保持产品主体一致");
    expect(prompt).toContain("包装、标签位置、轮廓、颜色和材质");
    expect(prompt).toContain("不要凭空生成错误文字");
    expect(prompt).toContain("早晨办公桌");
  });
});
