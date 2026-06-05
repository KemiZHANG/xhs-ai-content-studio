import { describe, expect, it } from "vitest";
import { displaySample, formatMcpEndpoint, modeLabel, subtitleForSection, titleForSection, toDisplayNumber } from "@/app/components/xhs-display-utils";
import type { WorkflowSample } from "@/app/types";

describe("xhs display utils", () => {
  it("keeps primary navigation copy readable and centered on Post Studio", () => {
    expect(titleForSection("flow")).toBe("Post Studio");
    expect(titleForSection("assets")).toBe("Assets");
    expect(titleForSection("audit")).toBe("Publish History");
    expect(titleForSection("settings")).toBe("Settings");
    expect(subtitleForSection("flow")).toContain("帖子项目");
    expect(titleForSection("workflow")).toBe("高级主题研究");
    expect(titleForSection("chat")).toBe("旧版 AI 工作台");
    expect(subtitleForSection("chat")).toContain("回到 Post Studio");
    expect(subtitleForSection("publish")).toContain("优先使用 Post Studio");
    expect(modeLabel("research")).toBe("证据研究");
  });

  it("normalizes Chinese social metrics and fallback note titles", () => {
    expect(toDisplayNumber("1.2万")).toBe(12000);
    expect(toDisplayNumber("3.5w")).toBe(35000);

    const sample: WorkflowSample = {
      id: "note-1",
      title: "未命名笔记",
      author: "",
      likes: 0,
      collects: 0,
      comments: 0,
      shares: 0,
      score: 0,
      url: "",
      raw: {
        noteCard: {
          displayTitle: "广州咖啡馆合集",
          interactInfo: {
            likedCount: "1.2万",
            collectedCount: "800",
            commentCount: "90"
          },
          user: { nickname: "探店作者" }
        }
      }
    };

    const display = displaySample(sample);
    expect(display.title).toBe("广州咖啡馆合集");
    expect(display.author).toBe("探店作者");
    expect(display.likes).toBe(12000);
    expect(display.collects).toBe(800);
  });

  it("formats missing MCP endpoint in readable Chinese", () => {
    expect(formatMcpEndpoint("")).toBe("未配置 MCP");
  });
});
