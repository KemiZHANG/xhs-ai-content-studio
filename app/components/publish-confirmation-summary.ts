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
    detail?: string;
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
  accountSafetyLine: string;
  timingLine: string;
  visibilityLine: string;
  contentLine: string;
  imageLine: string;
  evidenceLine: string;
  evidenceSourceLine: string;
  versionLine: string;
  qualityLine: string;
  checklistLine: string;
  decisionLine: string;
  nextStepLine: string;
  detailCompressionLine: string;
  confirmationItems: Array<{
    label: string;
    confirmed: boolean;
    required: boolean;
  }>;
  visibleBlockers: string[];
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
  const snapshot = activePlan?.versionSnapshot;
  const evidenceIds = uniqueStrings([
    ...(project?.finalPost?.basedOnEvidenceIds ?? []),
    ...(project?.copyDraft?.draft.basedOnEvidenceIds ?? []),
    ...(project?.visualDirection?.basedOnEvidenceIds ?? []),
    ...(project?.creativeBrief?.basedOnEvidenceIds ?? [])
  ]);
  const evidenceSourceCounts = countEvidenceSources(project);
  const requiredChecklist = activePlan?.confirmationChecklist?.filter((item) => item.required) ?? [];
  const confirmationItems = (activePlan?.confirmationChecklist ?? [])
    .filter((item) => item.label?.trim())
    .map((item) => ({
      label: item.label!.trim(),
      confirmed: item.confirmed === true,
      required: item.required === true
    }));
  const confirmedChecklist = requiredChecklist.filter((item) => item.confirmed).length;
  const pendingChecklistLabels = requiredChecklist
    .filter((item) => !item.confirmed)
    .map((item) => item.label?.trim())
    .filter(Boolean) as string[];
  const accountLine = formatAccountLine({
    accountName: pendingPublish?.accountDisplayName ?? activePlan?.accountName ?? activeAccountName,
    loginName: pendingPublish?.loginName ?? activePlan?.loginName ?? activeLoginName
  });
  const blockers = buildBlockers({
    draft,
    selectedImageCount,
    planImageCount: planImages.length,
    tagCount: planTags.length,
    citationTraceReady,
    canvasDirty,
    accountReady,
    hasVisualDirection,
    qualityCanPublish: snapshot?.qualityCanPublish ?? (quality?.canPublish === true),
    qualityGateFresh: snapshot?.qualityGateFresh ?? qualityGateFresh,
    finalPostMatchesCanvas: snapshot?.finalPostMatchesCanvas ?? true,
    scheduleAt: planScheduleAt
  });
  const hasPendingConfirmation = Boolean(pendingPublish || activePlan?.status === "awaiting_approval");
  const riskLevel: PublishConfirmationSummary["riskLevel"] = blockers.length
    ? "blocked"
    : hasPendingConfirmation && confirmedChecklist < requiredChecklist.length
      ? "warn"
      : "ok";
  const visibleBlockers = blockers.slice(0, 3);

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
    accountLine,
    accountSafetyLine: formatAccountSafetyLine({
      accountLine,
      mcpUrl: pendingPublish?.mcpUrl ?? activePlan?.mcpUrl
    }),
    timingLine: planScheduleAt ? `${planScheduleAt}（本地时区）` : "确认后立即发布",
    visibilityLine: planVisibility || "未选择",
    contentLine: `标题 ${draft.title.trim().length} 字 / 正文 ${draft.content.trim().length} 字 / 标签 ${planTags.length} 个`,
    imageLine: `${Math.max(selectedImageCount, planImages.length)} 张图片${hasVisualDirection ? "，图片方向已确认" : "，缺图片方向"}`,
    evidenceLine: citationTraceReady
      ? `字段级证据可追溯，引用 ${evidenceIds.length} 条证据`
      : "字段级证据引用还未通过",
    evidenceSourceLine: formatEvidenceSourceLine(evidenceSourceCounts),
    versionLine: formatVersionLine(snapshot, Boolean(project?.finalPost)),
    qualityLine: quality
      ? `${quality.canPublish ? "Quality Gate 通过" : "Quality Gate 未通过"}：标题 ${quality.titleScore} / 正文 ${quality.copyScore} / 合规 ${quality.complianceScore}`
      : "尚未运行 Quality Gate",
    checklistLine: requiredChecklist.length
      ? pendingChecklistLabels.length
        ? `人工确认 ${confirmedChecklist}/${requiredChecklist.length} 项，待确认：${pendingChecklistLabels.slice(0, 2).join("、")}`
        : `人工确认 ${confirmedChecklist}/${requiredChecklist.length} 项，全部必填项已确认`
      : "尚未生成确认清单",
    decisionLine: formatPublishDecisionLine({
      riskLevel,
      hasPendingConfirmation,
      blockerCount: blockers.length,
      confirmedChecklist,
      requiredChecklistCount: requiredChecklist.length
    }),
    nextStepLine: formatPublishNextStepLine({
      riskLevel,
      hasPendingConfirmation,
      pendingChecklistLabels,
      blockers
    }),
    detailCompressionLine: "默认只显示发布结论、主要阻塞项和下一步；账号、版本、证据、质量分与确认清单已收进详细发布快照。",
    confirmationItems,
    visibleBlockers,
    riskLevel,
    blockers
  };
}

