import { describe, expect, it } from "vitest";
import { buildCanvasVersionDisplay } from "@/app/components/post-version-display";
import type { PostVersionDiffReport, PostVersionStatus } from "@/lib/post-project/versioning";

const freshStatus: PostVersionStatus = {
  activeCopyVersionId: "copy-1",
  activeImagePromptVersionIds: ["prompt-1"],
  finalPostMatchesCanvas: true,
  qualityGateFresh: true,
  needsReassemble: false,
  needsQualityGate: false,
  summary: "fresh",
  warnings: []
};

const diff: PostVersionDiffReport = {
  hasChanges: true,
  changedFields: ["title", "images"],
  summary: "changed title and images",
  changes: [
    { field: "title", label: "标题", changed: true, beforeSummary: "old", afterSummary: "new" },
    { field: "images", label: "图片", changed: true, beforeSummary: "old image", afterSummary: "new image" },
    { field: "tags", label: "标签", changed: false, beforeSummary: "#a", afterSummary: "#a" }
  ]
};

describe("post version display", () => {
  it("shows a locked state when final post and quality gate are fresh", () => {
    const display = buildCanvasVersionDisplay(freshStatus, diff);

    expect(display.tone).toBe("ok");
    expect(display.label).toContain("已锁定");
    expect(display.actionLabel).toBeUndefined();
  });

  it("asks the user to reassemble stale final post snapshots", () => {
    const display = buildCanvasVersionDisplay({
      ...freshStatus,
      finalPostMatchesCanvas: false,
      qualityGateFresh: false,
      needsReassemble: true,
      needsQualityGate: true,
      summary: "stale"
    }, diff);

    expect(display.tone).toBe("warn");
    expect(display.label).toContain("新版本");
    expect(display.actionLabel).toBe("重新组装帖子");
    expect(display.changedLabels).toEqual(["标题", "图片"]);
  });

  it("distinguishes assembled posts that only need quality gate refresh", () => {
    const display = buildCanvasVersionDisplay({
      ...freshStatus,
      qualityGateFresh: false,
      needsQualityGate: true,
      summary: "needs gate"
    }, { ...diff, hasChanges: false, changedFields: [], changes: [] });

    expect(display.tone).toBe("warn");
    expect(display.label).toContain("发布检查");
    expect(display.actionLabel).toBe("进入发布检查");
  });
});
