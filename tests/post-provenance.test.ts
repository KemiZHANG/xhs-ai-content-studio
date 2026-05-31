import { describe, expect, it } from "vitest";
import { buildCreationProvenanceSummary, formatCreationProvenanceForReply } from "@/lib/post-project/provenance";
import { createBlankPostProject } from "@/lib/post-project/store";

describe("post project creation provenance", () => {
  it("summarizes traceable Brief, copy, and visual creation evidence", () => {
    const project = createBlankPostProject({
      topic: "广州咖啡馆",
      evidencePack: {
        sampleIds: ["note-1"],
        summary: {
          viralKnowledge: {
            strategyReport: {
              originalityRules: ["只学习爆款钩子，不复制来源表达"],
              rewriteGuidance: ["替换为自己的真实探店经历"]
            }
          }
        },
        insights: [
          insight("insight-title", "realtime", "title", "标题突出城市和安静场景"),
          insight("insight-copy", "realtime", "copy", "正文先写体验再写适合人群"),
          insight("insight-tag", "user_input", "tag", "标签覆盖城市和场景"),
          insight("insight-visual", "viral_library", "visual", "图片用自然光桌面近景")
        ]
      },
      creativeBrief: {
        audience: "周末探店人群",
        painPoint: "不知道去哪坐",
        contentAngle: "安静咖啡馆合集",
        emotionalHook: "松弛感",
        proofPoints: ["真实体验"],
        tone: "真实分享",
        visualMood: "自然光",
        imageMustHave: ["环境细节"],
        imageMustAvoid: ["过度滤镜"],
        platformStyle: "小红书探店",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-title", "insight-visual"]
      },
      copyDraft: {
        id: "draft-1",
        updatedAt: "2026-06-01T00:00:00.000Z",
        images: [],
        visibility: "仅自己可见",
        draft: {
          title: "广州安静咖啡馆",
          content: "适合周末坐一下午。",
          tags: ["广州咖啡馆"],
          structure: ["场景", "体验", "适合谁"],
          imagePrompt: "自然光桌面近景",
          basedOnEvidenceIds: ["insight-title", "insight-copy", "insight-tag", "insight-visual"],
          evidenceReferences: {
            title: ["insight-title"],
            content: ["insight-copy"],
            tags: ["insight-tag"],
            imagePrompt: ["insight-visual"]
          }
        }
      },
      visualDirection: {
        mood: "自然光",
        composition: "桌面近景",
        colorPalette: "暖白",
        mustHave: ["咖啡杯"],
        mustAvoid: ["假 logo"],
        basedOnEvidenceIds: ["insight-visual"],
        confirmationStatus: "confirmed"
      },
      imagePrompts: [{
        id: "prompt-1",
        label: "自然光",
        createdAt: "2026-06-01T00:00:00.000Z",
        value: { prompt: "自然光咖啡馆桌面近景" },
        basedOnEvidenceIds: ["insight-visual"]
      }]
    });

    const summary = buildCreationProvenanceSummary(project, project.copyDraft);

    expect(summary.headline).toBe("创作依据完整");
    expect(summary.items.map((item) => item.status)).toEqual(["ready", "ready", "ready"]);
    expect(summary.items.find((item) => item.id === "copy")?.summary).toContain("4/4");
    expect(summary.items.find((item) => item.id === "brief")?.originalityLine).toContain("不复制来源表达");
    expect(summary.items.find((item) => item.id === "copy")?.originalityLine).toContain("真实探店经历");
    expect(formatCreationProvenanceForReply(summary)).toContain("爆款库");
    expect(formatCreationProvenanceForReply(summary)).toContain("爆款库原创边界");
  });

  it("does not pretend empty projects have research evidence", () => {
    const summary = buildCreationProvenanceSummary(null);

    expect(summary.canExplainCreation).toBe(false);
    expect(summary.items.every((item) => item.status === "empty")).toBe(true);
    expect(formatCreationProvenanceForReply(summary)).toContain("不能把建议伪装成研究结论");
  });
});

function insight(
  id: string,
  sourceType: "realtime" | "viral_library" | "user_input",
  type: "title" | "copy" | "tag" | "visual",
  insightText: string
) {
  return {
    id,
    sourceType,
    type,
    insight: insightText,
    sourceSampleIds: ["note-1"],
    confidence: 0.82,
    createdAt: "2026-06-01T00:00:00.000Z"
  };
}
