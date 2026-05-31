import { describe, expect, it } from "vitest";
import { buildAgentMessageDisplay } from "@/app/components/agent-message-display";

describe("agent message display", () => {
  it("keeps short messages unchanged", () => {
    const display = buildAgentMessageDisplay("生成好了，可以继续修改。", { maxChars: 80, maxLines: 3 });

    expect(display.truncated).toBe(false);
    expect(display.visibleText).toBe("生成好了，可以继续修改。");
    expect(display.fullText).toBe("生成好了，可以继续修改。");
  });

  it("summarizes long replies at a readable boundary while preserving the full text", () => {
    const fullText = [
      "第一段：这里是很长的 Agent 回复，用来解释研究证据、CreativeBrief、文案方向和图片方向。",
      "第二段：继续说明标题、正文、标签和图片提示词为什么这样写。",
      "第三段：这里还有发布检查、质量门槛、账号确认和定时发布提示。",
      "第四段：完整内容应该被折叠起来，而不是把 Post Studio 输入框推到很远。"
    ].join("\n");
    const display = buildAgentMessageDisplay(fullText, { maxChars: 90, maxLines: 2 });

    expect(display.truncated).toBe(true);
    expect(display.visibleText.length).toBeLessThan(fullText.length);
    expect(display.visibleText.endsWith("...")).toBe(true);
    expect(display.fullText).toBe(fullText);
  });

  it("trims blank input into an empty display", () => {
    const display = buildAgentMessageDisplay("   \n  ");

    expect(display).toEqual({ visibleText: "", fullText: "", truncated: false });
  });
});
