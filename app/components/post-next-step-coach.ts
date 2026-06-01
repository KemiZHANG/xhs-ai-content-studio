import { labelForPostAction } from "@/app/components/post-action-labels";
import type { PostStageGuidance } from "@/lib/post-project/guidance";
import type { PostReadinessReport } from "@/lib/post-project/readiness";
import type { PostAction } from "@/lib/post-project/types";

export type PostNextStepCoach = {
  headline: string;
  detail: string;
  whyLine: string;
  outcomeLine: string;
  safetyLine?: string;
  primaryAction?: PostAction;
  primaryLabel?: string;
  secondaryActions: Array<{
    action: PostAction;
    label: string;
  }>;
  blockerLine?: string;
  progressLine?: string;
};

export function buildPostNextStepCoach({
  guidance,
  readiness,
  nextActions
}: {
  guidance: PostStageGuidance;
  readiness: PostReadinessReport | null;
  nextActions: PostAction[];
}): PostNextStepCoach {
  const primaryAction = readiness?.nextAction ?? guidance.primaryAction ?? nextActions[0];
  const blocker = readiness?.blockers[0];
  const secondaryActions = nextActions
    .filter((action) => action !== primaryAction)
    .slice(0, 2)
    .map((action) => ({ action, label: labelForPostAction(action) }));

  return {
    headline: guidance.title,
    detail: blocker
      ? `${guidance.description} 当前最需要补齐：${blocker.label}。${blocker.detail}`
      : guidance.description,
    whyLine: primaryAction ? whyForAction(primaryAction, blocker?.label) : "当前阶段先保持画布稳定，等待你补充更明确的创作目标。",
    outcomeLine: primaryAction ? outcomeForAction(primaryAction) : "补充信息后，Agent 会重新判断下一步。",
    safetyLine: primaryAction ? safetyForAction(primaryAction) : undefined,
    primaryAction,
    primaryLabel: primaryAction ? labelForPostAction(primaryAction) : undefined,
    secondaryActions,
    blockerLine: blocker ? `阻塞项：${blocker.label}` : undefined,
    progressLine: readiness ? `准备度 ${readiness.progress}% · ${readiness.summary}` : undefined
  };
}

function whyForAction(action: PostAction, blockerLabel?: string): string {
  const blocker = blockerLabel ? `当前卡住的是「${blockerLabel}」，` : "";
  const reasons: Partial<Record<PostAction, string>> = {
    start_brief: `${blocker}先把主题、人群和目标说清楚，后续研究、文案和图片才会围绕同一篇帖子推进。`,
    update_brief_inputs: `${blocker}补齐需求能减少 Agent 猜测，避免生成内容偏离你的账号定位。`,
    search_research: `${blocker}先拿真实小红书样本，才能把后续结论标记为证据，而不是凭空建议。`,
    retrieve_viral_knowledge: `${blocker}实时样本解决“现在流行什么”，爆款库补长期可复用的标题、结构和图片规律。`,
    create_creative_brief: `${blocker}CreativeBrief 是文案和图片共用的策略层，先生成它能避免图文割裂。`,
    generate_copy: `${blocker}已有证据或 Brief 后再写文案，可以把标题、正文、标签都绑定到 evidencePack。`,
    revise_copy: `${blocker}当前已有草稿，修改会保留项目上下文和证据引用，不会重新发散。`,
    plan_visuals: `${blocker}文案可用后先规划图片方向，能保证图文围绕同一个角度展开。`,
    confirm_visual_direction: `${blocker}图片方向会影响生图和发布风险，确认后再进入生图更稳。`,
    generate_image_prompts: `${blocker}先把 Prompt 版本固化，后续生成图片和发布快照才可追溯。`,
    generate_images: `${blocker}图片方向确认后再生成图片，能减少产品外观跑偏和风格不一致。`,
    generate_cards: `${blocker}卡片适合干货/清单型笔记，能稳定生成封面和正文页素材。`,
    select_images: `${blocker}选定图片后才能把文案和图片组合成同一篇最终帖子。`,
    assemble_post: `${blocker}组装会把当前文案、标签、图片和 Prompt 锁成最终预览。`,
    run_quality_gate: `${blocker}发布前需要检查夸张标题、广告感、图文一致和合规风险。`,
    request_publish_confirmation: `${blocker}确认单会锁定账号、可见范围、发布时间和版本快照，避免误发。`,
    schedule_publish: `${blocker}定时发布必须先锁定未来时间和版本快照。`,
    publish_now: `${blocker}立即发布前仍要走确认单，避免一句话误触真实外部动作。`,
    summarize_evidence: `${blocker}先压缩证据，主界面只保留 3-5 条可学习结论。`,
    recover: `${blocker}当前流程需要恢复或重试，先回到可验证状态。`
  };
  return reasons[action] ?? `${blocker}执行这一步可以让当前 PostProject 往下一阶段推进。`;
}

function outcomeForAction(action: PostAction): string {
  const outcomes: Partial<Record<PostAction, string>> = {
    search_research: "完成后进入证据准备阶段，可查看样本摘要并检索爆款库。",
    retrieve_viral_knowledge: "完成后爆款库规律会进入 evidencePack，并标记为 viral_library 来源。",
    create_creative_brief: "完成后文案和图片会共享同一个 CreativeBrief。",
    generate_copy: "完成后画布会出现可编辑标题、正文和标签版本。",
    plan_visuals: "完成后会得到图片方向和可追溯 Prompt。",
    confirm_visual_direction: "完成后才能安全进入生图、卡片或发布检查。",
    generate_images: "完成后新图片会进入成果画布和发布图片候选。",
    generate_cards: "完成后封面和正文卡片会进入已生成素材。",
    select_images: "完成后可组装最终帖子并进入 Quality Gate。",
    assemble_post: "完成后得到最终发布预览，但还不会真实发布。",
    run_quality_gate: "完成后会给出可发布/不可发布判断和修改建议。",
    request_publish_confirmation: "完成后只生成待人工确认的发布单，不会直接发到小红书。",
    schedule_publish: "完成后生成待人工确认的定时发布单。",
    publish_now: "完成后生成待人工确认的立即发布单。",
    revise_copy: "完成后会生成或更新文案版本，并使旧发布确认单失效。",
    update_brief_inputs: "完成后 Agent 会重新评估是否需要研究、Brief 或直接创作。",
    start_brief: "完成后得到一个干净的新 PostProject。",
    summarize_evidence: "完成后右侧证据面板只保留关键结论，原始样本进详情。",
    recover: "完成后回到可继续操作的安全状态。"
  };
  return outcomes[action] ?? "完成后 Agent 会刷新当前项目阶段和下一步建议。";
}

function safetyForAction(action: PostAction): string | undefined {
  if (["request_publish_confirmation", "schedule_publish", "publish_now"].includes(action)) {
    return "安全提醒：这里仍然只是生成确认单，真实发布必须人工确认账号、可见范围和时间。";
  }
  if (action === "run_quality_gate") {
    return "安全提醒：Quality Gate 会检查夸张、虚假数据、功效承诺、图文不一致和原创边界。";
  }
  if (action === "confirm_visual_direction") {
    return "安全提醒：确认图片方向后，后续生图和发布检查都会引用这版方向。";
  }
  return undefined;
}
