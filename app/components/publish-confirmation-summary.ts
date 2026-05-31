import type { PendingPublishConfirmation, PostProject, PublishDraftState } from "@/app/types";

export type PublishConfirmationSummaryPlan = {
  status?: string;
  visibility?: string;
  scheduleAt?: string;
  images?: string[];
  tags?: string[];
  accountName?: string;
  loginName?: string;
  mcpUrl?: string;
  confirmationChecklist?: Array<{
    required?: boolean;
    confirmed?: boolean;
    label?: string;
  }>;
  versionSnapshot?: {
    qualityGateFresh?: boolean;
    qualityCanPublish?: boolean;
    finalPostMatchesCanvas?: boolean;
    warnings?: string[];
    summary?: string;
  };
};

export type PublishConfirmationSummaryInput = {
  draft: PublishDraftState;
  selectedImageCount: number;
  activePlan: PublishConfirmationSummaryPlan | null;
  pendingPublish: PendingPublishConfirmation | null;
  project: PostProject | null;
  activeAccountName?: string;
  activeLoginName?: string;
  visibility: string;
  scheduleAt: string;
  publishReady: boolean;
  citationTraceReady: boolean;
  canvasDirty: boolean;
  accountReady: boolean;
  hasVisualDirection: boolean;
  qualityGateFresh: boolean;
};

export type PublishConfirmationSummary = {
  headline: string;
  detail: string;
  modeLabel: string;
  accountLine: string;
  timingLine: string;
  visibilityLine: string;
  contentLine: string;
  imageLine: string;
  evidenceLine: string;
  qualityLine: string;
  checklistLine: string;
  riskLevel: "ok" | "warn" | "blocked";
  blockers: string[];
};

export function buildPublishConfirmationSummary({
  draft,
  selectedImageCount,
  activePlan,
  pendingPublish,
  project,
  activeAccountName,
  activeLoginName,
  visibility,
  scheduleAt,
  publishReady,
  citationTraceReady,
  canvasDirty,
  accountReady,
  hasVisualDirection,
  qualityGateFresh
}: PublishConfirmationSummaryInput): PublishConfirmationSummary {
  const planScheduleAt = pendingPublish?.payload.scheduleAt ?? activePlan?.scheduleAt ?? scheduleAt;
  const planVisibility = pendingPublish?.payload.visibility ?? activePlan?.visibility ?? visibility;
  const planImages = pendingPublish?.payload.assetIds ?? activePlan?.images ?? [];
  const planTags = pendingPublish?.payload.tags ?? activePlan?.tags ?? parseTags(draft.tagsText);
  const quality = project?.qualityCheck;
  const evidenceIds = uniqueStrings([
    ...(project?.finalPost?.basedOnEvidenceIds ?? []),
    ...(project?.copyDraft?.draft.basedOnEvidenceIds ?? []),
    ...(project?.visualDirection?.basedOnEvidenceIds ?? []),
    ...(project?.creativeBrief?.basedOnEvidenceIds ?? [])
  ]);
  const requiredChecklist = activePlan?.confirmationChecklist?.filter((item) => item.required) ?? [];
  const confirmedChecklist = requiredChecklist.filter((item) => item.confirmed).length;
  const blockers = buildBlockers({
    draft,
    selectedImageCount,
    planImageCount: planImages.length,
    tagCount: planTags.length,
    citationTraceReady,
    canvasDirty,
    accountReady,
    hasVisualDirection,
    qualityCanPublish: quality?.canPublish === true,
    qualityGateFresh: activePlan?.versionSnapshot?.qualityGateFresh ?? qualityGateFresh,
    scheduleAt: planScheduleAt
  });
  const hasPendingConfirmation = Boolean(pendingPublish || activePlan?.status === "awaiting_approval");
  const riskLevel: PublishConfirmationSummary["riskLevel"] = blockers.length
    ? "blocked"
    : hasPendingConfirmation && confirmedChecklist < requiredChecklist.length
      ? "warn"
      : "ok";

  return {
    headline: hasPendingConfirmation
      ? "发布确认单已生成，等待人工确认"
      : publishReady
        ? "已具备生成发布确认单条件"
        : "发布前还需要处理",
    detail: hasPendingConfirmation
      ? "请最后核对账号、可见范围、时间、文案和图片版本；确认前不会提交到小红书。"
      : publishReady
        ? "下一步会生成确认单，确认单通过后才允许立即发布或定时发布。"
        : "先补齐下方阻塞项，再生成发布确认单。",
    modeLabel: planScheduleAt ? "定时发布" : "立即发布",
    accountLine: formatAccountLine({
      accountName: pendingPublish?.accountDisplayName ?? activePlan?.accountName ?? activeAccountName,
      loginName: pendingPublish?.loginName ?? activePlan?.loginName ?? activeLoginName
    }),
    timingLine: planScheduleAt ? `${planScheduleAt}（本地时区）` : "确认后立即发布",
    visibilityLine: planVisibility || "未选择",
    contentLine: `标题 ${draft.title.trim().length} 字 / 正文 ${draft.content.trim().length} 字 / 标签 ${planTags.length} 个`,
    imageLine: `${Math.max(selectedImageCount, planImages.length)} 张图片${hasVisualDirection ? "，图片方向已确认" : "，缺图片方向"}`,
    evidenceLine: citationTraceReady
      ? `字段级证据可追溯，引用 ${evidenceIds.length} 条证据`
      : "字段级证据引用还未通过",
    qualityLine: quality
      ? `${quality.canPublish ? "Quality Gate 通过" : "Quality Gate 未通过"}：标题 ${quality.titleScore} / 正文 ${quality.copyScore} / 合规 ${quality.complianceScore}`
      : "尚未运行 Quality Gate",
    checklistLine: requiredChecklist.length
      ? `人工确认 ${confirmedChecklist}/${requiredChecklist.length} 项`
      : "尚未生成确认清单",
    riskLevel,
    blockers
  };
}

