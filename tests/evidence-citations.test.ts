import { describe, expect, it } from "vitest";
import { buildEvidenceCitationReport, formatEvidenceCitationReport } from "@/lib/post-project/citations";
import type { PostProject } from "@/lib/post-project/types";

const now = "2026-05-30T00:00:00.000Z";

function project(): Pick<PostProject, "evidencePack" | "creativeBrief"> {
  return {
    creativeBrief: {
      audience: "广州咖啡馆探店人群",
      painPoint: "怕踩雷、不知道是否适合拍照",
      contentAngle: "真实避坑探店",
      emotionalHook: "先给结论再给细节",
      proofPoints: ["人均", "排队", "座位"],
      tone: "真实生活化",
      visualMood: "自然光、窗边、低饱和",
      imageMustHave: ["窗边座位", "菜单细节"],
      imageMustAvoid: ["过度滤镜"],
      platformStyle: "小红书真实分享",
      tabooWords: ["全网第一"],
      complianceNotes: ["不虚构价格和官方背书"],
      basedOnEvidenceIds: ["insight-user", "insight-live", "viral-insight-visual"]
    },
    evidencePack: {
      sampleIds: ["note-live", "viral-case"],
      insights: [
        {
          id: "insight-user",
          sourceType: "user_input",
          type: "audience",
          insight: "用户明确希望面向探店账号，语气真实。",
          sourceSampleIds: ["user-brief"],
          confidence: 0.9,
          createdAt: now
        },
        {
          id: "insight-live",
          sourceType: "realtime",
          type: "title",
          insight: "实时高收藏笔记常把适合人群和避坑结论前置。",
          sourceSampleIds: ["note-live"],
          confidence: 0.82,
          createdAt: now
        },
        {
          id: "viral-insight-visual",
          sourceType: "viral_library",
          type: "visual",
          insight: "爆款库规律显示封面要突出自然光、座位和菜单信息密度。",
          sourceSampleIds: ["viral-case"],
          confidence: 0.78,
          createdAt: now
        }
      ]
    }
  };
}

describe("evidence citation report", () => {
  it("builds a field-level citation report across user, realtime, and viral evidence", () => {
    const report = buildEvidenceCitationReport(project(), ["insight-live"], {
      title: ["insight-live"],
      content: ["insight-user", "insight-live"],
      tags: ["insight-live"],
      imagePrompt: ["viral-insight-visual"]
    });

    expect(report.hasUserInputEvidence).toBe(true);
    expect(report.hasRealtimeEvidence).toBe(true);
    expect(report.hasViralEvidence).toBe(true);
    expect(report.missingEvidenceIds).toEqual([]);
    expect(report.sections.find((section) => section.field === "imagePrompt")?.insights[0]?.sourceType).toBe("viral_library");
    expect(report.summary).toContain("实时研究");
    expect(report.summary).toContain("爆款库");
  });

  it("flags missing evidence ids and weak source diversity", () => {
    const base = project();
    const viralOnlyProject = {
      ...base,
      creativeBrief: {
        ...base.creativeBrief!,
        basedOnEvidenceIds: ["viral-insight-visual"]
      }
    };
    const report = buildEvidenceCitationReport(viralOnlyProject, ["viral-insight-visual"], {
      title: ["viral-insight-visual"],
      content: ["missing-id"],
      tags: ["viral-insight-visual"],
      imagePrompt: ["viral-insight-visual"]
    });

    expect(report.missingEvidenceIds).toEqual(["missing-id"]);
    expect(report.warnings.join(" ")).toContain("证据 ID 不在当前 evidencePack");
    expect(report.warnings.join(" ")).toContain("建议补充实时小红书证据");
  });

  it("formats a concise explanation suitable for Agent replies", () => {
    const report = buildEvidenceCitationReport(project(), ["insight-live"], {
      title: ["insight-live"],
      content: ["insight-user"],
      tags: ["insight-live"],
      imagePrompt: ["viral-insight-visual"]
    });
    const formatted = formatEvidenceCitationReport(report);

    expect(formatted).toContain("这版为什么这样写");
    expect(formatted).toContain("标题");
    expect(formatted).toContain("图片方向");
    expect(formatted).toContain("viral-insight-visual");
  });
});
