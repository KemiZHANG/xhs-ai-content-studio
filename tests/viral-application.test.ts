import { describe, expect, it } from "vitest";
import { buildViralApplicationModel } from "@/app/components/viral-application";
import { createBlankPostProject } from "@/lib/post-project/store";

const viralInsight = {
  id: "viral-insight-hook",
  sourceType: "viral_library" as const,
  type: "hook" as const,
  insight: "标题先给可收藏结论，再说明适用场景",
  sourceSampleIds: ["viral-case-1"],
  confidence: 0.86,
  createdAt: "2026-05-31T00:00:00.000Z"
};

describe("viral application model", () => {
  it("asks users to refresh RAG before applying viral knowledge", () => {
    const model = buildViralApplicationModel(createBlankPostProject({ topic: "广州咖啡馆" }));

    expect(model.evidenceCount).toBe(0);
    expect(model.actions).toEqual([
      { id: "viral-refresh-rag", label: "刷新 RAG 证据", action: "retrieve_viral_knowledge", primary: true }
    ]);
  });

  it("promotes applying viral evidence to CreativeBrief before generating outputs", () => {
    const project = createBlankPostProject({
      topic: "广州咖啡馆",
      evidencePack: { sampleIds: ["viral-case-1"], insights: [viralInsight] }
    });
    const model = buildViralApplicationModel(project);

    expect(model.evidenceCount).toBe(1);
    expect(model.headline).toContain("evidencePack");
    expect(model.actions[0]).toMatchObject({ action: "create_creative_brief", primary: true });
  });

  it("moves users from viral-enhanced Brief to copy and visual planning", () => {
    const project = createBlankPostProject({
      topic: "广州咖啡馆",
      evidencePack: { sampleIds: ["viral-case-1"], insights: [viralInsight] },
      creativeBrief: {
        audience: "周末探店人群",
        painPoint: "怕踩雷",
        contentAngle: "真实避坑探店",
        emotionalHook: "先给结论",
        proofPoints: ["排队", "人均", "出片点"],
        tone: "真实分享",
        visualMood: "自然光",
        imageMustHave: ["店内空间"],
        imageMustAvoid: ["虚假认证"],
        platformStyle: "小红书图文",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["viral-insight-hook"]
      }
    });
    const model = buildViralApplicationModel(project);

    expect(model.headline).toContain("已接入创作链路");
    expect(model.actions.map((action) => action.action)).toEqual(["generate_copy", "plan_visuals"]);
  });
});
