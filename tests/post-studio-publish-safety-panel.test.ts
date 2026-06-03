import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PostStudioPublishSafetyPanel } from "@/app/components/post-studio-publish-safety-panel";
import type { PublishAccountSafety } from "@/app/components/publish-account-safety";
import type { PublishAuditSafetySummary } from "@/app/components/publish-audit-summary";
import type { PublishConfirmationSummary } from "@/app/components/publish-confirmation-summary";

const publishSummary: PublishConfirmationSummary = {
  headline: "发布确认单已生成",
  detail: "请最后核对账号、可见范围、时间、文案和图片版本。",
  modeLabel: "定时发布",
  accountLine: "咖啡探店号",
  accountSafetyLine: "咖啡探店号 · MCP localhost:18060",
  timingLine: "2026-06-02T20:00:00+08:00",
  visibilityLine: "仅自己可见",
  contentLine: "标题 18 字 / 正文 260 字 / 标签 5 个",
  imageLine: "3 张图片，图片方向已确认",
  evidenceLine: "字段级证据可追溯，引用 6 条证据",
  evidenceSourceLine: "证据来源：实时 4 / 爆款库 2 / 用户输入 1",
  versionLine: "版本快照已锁定",
  qualityLine: "Quality Gate 通过",
  checklistLine: "人工确认 2/3 项",
  decisionLine: "等待人工确认",
  nextStepLine: "下一步：确认图片版本",
  detailCompressionLine: "默认只显示发布结论和主要阻塞项。",
  confirmationItems: [
    { label: "账号确认", confirmed: true, required: true, detail: "当前账号一致" },
    { label: "图片确认", confirmed: false, required: true, detail: "仍需核对第二张图" },
    { label: "定时时间", confirmed: false, required: false }
  ],
  manualReviewChecklist: [
    "账号：咖啡探店号",
    "可见范围：仅自己可见",
    "发布时间：定时 2026-06-02T20:00:00+08:00",
    "图片版本：3 张选中图片"
  ],
  visibleBlockers: ["图片版本仍需确认"],
  riskLevel: "warn",
  blockers: ["图片版本仍需确认", "人工确认未完成"]
};

const publishAccountSafety: PublishAccountSafety = {
  status: "warn",
  headline: "发布账号可继续，但确认单尚未锁定",
  detail: "生成确认单时会锁定当前账号、登录名和 MCP 地址。",
  activeAccountLine: "咖啡探店号 · ID main",
  lockedAccountLine: "尚未生成发布确认单",
  canCreateConfirmation: true,
  canConfirmExisting: false,
  checks: [
    { label: "当前账号检测", detail: "小红书已登录", ok: true, severity: "ok" },
    { label: "确认单账号绑定", detail: "生成时会写入当前账号", ok: true, severity: "warn" }
  ]
};

const auditSummary: PublishAuditSafetySummary = {
  headline: "最近一次发布动作等待确认",
  detail: "确认单已记录，但真实发布仍需要人工确认。",
  state: "neutral",
  eventLabel: "待人工确认",
  title: "广州咖啡馆周末探店",
  createdAt: "2026-06-02T10:00:00.000Z",
  reasonLine: "等待图片确认",
  evidenceLine: "引用 6 条证据",
  accountLine: "咖啡探店号",
  shouldReviewHistory: true
};

describe("post studio publish safety panel", () => {
  it("renders publish snapshot, account safety, and audit summary", () => {
    const html = renderToStaticMarkup(createElement(PostStudioPublishSafetyPanel, {
      publishSummary,
      publishAccountSafety,
      auditSummary,
      onNavigate: () => undefined
    }));

    expect(html).toContain("发布确认单已生成");
    expect(html).toContain("定时发布");
    expect(html).toContain("人工确认清单摘要");
    expect(html).toContain("发布前人工复核清单");
    expect(html).toContain("图片版本：3 张选中图片");
    expect(html).toContain("详细发布快照");
    expect(html).toContain("图片版本仍需确认");
    expect(html).toContain("账号安全锁");
    expect(html).toContain("发布账号可继续");
    expect(html).toContain("当前账号检测");
    expect(html).toContain("最近发布审计");
    expect(html).toContain("最近一次发布动作等待确认");
    expect(html).toContain("查看完整发布历史");
  });
});
