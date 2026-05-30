import { describe, expect, it } from "vitest";
import { runPostQualityGate } from "@/lib/post-project/quality";

const now = "2026-05-30T00:00:00.000Z";

describe("quality gate viral originality review", () => {
  it("blocks near-copying viral-library source samples", () => {
    const quality = runPostQualityGate({
      creativeBrief: {
        audience: "local cafe explorers",
        painPoint: "hard to judge quiet seats and crowd level",
        contentAngle: "quiet work cafe + real seat/noise evidence",
        emotionalHook: "avoid wasting a weekend trip",
        proofPoints: ["seat spacing", "noise", "average spend"],
        tone: "honest and practical",
        visualMood: "window light, table texture, checklist cover",
        imageMustHave: ["window light"],
        imageMustAvoid: ["do not copy source images"],
        platformStyle: "xiaohongshu",
        tabooWords: [],
        complianceNotes: ["learn the pattern but do not copy source wording or images"],
        basedOnEvidenceIds: ["viral-insight-hook", "viral-insight-visual"]
      },
      visualDirection: {
        mood: "window light",
        composition: "table texture with checklist cover",
        colorPalette: "warm natural light",
        mustHave: ["window light"],
        mustAvoid: ["do not copy source images"],
        basedOnEvidenceIds: ["viral-insight-visual"]
      },
      selectedImages: ["asset-1"],
      evidencePack: {
        sampleIds: ["viral-case-1"],
        insights: [
          {
            id: "viral-insight-hook",
            sourceType: "viral_library",
            type: "hook",
            insight: "Use a quiet work cafe avoid-disappointment hook",
            sourceSampleIds: ["viral-case-1"],
            confidence: 0.86,
            createdAt: now
          },
          {
            id: "viral-insight-visual",
            sourceType: "viral_library",
            type: "visual",
            insight: "Window light and checklist cover",
            sourceSampleIds: ["viral-case-1"],
            confidence: 0.78,
            createdAt: now
          }
        ],
        summary: {
          viralKnowledge: {
            strategyReport: {
              originalityRules: ["learn the pattern but do not copy source wording or images"],
              evidenceIds: ["viral-insight-hook", "viral-insight-visual"]
            },
            results: [
              {
                case: {
                  id: "viral-case-1",
                  title: "Quiet Guangzhou cafe guide for laptop work",
                  bodyExcerpt: "Start with who it is for, then compare noise, seats, power outlets, price, and best arrival time.",
                  extractedInsights: {
                    avoidCopying: ["do not copy title wording"]
                  },
                  creativeSafety: {
                    doNotCopy: ["do not copy source wording"],
                    transformationGuidance: ["replace with your own scene and proof"]
                  }
                }
              }
            ]
          }
        }
      },
      finalPost: {
        title: "Quiet Guangzhou cafe guide for laptop work",
        content: "Start with who it is for, then compare noise, seats, power outlets, price, and best arrival time. This paragraph is intentionally close to the saved viral source sample.",
        tags: ["cafe", "guangzhou"],
        imageIds: ["asset-1"],
        imagePromptVersionIds: ["prompt-1"]
      },
      copyDraft: {
        id: "draft-viral-copy",
        updatedAt: now,
        draft: {
          title: "Quiet Guangzhou cafe guide for laptop work",
          content: "Start with who it is for, then compare noise, seats, power outlets, price, and best arrival time. This paragraph is intentionally close to the saved viral source sample.",
          tags: ["cafe", "guangzhou"],
          structure: ["audience", "scene", "proof"],
          imagePrompt: "window light cafe cover",
          basedOnEvidenceIds: ["viral-insight-hook", "viral-insight-visual"],
          evidenceReferences: {
            title: ["viral-insight-hook"],
            content: ["viral-insight-hook"],
            tags: ["viral-insight-hook"],
            imagePrompt: ["viral-insight-visual"]
          }
        },
        images: [],
        visibility: "仅自己可见"
      }
    });

    expect(quality.canPublish).toBe(false);
    expect(quality.originalityReview?.isSafe).toBe(false);
    expect(quality.originalityReview?.riskSamples).toContain("Quiet Guangzhou cafe guide for laptop work");
    expect(quality.issues.join(" ")).toContain("爆款库原创边界风险");
    expect(quality.suggestions.join(" ")).toContain("避免贴近历史爆款样本");
  });
});
