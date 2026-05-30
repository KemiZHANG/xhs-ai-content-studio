import { describe, expect, it } from "vitest";
import { deriveCreativeBrief } from "@/lib/post-project/brief";
import type { PostProject } from "@/lib/post-project/types";

function project(overrides: Partial<PostProject> = {}): Pick<
  PostProject,
  "topic" | "productInfo" | "targetAudience" | "goal" | "tone" | "evidencePack" | "creativeBrief"
> {
  return {
    topic: "Guangzhou coffee shops",
    productInfo: { referenceAssetIds: [] },
    evidencePack: {
      sampleIds: ["viral-case-1"],
      insights: [
        {
          id: "viral-insight-hook",
          sourceType: "viral_library",
          type: "hook",
          insight: "Use an avoid-disappointment scene hook",
          sourceSampleIds: ["viral-case-1"],
          confidence: 0.82,
          createdAt: "2026-05-30T00:00:00.000Z"
        }
      ],
      summary: {
        viralKnowledge: {
          strategyReport: {
            titleMoves: ["start with a clear crowd and avoid-disappointment promise"],
            structureMoves: ["audience / scene / proof / reminder"],
            visualMoves: ["window light, table texture, checklist cover"],
            originalityRules: ["learn the pattern but do not copy source wording or images"],
            recommendedAngles: ["quiet work cafe + real seat/noise evidence"],
            evidenceIds: ["viral-case-1", "viral-insight-hook", "missing-insight"]
          }
        }
      },
      updatedAt: "2026-05-30T00:00:00.000Z"
    },
    creativeBrief: undefined,
    ...overrides
  };
}

describe("PostProject CreativeBrief", () => {
  it("uses viral strategy reports to enrich copy and visual direction", () => {
    const brief = deriveCreativeBrief(project());

    expect(brief?.contentAngle).toBe("quiet work cafe + real seat/noise evidence");
    expect(brief?.proofPoints).toContain("audience / scene / proof / reminder");
    expect(brief?.visualMood).toBe("window light, table texture, checklist cover");
    expect(brief?.imageMustHave).toContain("window light, table texture, checklist cover");
    expect(brief?.complianceNotes.join(" ")).toContain("do not copy source wording");
    expect(brief?.basedOnEvidenceIds).toContain("viral-insight-hook");
    expect(brief?.basedOnEvidenceIds).not.toContain("viral-case-1");
    expect(brief?.basedOnEvidenceIds).not.toContain("missing-insight");
  });

  it("keeps explicit user goal and tone ahead of viral recommendations", () => {
    const brief = deriveCreativeBrief(project({
      goal: "write a realistic cafe shortlist for first-time visitors",
      tone: "warm and practical"
    }));

    expect(brief?.contentAngle).toBe("write a realistic cafe shortlist for first-time visitors");
    expect(brief?.tone).toBe("warm and practical");
    expect(brief?.proofPoints).toContain("audience / scene / proof / reminder");
  });
});
