import type { PostAction, PostStage } from "@/lib/post-project/types";

export type PostStageGuidance = {
  title: string;
  description: string;
  primaryAction?: PostAction;
};

const stageGuidance: Record<PostStage, PostStageGuidance> = {
  empty: {
    title: "先建立帖子项目",
    description: "填写主题、产品或目标人群，让 Agent 知道这篇笔记要解决什么问题。",
    primaryAction: "start_brief"
  },
  briefing: {
    title: "补全创作约束",
    description: "确认主题、人群、目标和语气后，再开始搜索真实小红书笔记。",
    primaryAction: "search_research"
  },
  researching: {
    title: "等待研究完成",
    description: "当前正在抓取和分析样本，完成后会把正文、标题、标签和图片规律压缩成证据。",
    primaryAction: "summarize_evidence"
  },
  evidence_ready: {
    title: "生成 CreativeBrief",
    description: "把实时研究和爆款库规律合成统一 Brief，后续文案和图片都基于它。",
    primaryAction: "create_creative_brief"
  },
  brief_ready: {
    title: "生成第一版文案",
    description: "Brief 已准备好，可以生成原创标题、正文、标签，也可以先规划图片方向。",
    primaryAction: "generate_copy"
  },
  copy_drafting: {
    title: "完善当前草稿",
    description: "先把标题、正文和标签调整到满意，再进入图片方向或发布组装。",
    primaryAction: "revise_copy"
  },
  copy_ready: {
    title: "规划图片方向",
    description: "文案已经可用，下一步让图片方向和文案共享同一个 CreativeBrief。",
    primaryAction: "plan_visuals"
  },
  visual_planning: {
    title: "确认视觉方向",
    description: "先确认图片必须包含和必须避免的元素，再生成可执行图片提示词。",
    primaryAction: "generate_image_prompts"
  },
  image_prompt_ready: {
    title: "生成或选择图片",
    description: "图片提示词已准备好，可以生成配图、图文卡片，或选择现有素材。",
    primaryAction: "generate_images"
  },
  image_generating: {
    title: "选择发布图片",
    description: "图片生成完成后，选择最终要进入发布稿的图片版本。",
    primaryAction: "select_images"
  },
  image_ready: {
    title: "组装最终帖子",
    description: "文案和图片都已就绪，下一步组合成最终发布预览并进入 Quality Gate。",
    primaryAction: "assemble_post"
  },
  assembling: {
    title: "运行发布前检查",
    description: "检查图文一致、证据追溯、夸张词、虚假功效和发布版本是否匹配。",
    primaryAction: "run_quality_gate"
  },
  reviewing: {
    title: "进入人工确认",
    description: "Quality Gate 后仍需确认账号、可见范围、最终文案、图片版本和发布时间。",
    primaryAction: "request_publish_confirmation"
  },
  scheduled: {
    title: "已创建定时发布",
    description: "当前帖子已进入定时状态，如要修改内容，需要重新生成发布确认单。",
    primaryAction: "recover"
  },
  published: {
    title: "已发布",
    description: "可以查看发布历史和审计记录，或新建下一篇帖子项目。",
    primaryAction: "recover"
  },
  failed: {
    title: "处理失败状态",
    description: "查看失败原因，修复账号、素材、模型或 MCP 状态后再继续。",
    primaryAction: "recover"
  }
};

export function getPostStageGuidance(stage: PostStage, allowedActions: PostAction[] = []): PostStageGuidance {
  const guidance = stageGuidance[stage] ?? stageGuidance.empty;
  if (!guidance.primaryAction || !allowedActions.length || allowedActions.includes(guidance.primaryAction)) {
    return guidance;
  }
  const fallback = allowedActions.find((action) => action !== "recover") ?? allowedActions[0];
  return {
    ...guidance,
    primaryAction: fallback
  };
}
