import type { PostAction } from "@/lib/post-project/types";

const actionLabels: Record<PostAction, string> = {
  start_brief: "填写主题",
  update_brief_inputs: "补充需求",
  search_research: "搜索笔记",
  summarize_evidence: "总结证据",
  retrieve_viral_knowledge: "刷新爆款库 RAG",
  create_creative_brief: "生成创作简报",
  generate_copy: "生成文案",
  revise_copy: "修改文案",
  plan_visuals: "规划图片",
  confirm_visual_direction: "确认图片方向",
  generate_image_prompts: "生成图片 Prompt",
  generate_images: "生成图片",
  generate_cards: "生成卡片",
  select_images: "选图",
  assemble_post: "组装帖子",
  run_quality_gate: "发布检查",
  request_publish_confirmation: "生成发布确认单",
  schedule_publish: "生成定时发布确认单",
  publish_now: "生成立即发布确认单",
  recover: "恢复/重试"
};

export function labelForPostAction(action: string): string {
  return actionLabels[action as PostAction] ?? action;
}
