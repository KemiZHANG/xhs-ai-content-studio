import { describe, expect, it } from "vitest";
import { buildImageStudioPrompt } from "@/lib/images/studio";

describe("buildImageStudioPrompt", () => {
  it("includes research evidence and user image requirements", () => {
    const prompt = buildImageStudioPrompt({
      productName: "冷萃咖啡",
      sellingPoints: "低糖、便携、适合通勤",
      scene: "广州咖啡馆窗边桌面",
      style: "真实小红书探店风",
      extraPrompt: "做成首图封面",
      evidenceContext: "样本图片优点：自然光、窗景、低饱和绿色。内容优点：清单式、附地址。"
    });

    expect(prompt).toContain("冷萃咖啡");
    expect(prompt).toContain("低糖、便携、适合通勤");
    expect(prompt).toContain("广州咖啡馆窗边桌面");
    expect(prompt).toContain("样本图片优点");
    expect(prompt).toContain("不要复制样本图");
    expect(prompt).toContain("小红书");
  });

  it("supports text-to-image when no source image is provided", () => {
    const prompt = buildImageStudioPrompt({
      productName: "",
      sellingPoints: "",
      scene: "安静书桌",
      style: "自然光",
      extraPrompt: "",
      evidenceContext: ""
    });

    expect(prompt).toContain("可无参考图");
    expect(prompt).toContain("安静书桌");
    expect(prompt).toContain("自然光");
  });
});
