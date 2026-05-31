import { describe, expect, it } from "vitest";
import { buildPostNextStepCoach } from "@/app/components/post-next-step-coach";
import { getOrderedPostNextActions, getPostStageGuidance } from "@/lib/post-project/guidance";
import { buildPostReadinessReport } from "@/lib/post-project/readiness";
import { createBlankPostProject } from "@/lib/post-project/store";

describe("post next step coach", () => {
  it("promotes the readiness next action and explains the first blocker", () => {
    const project = createBlankPostProject({
      topic: "广州咖啡馆",
      currentStage: "evidence_ready",
      allowedActions: ["create_creative_brief", "search_research"]
    });
    const guidance = getPostStageGuidance(project.currentStage, project.allowedActions);
    const readiness = buildPostReadinessReport(project);
    const coach = buildPostNextStepCoach({
      guidance,
      readiness,
      nextActions: getOrderedPostNextActions(project.currentStage, project.allowedActions)
    });

    expect(coach.headline).toBe("生成 CreativeBrief");
    expect(coach.primaryAction).toBe("search_research");
    expect(coach.primaryLabel).toBe("搜索笔记");
    expect(coach.detail).toContain("研究证据");
    expect(coach.progressLine).toContain("准备度");
  });

  it("keeps fallback actions concise", () => {
    const guidance = getPostStageGuidance("copy_ready", ["revise_copy", "plan_visuals", "generate_cards", "assemble_post"]);
    const coach = buildPostNextStepCoach({
      guidance,
      readiness: null,
      nextActions: ["plan_visuals", "revise_copy", "generate_cards", "assemble_post"]
    });

    expect(coach.primaryAction).toBe("plan_visuals");
    expect(coach.primaryLabel).toBe("规划图片");
    expect(coach.secondaryActions.map((item) => item.label)).toEqual(["修改文案", "生成卡片"]);
  });
});
