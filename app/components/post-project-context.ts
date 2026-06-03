import type { Health, PendingPublishConfirmation, PostProject, RedactedSettings, WorkspaceState } from "@/app/types";
import { activeAccountReadinessHint, isHealthForActiveAccount } from "@/app/components/account-readiness";

export type PostProjectContextSummary = {
  title: string;
  projectLine: string;
  boundaryLine: string;
  boundaryChecklist: string[];
  accountLine: string;
  scopeLine: string;
  publishLine: string;
  state: "clean" | "dirty" | "warn";
  chips: Array<{
    label: string;
    value: string;
    state: "ok" | "warn" | "neutral";
  }>;
};

export function buildPostProjectContextSummary({
  project,
  workspace,
  settings,
  health,
  canvasDirty,
  pendingPublish,
  staleCanvasPublishPlan,
  staleAccountPublishPlan
}: {
  project: PostProject | null;
  workspace: WorkspaceState | null;
  settings: RedactedSettings;
  health: Health | null;
  canvasDirty: boolean;
  pendingPublish: PendingPublishConfirmation | null;
  staleCanvasPublishPlan: boolean;
  staleAccountPublishPlan: boolean;
}): PostProjectContextSummary {
  const activeAccount = settings.accounts.find((account) => account.id === settings.activeAccountId) ?? settings.accounts[0];
  const accountReady = isHealthForActiveAccount(health, settings);
  const topic = project?.topic ?? workspace?.topic ?? "未命名帖子项目";
  const projectId = project?.id ?? workspace?.workspaceId ?? "not-created";
  const evidenceCount = project?.evidencePack.insights.length ?? 0;
  const sampleCount = project?.selectedSamples.length ?? 0;
  const draftCount = project?.copyVersions.length ?? (project?.copyDraft ? 1 : 0);
  const selectedImageCount = project?.selectedImages.length ?? workspace?.selectedImageIds.length ?? 0;
  const hasPublishPlan = Boolean(project?.publishPlan || pendingPublish);
  const publishState = staleCanvasPublishPlan
    ? "确认单已因画布修改失效"
    : staleAccountPublishPlan
      ? "确认单账号不匹配"
      : pendingPublish
        ? `${pendingPublish.mode === "schedule" ? "定时" : "立即"}确认单待人工确认`
        : project?.publishPlan?.status
          ? `发布计划：${labelPublishStatus(project.publishPlan.status)}`
          : "暂无发布确认单";
  const state: PostProjectContextSummary["state"] = canvasDirty || staleCanvasPublishPlan
    ? "dirty"
    : !accountReady || staleAccountPublishPlan
      ? "warn"
      : "clean";

  return {
    title: topic,
    projectLine: `项目 ${shortId(projectId)} · ${labelStage(project?.currentStage ?? "empty")}`,
    boundaryLine: project
      ? "所有生成、选图、发布检查都会写入当前 PostProject；历史任务不会自动覆盖当前画布。"
      : "这是一个干净的新帖子入口：旧证据、旧草稿、旧图片和旧发布计划不会自动带入。",
    boundaryChecklist: project
      ? ["历史任务只读保留", "当前画布独立保存"]
      : ["旧证据不带入", "旧草稿不带入", "旧图片不带入", "旧发布计划不带入"],
    accountLine: [
      accountReady ? "账号已确认" : "账号待确认",
      activeAccount?.displayName ?? settings.activeAccountId,
      health?.activeAccount?.loginName ? `登录名 ${health.activeAccount.loginName}` : activeAccountReadinessHint(health, settings)
    ].filter(Boolean).join(" · "),
    scopeLine: `证据 ${evidenceCount} 条 / 样本 ${sampleCount} 条 / 文案版本 ${draftCount} 个 / 选图 ${selectedImageCount} 张`,
    publishLine: publishState,
    state,
    chips: [
      chip("项目边界", project ? "当前项目" : "待创建", project ? "ok" : "warn"),
      chip("保存", canvasDirty ? "有未保存修改" : "已同步", canvasDirty ? "warn" : "ok"),
      chip("账号", accountReady ? "可发布账号" : "待检测", accountReady ? "ok" : "warn"),
      chip("确认单", hasPublishPlan ? (staleCanvasPublishPlan || staleAccountPublishPlan ? "需重建" : "已生成") : "未生成", staleCanvasPublishPlan || staleAccountPublishPlan ? "warn" : hasPublishPlan ? "ok" : "neutral")
    ]
  };
}

function chip(label: string, value: string, state: "ok" | "warn" | "neutral") {
  return { label, value, state };
}

function shortId(id: string): string {
  if (!id) return "not-created";
  return id.length > 18 ? `${id.slice(0, 9)}...${id.slice(-6)}` : id;
}

function labelPublishStatus(status: string): string {
  const labels: Record<string, string> = {
    awaiting_approval: "待人工确认",
    approved: "已确认",
    scheduled: "已定时",
    published: "已发布",
    failed: "发布失败",
    blocked: "已阻止"
  };
  return labels[status] ?? status;
}

function labelStage(stage: string): string {
  const labels: Record<string, string> = {
    empty: "空项目",
    briefing: "补充需求",
    researching: "研究中",
    evidence_ready: "证据就绪",
    brief_ready: "Brief 就绪",
    copy_drafting: "文案生成中",
    copy_ready: "文案就绪",
    visual_planning: "图片规划中",
    image_prompt_ready: "Prompt 就绪",
    image_generating: "生图中",
    image_ready: "图片就绪",
    assembling: "装配中",
    reviewing: "发布检查",
    scheduled: "已定时",
    published: "已发布",
    failed: "失败"
  };
  return labels[stage] ?? stage;
}