function formatPublishDecisionLine({
  riskLevel,
  hasPendingConfirmation,
  blockerCount,
  confirmedChecklist,
  requiredChecklistCount
}: {
  riskLevel: PublishConfirmationSummary["riskLevel"];
  hasPendingConfirmation: boolean;
  blockerCount: number;
  confirmedChecklist: number;
  requiredChecklistCount: number;
}): string {
  if (riskLevel === "blocked") return `暂不能发布：还有 ${blockerCount} 个阻塞项需要处理。`;
  if (hasPendingConfirmation && requiredChecklistCount && confirmedChecklist < requiredChecklistCount) {
    return `等待人工确认：已确认 ${confirmedChecklist}/${requiredChecklistCount} 项，确认前不会调用小红书发布。`;
  }
  if (hasPendingConfirmation) return "确认单已就绪：最后核对后才会执行发布或定时发布。";
  return "可以进入发布确认：内容、图片、证据和 Quality Gate 已满足生成确认单条件。";
}

function formatPublishNextStepLine({
  riskLevel,
  hasPendingConfirmation,
  pendingChecklistLabels,
  blockers
}: {
  riskLevel: PublishConfirmationSummary["riskLevel"];
  hasPendingConfirmation: boolean;
  pendingChecklistLabels: string[];
  blockers: string[];
}): string {
  if (riskLevel === "blocked") return `下一步：先处理 ${blockers.slice(0, 2).join("、")}。`;
  if (hasPendingConfirmation && pendingChecklistLabels.length) {
    return `下一步：确认 ${pendingChecklistLabels.slice(0, 2).join("、")}。`;
  }
  if (hasPendingConfirmation) return "下一步：核对账号、可见范围、图片版本和时间后，手动确认发布。";
  return "下一步：生成发布确认单，进入人工确认。";
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
  finalPostMatchesCanvas,
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
  finalPostMatchesCanvas: boolean;
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
  if (!finalPostMatchesCanvas) blockers.push("发布确认单版本快照已失效");
  if (scheduleAt && Number.isNaN(Date.parse(scheduleAt))) blockers.push("定时时间格式无效");
  if (scheduleAt && !Number.isNaN(Date.parse(scheduleAt)) && Date.parse(scheduleAt) <= Date.now()) {
    blockers.push("定时时间必须晚于当前时间");
  }
  return blockers;
}

function formatAccountSafetyLine({ accountLine, mcpUrl }: { accountLine: string; mcpUrl?: string }): string {
  const endpoint = mcpUrl?.trim();
  return endpoint ? `${accountLine} · MCP ${endpoint}` : `${accountLine} · MCP 未在确认单中锁定`;
}

function formatEvidenceSourceLine(counts: { realtime: number; viral: number; userInput: number }): string {
  const parts = [
    `实时 ${counts.realtime}`,
    `爆款库 ${counts.viral}`,
    `用户输入 ${counts.userInput}`
  ];
  return `证据来源：${parts.join(" / ")}`;
}

function formatVersionLine(
  snapshot: PublishConfirmationSummaryPlan["versionSnapshot"] | undefined,
  hasFinalPost: boolean
): string {
  if (!snapshot) {
    return hasFinalPost ? "最终帖子已装配，发布前会生成版本快照" : "尚未装配最终帖子";
  }

  const warnings = snapshot.warnings?.filter(Boolean) ?? [];
  const safe = snapshot.qualityGateFresh && snapshot.qualityCanPublish && snapshot.finalPostMatchesCanvas && !warnings.length;
  if (safe) {
    return `版本快照已锁定：${snapshot.summary?.trim() || "最终稿、画布和 Quality Gate 一致"}`;
  }
  return `版本快照需复核：${warnings.slice(0, 2).join(" / ") || "最终稿、画布或 Quality Gate 不一致"}`;
}

function countEvidenceSources(project: PostProject | null): { realtime: number; viral: number; userInput: number } {
  const counts = { realtime: 0, viral: 0, userInput: 0 };
  for (const insight of project?.evidencePack.insights ?? []) {
    if (insight.sourceType === "viral_library") counts.viral += 1;
    else if (insight.sourceType === "user_input") counts.userInput += 1;
    else counts.realtime += 1;
  }
  return counts;
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
