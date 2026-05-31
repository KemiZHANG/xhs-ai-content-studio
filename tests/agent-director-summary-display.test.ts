import { describe, expect, it } from "vitest";
import { extractAgentDirectorSummaryDisplay } from "@/app/components/agent-director-summary-display";
import type { AgentResponseCard } from "@/app/types";

describe("agent director summary display", () => {
  it("normalizes director summary card data for compact Post Studio display", () => {
    const card: AgentResponseCard = {
      id: "card-director-summary",
      type: "director_summary",
      title: "我会按当前项目阶段推进",
      summary: "阶段：生成文案 · 下一步：规划图片",
      data: {
        stageTitle: "生成第一版文案",
        stageDescription: "Brief 已准备好，可以生成原创标题、正文、标签。",
        why: "文案和图片方向会共享同一个 CreativeBrief。",
        nextAction: "plan_visuals",
        nextActionLabel: "规划图片",
        progress: 64.4,
        blockerCount: 2,
        evidenceCount: 9,
        hasDraft: true,
        needsUserInput: false
      }
    };

    expect(extractAgentDirectorSummaryDisplay(card)).toEqual({
      stageTitle: "生成第一版文案",
      stageDescription: "Brief 已准备好，可以生成原创标题、正文、标签。",
      why: "文案和图片方向会共享同一个 CreativeBrief。",
      nextAction: "plan_visuals",
      nextActionLabel: "规划图片",
      progress: 64,
      blockerCount: 2,
      evidenceCount: 9,
      hasDraft: true,
      needsUserInput: false
    });
  });

  it("ignores unrelated cards and clamps invalid progress", () => {
    expect(extractAgentDirectorSummaryDisplay({
      id: "stage",
      type: "stage_guidance",
      title: "下一步",
      summary: "summary"
    })).toBeNull();

    expect(extractAgentDirectorSummaryDisplay({
      id: "director",
      type: "director_summary",
      title: "需要判断",
      summary: "summary",
      data: {
        progress: 180,
        blockerCount: -4,
        evidenceCount: 3.8
      }
    })).toMatchObject({
      progress: 100,
      blockerCount: 0,
      evidenceCount: 4,
      nextActionLabel: "继续下一步"
    });
  });
});
