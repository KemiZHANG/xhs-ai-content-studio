import { describe, expect, it } from "vitest";
import { resolvePostCreationTopic, resolvePostStudioTitle } from "@/app/components/post-studio-title";

describe("post studio title helpers", () => {
  it("does not show a draft research topic as the active PostProject title", () => {
    expect(resolvePostStudioTitle({
      projectTopic: null,
      workspaceTopic: null
    })).toBe("新帖子项目");
  });

  it("still uses the research topic when preparing creation prompts", () => {
    expect(resolvePostCreationTopic({
      projectTopic: null,
      workspaceTopic: null,
      researchTopic: "上海安静咖啡馆"
    })).toBe("上海安静咖啡馆");
  });

  it("prefers real project state over workspace and form drafts", () => {
    expect(resolvePostStudioTitle({
      projectTopic: "广州咖啡馆",
      workspaceTopic: "上海咖啡馆"
    })).toBe("广州咖啡馆");
    expect(resolvePostCreationTopic({
      projectTopic: "广州咖啡馆",
      workspaceTopic: "上海咖啡馆",
      researchTopic: "北京咖啡馆"
    })).toBe("广州咖啡馆");
  });
});
