import { describe, expect, it } from "vitest";
import { deriveFinalPost } from "@/lib/post-project/brief";
import { buildPublishVersionSnapshot, compareTextVersion, getPostVersionDiffReport, getPostVersionStatus } from "@/lib/post-project/versioning";
import type { PostProject } from "@/lib/post-project/types";

const baseProject = {
  copyDraft: {
    id: "draft-1",
    updatedAt: "2026-05-30T00:00:00.000Z",
    draft: {
      title: "通勤包真实分享",
      content: "正文内容足够长，包含真实使用场景和细节。",
      tags: ["通勤包"],
      structure: [],
      imagePrompt: "自然光通勤场景",
      basedOnEvidenceIds: ["insight-1"]
    },
    images: [],
    visibility: "仅自己可见"
  },
  selectedImages: ["asset-1"],
  imagePrompts: [{
    id: "prompt-1",
    createdAt: "2026-05-30T00:00:00.000Z",
    label: "Prompt",
    value: { prompt: "自然光通勤场景" },
    basedOnEvidenceIds: ["insight-1"]
  }],
  finalPost: {
    title: "通勤包真实分享",
    content: "正文内容足够长，包含真实使用场景和细节。",
    tags: ["通勤包"],
    imageIds: ["asset-1"],
    coverImageId: "asset-1",
    copyVersionId: "copy-draft-1",
    imagePromptVersionIds: ["prompt-1"],
    basedOnEvidenceIds: ["insight-1"]
  },
  qualityCheck: {
    titleScore: 100,
    copyScore: 100,
    visualConsistencyScore: 100,
    platformFitScore: 100,
    complianceScore: 100,
    canPublish: true,
    issues: [],
    suggestions: [],
    checkedAt: "2026-05-30T00:00:00.000Z"
  }
} satisfies Pick<PostProject, "copyDraft" | "selectedImages" | "imagePrompts" | "finalPost" | "qualityCheck">;

describe("post versioning status", () => {
  it("marks final post and quality gate fresh when they match the canvas", () => {
    const status = getPostVersionStatus(baseProject);

    expect(status.activeCopyVersionId).toBe("copy-draft-1");
    expect(status.finalPostMatchesCanvas).toBe(true);
    expect(status.qualityGateFresh).toBe(true);
    expect(status.needsReassemble).toBe(false);
    expect(status.needsQualityGate).toBe(false);
  });

  it("detects stale final post and stale quality gate after canvas changes", () => {
    const status = getPostVersionStatus({
      ...baseProject,
      copyDraft: {
        ...baseProject.copyDraft,
        draft: {
          ...baseProject.copyDraft.draft,
          title: "新的通勤包标题"
        }
      }
    });

    expect(status.finalPostMatchesCanvas).toBe(false);
    expect(status.qualityGateFresh).toBe(false);
    expect(status.needsReassemble).toBe(true);
    expect(status.needsQualityGate).toBe(true);
    expect(status.warnings.join(" ")).toContain("最终帖子快照已落后");
  });
  it("builds a publish confirmation snapshot from the current canvas versions", () => {
    const snapshot = buildPublishVersionSnapshot(baseProject);

    expect(snapshot.copyVersionId).toBe("copy-draft-1");
    expect(snapshot.imagePromptVersionIds).toEqual(["prompt-1"]);
    expect(snapshot.selectedImageIds).toEqual(["asset-1"]);
    expect(snapshot.finalPostEvidenceIds).toEqual(["insight-1"]);
    expect(snapshot.qualityGateFresh).toBe(true);
    expect(snapshot.qualityCanPublish).toBe(true);
    expect(snapshot.finalPostMatchesCanvas).toBe(true);
    expect(snapshot.summary).toContain("Quality Gate");
  });

  it("stores evidence ids on the assembled final post snapshot", () => {
    const finalPost = deriveFinalPost({
      copyDraft: baseProject.copyDraft,
      selectedImages: baseProject.selectedImages,
      imagePrompts: [
        ...baseProject.imagePrompts,
        {
          id: "prompt-visual",
          createdAt: "2026-05-30T00:00:00.000Z",
          label: "Visual Prompt",
          value: { prompt: "more visual detail" },
          basedOnEvidenceIds: ["insight-visual"]
        }
      ],
      finalPost: undefined
    });

    expect(finalPost?.basedOnEvidenceIds).toEqual(["insight-1", "insight-visual"]);
  });

  it("summarizes differences between the final post snapshot and current canvas", () => {
    const report = getPostVersionDiffReport({
      ...baseProject,
      selectedImages: ["asset-1", "asset-2"],
      copyDraft: {
        ...baseProject.copyDraft,
        draft: {
          ...baseProject.copyDraft.draft,
          title: "Updated commuter bag title",
          tags: ["commuter bag", "office"]
        }
      }
    });

    expect(report.hasChanges).toBe(true);
    expect(report.changedFields).toEqual(["title", "tags", "images"]);
    expect(report.summary).toContain("3");
    expect(report.changes.find((item) => item.field === "title")?.afterSummary).toContain("Updated commuter");
  });

  it("compares two copy versions before rollback", () => {
    const report = compareTextVersion(
      baseProject.copyDraft.draft,
      {
        ...baseProject.copyDraft.draft,
        content: "A newer body with a different structure and more concrete proof.",
        imagePrompt: "new image prompt"
      }
    );

    expect(report.hasChanges).toBe(true);
    expect(report.changedFields).toEqual(["content", "imagePrompts"]);
    expect(report.summary).toContain("正文");
  });
});
