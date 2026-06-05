import { describe, expect, it } from "vitest";
import { buildViralApplicationModel } from "@/app/components/viral-application";
import { createBlankPostProject } from "@/lib/post-project/store";

const mojibakePattern = /[�]|鈮|骞|鎺|涓|鐖|鍥剧|鏂囨|璇佹|鎼滅|寰呯|缁х/u;

const viralInsight = {
  id: "viral-insight-hook",
  sourceType: "viral_library" as const,
  type: "hook" as const,
  insight: "标题先给可收藏结论，再说明适用场景",
  sourceSampleIds: ["viral-case-1"],
  confidence: 0.86,
  createdAt: "2026-05-31T00:00:00.000Z"
};

function expectModelFreeFromMojibake(model: unknown): void {
  expect(JSON.stringify(model)).not.toMatch(mojibakePattern);
}

describe("viral application model", () => {
  it("asks users to refresh RAG before applying viral knowledge", () => {
    const model = buildViralApplicationModel(createBlankPostProject({ topic: "广州咖啡馆" }));

    expectModelFreeFromMojibake(model);
    expect(model.evidenceCount).toBe(0);
    expect(model.focusedCount).toBe(0);
    expect(model.routes.map((route) => route.status)).toEqual(["empty", "empty", "empty"]);
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

    expectModelFreeFromMojibake(model);
    expect(model.evidenceCount).toBe(1);
    expect(model.headline).toContain("evidencePack");
    expect(model.routes[0]).toMatchObject({
      id: "brief",
      status: "pending",
      evidenceIds: ["viral-insight-hook"]
    });
    expect(model.ragStatus).toBe("none");
    expect(model.ragLine).toContain("还没有");
    expect(model.routes[1].status).toBe("empty");
    expect(model.actions[0]).toMatchObject({ action: "create_creative_brief", primary: true });
  });

  it("surfaces insufficient RAG evidence before users treat viral knowledge as complete", () => {
    const project = createBlankPostProject({
      topic: "广州咖啡馆",
      evidencePack: {
        sampleIds: ["viral-case-1"],
        insights: [viralInsight],
        summary: {
          viralKnowledge: {
            sufficiency: {
              isEnough: false,
              realtimeCount: 1,
              viralCount: 1,
              weakViralCount: 2,
              missing: ["实时小红书样本不足 3 条", "缺少图片风格规律"],
              recommendation: "建议继续搜索或补充参考样本。"
            }
          }
        }
      }
    });
    const model = buildViralApplicationModel(project);

    expectModelFreeFromMojibake(model);
    expect(model.ragStatus).toBe("insufficient");
    expect(model.headline).toContain("需要补强");
    expect(model.readinessGate).toMatchObject({
      status: "caution",
      label: "先补证据再生成关键稿件"
    });
    expect(model.ragLine).toContain("实时 1 条");
    expect(model.ragLine).toContain("可用爆款 1 条");
    expect(model.ragLine).toContain("弱参考 2 条");
    expect(model.missingEvidence).toEqual(["实时小红书样本不足 3 条", "缺少图片风格规律"]);
    expect(model.recommendation).toBe("建议继续搜索或补充参考样本。");
    expect(model.actions.slice(0, 2).map((action) => action.action)).toEqual(["search_research", "retrieve_viral_knowledge"]);
    expect(model.actions[0].primary).toBe(true);
  });

  it("does not offer key creative output actions while RAG evidence is insufficient", () => {
    const project = createBlankPostProject({
      topic: "广州咖啡馆",
      evidencePack: {
        sampleIds: ["viral-case-1"],
        insights: [viralInsight],
        summary: {
          viralKnowledge: {
            sufficiency: {
              isEnough: false,
              realtimeCount: 1,
              viralCount: 1,
              missing: ["实时小红书样本不足 3 条"],
              recommendation: "建议继续搜索。"
            }
          }
        }
      },
      creativeBrief: {
        audience: "周末探店人群",
        painPoint: "怕踩雷",
        contentAngle: "真实避坑探店",
        emotionalHook: "先给结论",
        proofPoints: ["排队", "人均"],
        tone: "真实分享",
        visualMood: "自然光",
        imageMustHave: ["店内空间"],
        imageMustAvoid: ["虚假 logo"],
        platformStyle: "小红书图文",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["viral-insight-hook"]
      }
    });
    const model = buildViralApplicationModel(project);

    expect(model.readinessGate.status).toBe("caution");
    expect(model.actions.map((action) => action.action)).toEqual(["search_research", "retrieve_viral_knowledge"]);
    expect(model.actions.map((action) => action.action)).not.toContain("generate_copy");
    expect(model.actions.map((action) => action.action)).not.toContain("plan_visuals");
  });

  it("marks RAG as enough when realtime and viral evidence pass sufficiency", () => {
    const project = createBlankPostProject({
      topic: "广州咖啡馆",
      evidencePack: {
        sampleIds: ["viral-case-1"],
        insights: [viralInsight],
        summary: {
          viralKnowledge: {
            sufficiency: {
              isEnough: true,
              realtimeCount: 4,
              viralCount: 3,
              weakViralCount: 1,
              missing: [],
              recommendation: "证据足够进入 CreativeBrief。"
            }
          }
        }
      }
    });
    const model = buildViralApplicationModel(project);

    expectModelFreeFromMojibake(model);
    expect(model.ragStatus).toBe("enough");
    expect(model.readinessGate).toMatchObject({
      status: "pending",
      label: "先应用到 CreativeBrief"
    });
    expect(model.ragLine).toContain("实时 4 条");
    expect(model.ragLine).toContain("可用爆款 3 条");
    expect(model.ragLine).toContain("弱参考 1 条");
    expect(model.missingEvidence).toEqual([]);
  });

  it("shows when viral evidence has been selected as this post's focus", () => {
    const project = createBlankPostProject({
      topic: "广州咖啡馆",
      evidencePack: {
        sampleIds: ["viral-case-1"],
        insights: [viralInsight],
        summary: {
          viralKnowledge: {
            sufficiency: {
              isEnough: true,
              realtimeCount: 4,
              viralCount: 3,
              missing: [],
              recommendation: "证据足够进入 CreativeBrief。"
            }
          }
        }
      },
      focusedEvidenceIds: ["viral-insight-hook"]
    });
    const model = buildViralApplicationModel(project);

    expectModelFreeFromMojibake(model);
    expect(model.focusedCount).toBe(1);
    expect(model.headline).toContain("重点");
    expect(model.routes[0].evidenceIds).toEqual(["viral-insight-hook"]);
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

    expectModelFreeFromMojibake(model);
    expect(model.headline).toContain("已接入创作链路");
    expect(model.readinessGate.status).toBe("pending");
    expect(model.routes.map((route) => route.status)).toEqual(["ready", "pending", "pending"]);
    expect(model.citedEvidenceIds).toEqual(["viral-insight-hook"]);
    expect(model.actions.map((action) => action.action)).toEqual(["generate_copy", "plan_visuals"]);
  });

  it("shows which creative outputs already cite viral evidence", () => {
    const project = createBlankPostProject({
      topic: "广州咖啡馆",
      evidencePack: {
        sampleIds: ["viral-case-1"],
        insights: [viralInsight],
        summary: {
          viralKnowledge: {
            sufficiency: {
              isEnough: true,
              realtimeCount: 4,
              viralCount: 3,
              missing: [],
              recommendation: "证据足够进入 CreativeBrief。"
            }
          }
        }
      },
      creativeBrief: {
        audience: "周末探店人群",
        painPoint: "怕踩雷",
        contentAngle: "真实避坑探店",
        emotionalHook: "先给结论",
        proofPoints: ["排队", "人均", "出片点"],
        tone: "真实分享",
        visualMood: "自然光",
        imageMustHave: ["店内空间"],
        imageMustAvoid: ["虚假 logo"],
        platformStyle: "小红书图文",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["viral-insight-hook"]
      },
      copyDraft: {
        id: "draft-1",
        updatedAt: "2026-05-31T00:00:00.000Z",
        draft: {
          title: "广州咖啡馆先说结论",
          content: "这家适合周末去。",
          tags: ["广州咖啡", "周末探店"],
          structure: ["先结论", "再场景"],
          imagePrompt: "自然光咖啡馆封面",
          basedOnEvidenceIds: ["viral-insight-hook"]
        },
        images: [],
        visibility: "仅自己可见"
      },
      visualDirection: {
        mood: "自然光",
        composition: "封面先展示空间和招牌",
        colorPalette: "暖白和木色",
        mustHave: ["门头", "座位区"],
        mustAvoid: ["虚假 logo"],
        basedOnEvidenceIds: ["viral-insight-hook"]
      }
    });
    const model = buildViralApplicationModel(project);

    expectModelFreeFromMojibake(model);
    expect(model.routes.map((route) => route.status)).toEqual(["ready", "ready", "ready"]);
    expect(model.readinessGate.detail).toContain("CreativeBrief 已引用爆款证据");
    expect(model.routes.every((route) => route.evidenceIds.includes("viral-insight-hook"))).toBe(true);
    expect(model.actions[0]).toMatchObject({ action: "retrieve_viral_knowledge" });
  });

  it("counts image prompt citations as visual viral evidence", () => {
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
        imageMustAvoid: ["虚假 logo"],
        platformStyle: "小红书图文",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["viral-insight-hook"]
      },
      imagePrompts: [{
        id: "prompt-viral-1",
        label: "自然光封面",
        createdAt: "2026-05-31T00:00:00.000Z",
        value: { prompt: "自然光咖啡馆封面，突出空间层次" },
        basedOnEvidenceIds: ["viral-insight-hook"]
      }]
    });
    const model = buildViralApplicationModel(project);

    expectModelFreeFromMojibake(model);
    expect(model.routes.find((route) => route.id === "visual")).toMatchObject({
      status: "ready",
      evidenceIds: ["viral-insight-hook"]
    });
    expect(model.citedEvidenceIds).toContain("viral-insight-hook");
    expect(model.actions.map((action) => action.action)).toEqual(["generate_copy"]);
  });
});