function buildBlockers({
  draft,
  selectedImageCount,
  planImageCount,
  tagCount,
  citationTraceReady,
  canvasDirty,
  accountReady,
  hasVisualDirection,
  qualityCanPublish,
  qualityGateFresh,
  scheduleAt
}: {
  draft: PublishDraftState;
  selectedImageCount: number;
  planImageCount: number;
  tagCount: number;
  citationTraceReady: boolean;
  canvasDirty: boolean;
  accountReady: boolean;
  hasVisualDirection: boolean;
  qualityCanPublish: boolean;
  qualityGateFresh: boolean;
  scheduleAt?: string;
}): string[] {
  const blockers: string[] = [];
  if (!draft.title.trim()) blockers.push("缺少标题");
  if (!draft.content.trim()) blockers.push("缺少正文");
  if (!tagCount) blockers.push("缺少标签");
  if (!selectedImageCount && !planImageCount) blockers.push("缺少发布图片");
  if (!hasVisualDirection) blockers.push("缺少已确认的图片方向或 Prompt");
  if (!citationTraceReady) blockers.push("字段级证据引用未通过");
  if (!accountReady) blockers.push("当前小红书账号未确认登录");
  if (canvasDirty) blockers.push("画布有未保存修改");
  if (!qualityCanPublish) blockers.push("Quality Gate 未通过");
  if (!qualityGateFresh) blockers.push("最终版本与 Quality Gate 需要重新同步");
  if (scheduleAt && Number.isNaN(Date.parse(scheduleAt))) blockers.push("定时时间格式无效");
  if (scheduleAt && !Number.isNaN(Date.parse(scheduleAt)) && Date.parse(scheduleAt) <= Date.now()) {
    blockers.push("定时时间必须晚于当前时间");
  }
  return blockers;
}

function formatAccountLine({ accountName, loginName }: { accountName?: string; loginName?: string }): string {
  const displayName = accountName?.trim() || "未配置账号";
  return loginName?.trim() ? `${displayName}（${loginName}）` : displayName;
}

function parseTags(tagsText: string): string[] {
  return tagsText
    .split(/[\s#，,、]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
