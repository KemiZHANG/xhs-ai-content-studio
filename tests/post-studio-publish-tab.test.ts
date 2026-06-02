import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PublishAccountSafety } from "@/app/components/publish-account-safety";
import type { PublishAuditSafetySummary } from "@/app/components/publish-audit-summary";
import type { PublishConfirmationSummary } from "@/app/components/publish-confirmation-summary";
import type { PublishSafetyBoundaryModel } from "@/app/components/publish-safety-boundary";
import { buildPublishFocusModel, PostStudioPublishTab } from "@/app/components/post-studio-publish-tab";
import type { PublishDraftState } from "@/app/types";

const publishDraft: PublishDraftState = {
  title: "广州咖啡馆收藏攻略",
  content: "正文内容",
  tagsText: "广州探店,咖啡馆",
  imagePrompt: "明亮真实探店图"
};

describe("post studio publish tab", () => {
  it("compresses publish blockers into a short first-screen focus model", () => {
    const model = buildPublishFocusModel({
      visibleBlockers: ["缺少图片", "未确认账号", "Quality Gate 过期", "定时时间无效"]
    } as unknown as PublishConfirmationSummary);

    expect(model.blockerPreview).toEqual(["缺少图片", "未确认账号", "Quality Gate 过期"]);
    expect(model.blockerActions[0]).toMatchObject({ text: "缺少图片", action: "select_images", actionLabel: "选择图片" });
    expect(model.blockerActions[1]).toMatchObject({ text: "未确认账号" });
    expect(model.blockerActions[2]).toMatchObject({ text: "Quality Gate 过期", action: "run_quality_gate" });
    expect(model.hiddenBlockerCount).toBe(1);
    expect(model.hasBlockers).toBe(true);
  });

  it("renders readable publish safety checks and confirmation actions", () => {
    const html = renderToStaticMarkup(createElement(PostStudioPublishTab, {
      summary: {
        headline: "可以生成发布确认单",
        detail: "Quality Gate 和账号状态已满足。",
        state: "ready",
        primaryActionLabel: "生成确认单",
        primaryAction: "request_publish_confirmation"
      },
      publishDraft,
      selectedImageCount: 2,
      hasVisualDirection: true,
      citationTraceReady: true,
      qualityGateFresh: true,
      accountReady: true,
      activeAccountLabel: "测试账号",
      accountReadyHint: "已登录",
      publishVisibility: "仅自己可见",
      publishScheduleAt: "",
      defaultAutoPublish: false,
      publishReady: true,
      quality: undefined,
      qualityViralCoverage: {
        hasCoverage: false,
        headline: "爆款库覆盖待检查",
        detail: "运行 Quality Gate 后展示。",
        items: []
      },
      citationReport: null,
      publishSummary: {
        riskLevel: "ok",
        headline: "发布前安全摘要",
        detail: "需要人工确认后才会发布。",
        modeLabel: "安全模式",
        decisionLine: "可以进入人工确认",
        nextStepLine: "下一步生成确认单。",
        detailCompressionLine: "详细项默认折叠。",
        confirmationItems: [{ label: "确认账号", detail: "测试账号", required: true, confirmed: false }],
        visibleBlockers: [],
        blockers: [],
        accountLine: "测试账号",
        accountSafetyLine: "已登录",
        timingLine: "立即发布",
        visibilityLine: "仅自己可见",
        contentLine: "标题/正文/标签已填写",
        imageLine: "2 张图片",
        evidenceLine: "证据可追溯",
        evidenceSourceLine: "实时 + 爆款库",
        versionLine: "版本已锁定",
        qualityLine: "已通过",
        checklistLine: "待人工确认"
      } as unknown as PublishConfirmationSummary,
      publishAccountSafety: {
        status: "ready",
        headline: "账号可用",
        detail: "当前账号和确认单一致。",
        activeAccountLine: "测试账号",
        lockedAccountLine: "测试账号",
        canConfirmExisting: true,
        checks: [{ label: "账号一致", detail: "可以确认", ok: true, severity: "ok" }]
      } as unknown as PublishAccountSafety,
      auditSummary: {
        state: "empty",
        headline: "暂无发布审计",
        detail: "发布后会记录。",
        eventLabel: "无",
        accountLine: "测试账号"
      } as unknown as PublishAuditSafetySummary,
      publishSafetyBoundary: {
        state: "ready",
        headline: "发布安全边界已满足",
        detail: "自动发布默认关闭。",
        checkpoints: ["人工确认", "仅自己可见"]
      } as unknown as PublishSafetyBoundaryModel,
      activePublishPlan: null,
      requiredConfirmations: [],
      confirmedRequiredCount: 0,
      pendingPublish: null,
      activeLoginName: "xhs-user",
      hasExistingVisualDirection: true,
      busy: false,
      staleAccountPublishPlan: null,
      staleCanvasPublishPlan: false,
      onNavigate: () => undefined,
      onVisibilityChange: () => undefined,
      onScheduleAtChange: () => undefined,
      onQuickAction: () => undefined,
      onCancelPublish: () => undefined,
      onConfirmPublish: () => undefined,
      onPreparePublish: () => undefined,
      onOpenPublish: () => undefined
    }));

    expect(html).toContain("发布检查");
    expect(html).toContain("安全边界：本页只生成发布确认单");
    expect(html).toContain("一句话指令不会直接发到小红书");
    expect(html).toContain("发布目标确认摘要");
    expect(html).toContain("发布目标");
    expect(html).toContain("测试账号");
    expect(html).toContain("登录名：xhs-user");
    expect(html).toContain("可见范围");
    expect(html).toContain("仅自己可见");
    expect(html).toContain("自动发布");
    expect(html).toContain("默认关闭");
    expect(html).toContain("可以进入人工确认");
    expect(html).toContain("下一步只会生成发布确认单");
    expect(html).toContain("详细发布检查");
    expect(html).toContain("发布详情与审计");
    expect(html).toContain("确认单、Quality Gate、账号安全和审计记录");
    expect(html).toContain("标题已填写");
    expect(html).toContain("发布前安全摘要");
    expect(html).toContain("发布安全边界已满足");
    expect(html).toContain("生成发布确认单");
  });
});
