import { describe, expect, it } from "vitest";
import { noticeForProjectReset, resetWorkflowFormForNewProject } from "@/app/state/project-reset";

describe("project reset state", () => {
  it("clears sticky workflow and publishing fields for a clean PostProject", () => {
    const next = resetWorkflowFormForNewProject(
      {
        topic: "旧主题",
        contentType: "探店",
        timeRange: "一周内",
        sampleCount: 8,
        visibility: "公开可见",
        autoPublish: true,
        workflowGoal: "draft",
        publishMode: "publish",
        analyzeImages: true,
        generateImages: true,
        scheduleAt: "2026-06-01T20:00:00+08:00",
        requirements: "旧需求",
        imageSource: "product",
        assetIds: ["asset-old"],
        productName: "旧产品",
        sellingPoints: "旧卖点",
        scene: "旧场景",
        style: "旧风格",
        extraImagePrompt: "旧图片要求"
      },
      { topic: "新主题", defaultVisibility: "仅自己可见" }
    );

    expect(next).toMatchObject({
      topic: "新主题",
      visibility: "仅自己可见",
      autoPublish: false,
      workflowGoal: "research",
      publishMode: "draft",
      generateImages: false,
      scheduleAt: "",
      requirements: "",
      assetIds: [],
      productName: "",
      sellingPoints: "",
      extraImagePrompt: ""
    });
    expect(next.contentType).toBe("探店");
    expect(next.analyzeImages).toBe(true);
  });

  it("explains that new conversations also create a clean post workspace", () => {
    expect(noticeForProjectReset("conversation")).toContain("新帖子对话");
    expect(noticeForProjectReset("conversation")).toContain("发布计划已清空");
    expect(noticeForProjectReset("project")).toContain("新建干净的帖子项目");
  });
});
