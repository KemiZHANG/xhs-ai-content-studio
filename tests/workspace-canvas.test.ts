import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceCanvas } from "@/app/components/workspace-canvas";
import type { WorkspaceState } from "@/app/types";

describe("workspace canvas", () => {
  it("shows the scheduled publish timezone in the canvas publish plan", () => {
    const workspace: WorkspaceState = {
      workspaceId: "workspace-1",
      topic: "广州咖啡馆",
      selectedSamples: [],
      selectedImageIds: [],
      productImageIds: [],
      recentJobIds: [],
      recentRunIds: [],
      recentConversationIds: [],
      publishPlan: {
        status: "awaiting_approval",
        title: "广州咖啡馆周末探店",
        content: "正文",
        tags: ["广州咖啡"],
        images: ["asset-1"],
        visibility: "仅自己可见",
        requestedBy: "manual",
        scheduleAt: "2099-05-31T20:00:00+08:00",
        scheduleTimezone: "+08:00",
        confirmationChecklist: []
      }
    };

    const html = renderToStaticMarkup(createElement(WorkspaceCanvas, {
      workspace,
      currentDraft: null,
      postProject: null,
      creatorMemory: null,
      assets: [],
      jobs: [],
      onOpenImageStudio: () => undefined,
      onOpenPublish: () => undefined
    }));

    expect(html).toContain("发布计划");
    expect(html).toContain("定时：2099-05-31T20:00:00+08:00");
    expect(html).toContain("+08:00");
  });
});
