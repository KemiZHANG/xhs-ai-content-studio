import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  getPublishScheduleBlocker,
  normalizePublishScheduleInput,
  PostStudioPublishReadinessPanel,
  toDatetimeLocalInputValue
} from "@/app/components/post-studio-publish-readiness-panel";
import type { PublishSafetyBoundaryModel } from "@/app/components/publish-safety-boundary";
import type { PendingPublishConfirmation, PublishDraftState } from "@/app/types";

const draft: PublishDraftState = {
  title: "广州咖啡馆周末探店",
  content: "这是一篇准备发布的小红书探店笔记。",
  tagsText: "#广州咖啡 #周末探店",
  imagePrompt: "自然光、真实探店、小红书图文风格"
};

const publishSafetyBoundary: PublishSafetyBoundaryModel = {
  state: "blocked",
  headline: "还不能进入发布确认",
  detail: "当前还有发布前阻塞项。",
  checkpoints: ["补齐内容", "通过 Quality Gate", "确认账号登录"]
};

const pendingPublish: PendingPublishConfirmation = {
  publishIntentId: "publish-1",
  mode: "schedule",
  createdAt: "2026-06-02T10:00:00.000Z",
  accountId: "main",
  accountDisplayName: "咖啡探店号",
  mcpUrl: "http://localhost:18060/mcp",
  loginName: "xiaohongshu-mcp",
  payload: {
    title: draft.title,
    content: draft.content,
    tags: ["广州咖啡", "周末探店"],
    assetIds: ["asset-1", "asset-2"],
    visibility: "仅自己可见",
    scheduleAt: "2026-06-02T20:00:00+08:00",
    imagePrompt: draft.imagePrompt
  }
};

describe("post studio publish readiness panel", () => {
  it("renders missing readiness items and quick fixes before publish is ready", () => {
    const html = renderToStaticMarkup(createElement(PostStudioPublishReadinessPanel, {
      publishVisibility: "仅自己可见",
      publishScheduleAt: "",
      publishReady: false,
      publishDraft: { ...draft, tagsText: "" },
      selectedImageCount: 0,
      hasVisualDirection: false,
      citationTraceReady: false,
      accountReady: false,
      quality: undefined,
      qualityGateFresh: false,
      pendingPublish: null,
      activeLoginName: undefined,
      publishSafetyBoundary,
      hasExistingVisualDirection: false,
      busy: false,
      onVisibilityChange: () => undefined,
      onScheduleAtChange: () => undefined,
      onQuickAction: () => undefined
    }));

    expect(html).toContain("可见范围");
    expect(html).toContain("定时时间");
    expect(html).toContain("发布前还需要处理");
    expect(html).toContain("标签");
    expect(html).toContain("发布图片");
    expect(html).toContain("字段级证据引用");
    expect(html).toContain("小红书登录账号");
    expect(html).toContain("发布安全边界");
    expect(html).toContain("补齐标题/正文/标签");
    expect(html).toContain("补文案");
    expect(html).toContain("补证据引用");
    expect(html).toContain("补证据");
    expect(html).toContain("规划图片方向");
    expect(html).toContain("运行质量检查");
    expect(html).toContain("选择发布图片");
  });

  it("routes creative fixes to viral RAG refresh when evidence is weak", () => {
    const html = renderToStaticMarkup(createElement(PostStudioPublishReadinessPanel, {
      publishVisibility: "仅自己可见",
      publishScheduleAt: "",
      publishReady: false,
      publishDraft: { ...draft, content: "", tagsText: "" },
      selectedImageCount: 0,
      hasVisualDirection: false,
      citationTraceReady: false,
      accountReady: true,
      quality: undefined,
      qualityGateFresh: false,
      pendingPublish: null,
      activeLoginName: "xiaohongshu-mcp",
      publishSafetyBoundary,
      hasExistingVisualDirection: false,
      ragCreativeBlocked: true,
      busy: false,
      onVisibilityChange: () => undefined,
      onScheduleAtChange: () => undefined,
      onQuickAction: () => undefined
    }));

    expect(html).toContain("补强爆款证据");
    expect(html).not.toContain("补文案");
    expect(html).not.toContain(">去规划<");
  });

  it("renders confirmation state after publish requirements are ready", () => {
    const html = renderToStaticMarkup(createElement(PostStudioPublishReadinessPanel, {
      publishVisibility: "仅自己可见",
      publishScheduleAt: "2099-06-02T20:00:00+08:00",
      publishReady: true,
      publishDraft: draft,
      selectedImageCount: 3,
      hasVisualDirection: true,
      citationTraceReady: true,
      accountReady: true,
      quality: {
        titleScore: 90,
        copyScore: 88,
        visualConsistencyScore: 86,
        platformFitScore: 92,
        complianceScore: 95,
        canPublish: true,
        issues: [],
        suggestions: [],
        checkedAt: "2026-06-02T10:00:00.000Z"
      },
      qualityGateFresh: true,
      pendingPublish,
      activeLoginName: "xiaohongshu-mcp",
      publishSafetyBoundary: { ...publishSafetyBoundary, state: "pending", headline: "确认单已生成" },
      hasExistingVisualDirection: true,
      busy: false,
      onVisibilityChange: () => undefined,
      onScheduleAtChange: () => undefined,
      onQuickAction: () => undefined
    }));

    expect(html).toContain("可以生成发布确认单");
    expect(html).toContain("定时 · 待人工确认");
    expect(html).toContain("xiaohongshu-mcp");
    expect(html).toContain("确认单已生成");
    expect(html).not.toContain("规划图片方向");
  });

  it("normalizes datetime-local values with an explicit timezone", () => {
    const normalized = normalizePublishScheduleInput("2099-06-02T20:00");

    expect(normalized).toMatch(/^2099-06-02T20:00:00[+-]\d{2}:\d{2}$/);
    expect(getPublishScheduleBlocker(normalized)).toBeNull();
    expect(toDatetimeLocalInputValue(normalized)).toBe("2099-06-02T20:00");
  });

  it("blocks timezone-less schedule values before publish confirmation", () => {
    const html = renderToStaticMarkup(createElement(PostStudioPublishReadinessPanel, {
      publishVisibility: "仅自己可见",
      publishScheduleAt: "2099-06-02T20:00",
      publishReady: false,
      publishDraft: draft,
      selectedImageCount: 3,
      hasVisualDirection: true,
      citationTraceReady: true,
      accountReady: true,
      quality: {
        titleScore: 90,
        copyScore: 88,
        visualConsistencyScore: 86,
        platformFitScore: 92,
        complianceScore: 95,
        canPublish: true,
        issues: [],
        suggestions: [],
        checkedAt: "2026-06-02T10:00:00.000Z"
      },
      qualityGateFresh: true,
      pendingPublish: null,
      activeLoginName: "xiaohongshu-mcp",
      publishSafetyBoundary,
      hasExistingVisualDirection: true,
      busy: false,
      onVisibilityChange: () => undefined,
      onScheduleAtChange: () => undefined,
      onQuickAction: () => undefined
    }));

    expect(getPublishScheduleBlocker("2099-06-02T20:00")).toBe("定时时间必须包含明确时区");
    expect(html).toContain("修正定时时间");
    expect(html).toContain("定时时间必须包含明确时区");
    expect(html).not.toContain("可以生成发布确认单");
  });
});
