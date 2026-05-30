import { describe, expect, it } from "vitest";
import { getPostVersionStatus } from "@/lib/post-project/versioning";
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
    imagePromptVersionIds: ["prompt-1"]
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
});
