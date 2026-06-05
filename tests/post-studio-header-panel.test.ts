import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PostStudioHeaderPanel } from "@/app/components/post-studio-header-panel";
import type { PostNextStepCoach } from "@/app/components/post-next-step-coach";
import type { PostFlowPhase } from "@/app/components/post-flow-summary";
import type { PostProjectContextSummary } from "@/app/components/post-project-context";
import type { PostStudioStatusSummary } from "@/app/components/post-studio-status";

const projectContextSummary: PostProjectContextSummary = {
  title: "广州咖啡馆探店",
  projectLine: "项目 post-123 · Brief 就绪",
  boundaryLine: "所有生成、选图、发布检查都会写入当前 PostProject；历史任务不会自动覆盖当前画布。",
  boundaryChecklist: ["历史任务只读保留", "当前画布独立保存"],
  accountLine: "账号已确认 · 咖啡探店号 · xiaohongshu-mcp",
  scopeLine: "证据 8 条 / 样本 4 条 / 文案版本 2 个 / 选图 3 张",
  publishLine: "定时确认单待人工确认",
  state: "clean",
  chips: [
    { label: "项目边界", value: "当前项目", state: "ok" },
    { label: "保存", value: "已同步", state: "ok" },
    { label: "确认单", value: "已生成", state: "ok" }
  ]
};

const statusSummary: PostStudioStatusSummary = {
  headline: "下一步已经明确",
  detail: "当前最适合先规划图片方向。",
  accountLine: "账号可用 · 咖啡探店号",
  accountReady: true,
  accountName: "咖啡探店号",
  accountLoginName: "xiaohongshu-mcp",
  accountMcpEndpoint: "localhost:18060",
  accountCount: 2,
  accountOptions: [
    { id: "main", label: "咖啡探店号 · localhost:18060", detail: "当前账号 · 已登录", isActive: true, isReady: true },
    { id: "backup", label: "备用账号 · localhost:18061", detail: "可切换账号 · 待检测", isActive: false, isReady: false }
  ],
  accountSwitchHint: "切换账号后需要重新检测登录状态。",
  riskLevel: "ok",
  progressPercent: 72,
  stageLine: "文案已就绪 · 完成度 72%",
  primaryAction: "plan_visuals",
  primaryActionLabel: "规划图片方向",
  blockers: [],
  chips: [
    { label: "研究", value: "8 条证据", state: "ok" },
    { label: "文案", value: "已生成", state: "ok" },
    { label: "图片", value: "待选择", state: "warn" }
  ]
};

const flowSummary: PostFlowPhase[] = [
  { id: "research", label: "实时研究", detail: "真实笔记证据已沉淀", state: "done" },
  { id: "brief", label: "Brief", detail: "文案和图片共享策略", state: "done" },
  { id: "visual", label: "图片", detail: "补齐图片方向", state: "active", action: "plan_visuals", actionLabel: "规划图片方向" }
];

const nextStepCoach: PostNextStepCoach = {
  headline: "先规划图片方向",
  detail: "文案已可用，下一步让图片和文案围绕同一角度展开。",
  whyLine: "图片方向会影响生图和发布风险。",
  outcomeLine: "完成后可以生成 Prompt 和图片。",
  safetyLine: "确认图片方向后再进入生图。",
  primaryAction: "plan_visuals",
  primaryLabel: "规划图片方向",
  secondaryActions: [
    { action: "generate_copy", label: "重写文案" },
    { action: "run_quality_gate", label: "运行质量检查" }
  ],
  progressLine: "准备度 72% · 文案已就绪"
};

describe("post studio header panel", () => {
  it("renders project context, account controls, flow, and next action composer", () => {
    const html = renderToStaticMarkup(createElement(PostStudioHeaderPanel, {
      projectTitle: "广州咖啡馆探店",
      projectContextSummary,
      statusSummary,
      flowSummary,
      nextStepCoach,
      chatInput: "把标题更生活化一点",
      busy: false,
      activeAccountId: "main",
      onQuickAction: () => undefined,
      onSwitchAccount: () => undefined,
      onRefreshHealth: () => undefined,
      onNavigate: () => undefined,
      onChatInput: () => undefined,
      onChatSubmit: () => undefined,
      onNewProject: () => undefined
    }));

    expect(html).toContain("Post Studio");
    expect(html).toContain("当前帖子项目");
    expect(html).toContain("广州咖啡馆探店");
    expect(html).toContain("历史任务不会自动覆盖当前画布");
    expect(html).toContain("历史任务只读保留");
    expect(html).toContain("当前画布独立保存");
    expect(html).toContain("证据 8 条");
    expect(html).toContain("当前判断");
    expect(html).toContain("下一步已经明确");
    expect(html).toContain("发布账号");
    expect(html).toContain("xiaohongshu-mcp");
    expect(html).toContain("切换");
    expect(html).toContain("当前使用");
    expect(html).toContain("可切换");
    expect(html).toContain("备用账号");
    expect(html).toContain("帖子创作流程");
    expect(html).toContain("实时研究");
    expect(html).toContain("图片");
    expect(html).toContain("主线进度");
    expect(html).toContain("2/3 已完成");
    expect(html).toContain("当前只处理：图片");
    expect(html).toContain("下一步建议");
    expect(html).toContain("先规划图片方向");
    expect(html).toContain("下一步决策摘要");
    expect(html).toContain("为什么");
    expect(html).toContain("完成后");
    expect(html).toContain("安全");
    expect(html).toContain("现在只做：规划图片方向");
    expect(html).toContain("其他可选动作");
    expect(html).toContain("把标题更生活化一点");
    expect(html).toContain("这句话会作用于：广州咖啡馆探店");
    expect(html).toContain("定时确认单待人工确认");
    expect(html).toContain("查看完整决策说明");
    expect(html).toContain("新建项目");
  });

  it("routes first-screen creative actions to viral RAG refresh when evidence is weak", () => {
    const html = renderToStaticMarkup(createElement(PostStudioHeaderPanel, {
      projectTitle: "广州咖啡馆探店",
      projectContextSummary,
      statusSummary: {
        ...statusSummary,
        blockers: ["缺少最终文案", "未确认图片方向"]
      },
      flowSummary,
      nextStepCoach,
      chatInput: "",
      busy: false,
      activeAccountId: "main",
      ragCreativeBlocked: true,
      onQuickAction: () => undefined,
      onSwitchAccount: () => undefined,
      onRefreshHealth: () => undefined,
      onNavigate: () => undefined,
      onChatInput: () => undefined,
      onChatSubmit: () => undefined,
      onNewProject: () => undefined
    }));

    expect(html).toContain("建议：补强爆款证据");
    expect(html).toContain("现在只做：补强爆款证据");
    expect(html).toContain("补强爆款证据");
    expect(html).not.toContain("建议：规划图片方向");
    expect(html).not.toContain("现在只做：规划图片方向");
    expect(html).not.toContain(">补文案<");
  });
});
