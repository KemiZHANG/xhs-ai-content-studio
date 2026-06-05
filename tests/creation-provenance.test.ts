import { describe, expect, it } from "vitest";
import { buildCreationProvenance } from "@/app/components/creation-provenance";
import { createBlankPostProject } from "@/lib/post-project/store";

describe("creation provenance", () => {
  it("explains the empty state without pretending there is evidence", () => {
    const cards = buildCreationProvenance(null);

    expect(cards.map((card) => card.state)).toEqual(["empty", "empty", "empty"]);
    expect(cards[0].sourceLine).toBe("暂无来源");
    expect(cards[1].detail).toContain("标题、正文、标签");
  });

  it("summarizes Brief, copy, and visual evidence sources", () => {
    const project = createBlankPostProject({
      topic: "广州咖啡馆",
      evidencePack: {
        sampleIds: ["note-1"],
        summary: {
          viralKnowledge: {
            strategyReport: {
              originalityRules: ["只学习结构，不复制原文表达"],
              rewriteGuidance: ["换成自己的产品场景和真实体验"]
            }
          }
        },
        insights: [
          insight("insight-title", "realtime", "title", "标题用具体城市和场景"),
          insight("insight-copy", "realtime", "copy", "正文先写真实体验再给收藏理由"),
          insight("insight-tag", "user_input", "tag", "标签要覆盖城市和场景"),
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
          title: "广州周末咖啡馆",
          content: "适合安静坐一下午。",
          tags: ["广州咖啡馆"],
          structure: ["场景开头", "体验细节"],
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
        colorPalette: "暖白和咖啡色",
        mustHave: ["咖啡杯"],
        mustAvoid: ["过度商业感"],
        basedOnEvidenceIds: ["insight-visual"],
        confirmationStatus: "confirmed",
        confirmedAt: "2026-06-01T01:00:00.000Z"
      },
      imagePrompts: [
        {
          id: "prompt-1",
          createdAt: "2026-06-01T01:00:00.000Z",
          label: "自然光 Prompt",
          value: { prompt: "自然光咖啡馆桌面近景" },
          basedOnEvidenceIds: ["insight-visual"]
        }
      ]
    });

    const cards = buildCreationProvenance(project);

    expect(cards.map((card) => card.state)).toEqual(["ready", "ready", "ready"]);
    expect(cards[0].sourceLine).toContain("实时");
    expect(cards[0].sourceLine).toContain("爆款库");
    expect(cards[0].safetyLine).toContain("原创边界");
    expect(cards[0].safetyLine).toContain("不复制原文");
    expect(cards[1].detail).toContain("4/4");
    expect(cards[1].safetyLine).toContain("自己的产品场景");
    expect(cards[2].headline).toBe("图片方向已确认");
    expect(cards[2].safetyLine).toContain("原创边界");
  });

  it("warns when a draft cites missing evidence or visual direction is unconfirmed", () => {
    const project = createBlankPostProject({
      topic: "广州咖啡馆",
      evidencePack: {
        sampleIds: [],
        insights: [insight("insight-copy", "realtime", "copy", "正文结构")]
      },
      copyDraft: {
        id: "draft-1",
        updatedAt: "2026-06-01T00:00:00.000Z",
        images: [],
        visibility: "仅自己可见",
        draft: {
          title: "标题",
          content: "正文",
          tags: ["tag"],
          structure: [],
          imagePrompt: "图片方向",
          basedOnEvidenceIds: ["missing-evidence"]
        }
      },
      visualDirection: {
        mood: "自然光",
        composition: "桌面近景",
        colorPalette: "暖白",
        mustHave: [],
        mustAvoid: [],
        basedOnEvidenceIds: ["missing-visual"]
      }
    });

    const cards = buildCreationProvenance(project);

    expect(cards.find((card) => card.id === "copy")?.state).toBe("warn");
    expect(cards.find((card) => card.id === "visual")?.state).toBe("empty");
    expect(cards.find((card) => card.id === "visual")?.missingCount).toBeGreaterThan(0);
  });

  it("separates weak viral references in provenance source lines", () => {
    const project = createBlankPostProject({
      topic: "广州咖啡馆",
      evidencePack: {
        sampleIds: ["weak-note"],
        insights: [
          insight("weak-viral", "viral_library", "copy", "弱参考：低质量样本里的泛泛结构")
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
        basedOnEvidenceIds: ["weak-viral"]
      }
    });

    const [briefCard] = buildCreationProvenance(project);

    expect(briefCard.weakViralEvidenceCount).toBe(1);
    expect(briefCard.sourceLine).toContain("爆款库 1（弱参考 1）");
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
