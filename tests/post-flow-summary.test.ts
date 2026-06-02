import { describe, expect, it } from "vitest";
import { buildPostFlowSummary } from "@/app/components/post-flow-summary";
import { buildPostReadinessReport } from "@/lib/post-project/readiness";
import { createBlankPostProject } from "@/lib/post-project/store";

describe("post flow summary", () => {
  it("guides a blank workspace to start with research", () => {
    const phases = buildPostFlowSummary(null);

    expect(phases.map((phase) => phase.label)).toEqual(["实时研究", "爆款库", "Brief", "文案", "图片", "检查发布"]);
    expect(phases[0]).toMatchObject({
      state: "active",
      detail: "先输入主题并开始研究"
    });
    expect(phases.slice(1).every((phase) => phase.state === "todo")).toBe(true);
  });

  it("guides evidence-ready projects to viral RAG before Brief", () => {
    const project = createBlankPostProject({
      topic: "广州咖啡馆",
      currentStage: "evidence_ready",
      allowedActions: ["retrieve_viral_knowledge", "create_creative_brief", "search_research"],
      selectedSamples: [{ id: "note-1" }],
      evidencePack: {
        sampleIds: ["note-1"],
        insights: [{
          id: "insight-title",
          sourceType: "realtime",
          type: "title",
          insight: "高收藏标题先给场景",
          sourceSampleIds: ["note-1"],
          confidence: 0.8,
          createdAt: "2026-06-01T00:00:00.000Z"
        }]
      }
    });
    const readiness = buildPostReadinessReport(project);
    const phases = buildPostFlowSummary(readiness);

    expect(phases).toHaveLength(6);
    expect(phases[0]).toMatchObject({ id: "research", state: "done" });
    expect(phases[1]).toMatchObject({
      id: "viral",
      state: "active",
      action: "retrieve_viral_knowledge"
    });
    expect(phases.filter((phase) => phase.state === "active")).toHaveLength(1);
    expect(phases[1].detail).toContain("历史爆款库规律");
  });

  it("marks early phases done and advances to visual work when copy is ready", () => {
    const project = createBlankPostProject({
      topic: "广州咖啡馆",
      currentStage: "copy_ready",
      allowedActions: ["plan_visuals"],
      selectedSamples: [{ id: "note-1" }],
      evidencePack: {
        summary: "探店样本",
        sampleIds: ["note-1"],
        insights: [
          {
            id: "insight-1",
            sourceType: "realtime",
            type: "title",
            insight: "标题突出场景",
            sourceSampleIds: ["note-1"],
            confidence: 0.8,
            createdAt: "2026-06-01T00:00:00.000Z"
          }
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
        basedOnEvidenceIds: ["insight-1"]
      },
      copyDraft: {
        id: "draft-1",
        updatedAt: "2026-06-01T00:00:00.000Z",
        draft: {
          title: "广州周末咖啡馆",
          content: "这几家适合安静坐一下午。",
          tags: ["广州咖啡馆"],
          structure: ["场景开头", "体验细节", "收藏理由"],
          imagePrompt: "自然光咖啡馆",
          basedOnEvidenceIds: ["insight-1"]
        },
        images: [],
        visibility: "仅自己可见"
      }
    });
    const phases = buildPostFlowSummary(buildPostReadinessReport(project));

    expect(phases.map((phase) => phase.state)).toEqual(["done", "done", "done", "done", "active", "todo"]);
    expect(phases[4].action).toBe("plan_visuals");
    expect(phases[4].actionLabel).toBe("规划图片");
  });
});
