import type { PostAction, PostProject, PostStage } from "@/lib/post-project/types";

const allowedActionsByStage: Record<PostStage, PostAction[]> = {
  empty: ["start_brief", "update_brief_inputs", "recover"],
  briefing: ["update_brief_inputs", "search_research", "recover"],
  researching: ["summarize_evidence", "recover"],
  evidence_ready: ["create_creative_brief", "search_research", "update_brief_inputs", "recover"],
  brief_ready: ["generate_copy", "plan_visuals", "update_brief_inputs", "recover"],
  copy_drafting: ["revise_copy", "recover"],
  copy_ready: ["revise_copy", "plan_visuals", "assemble_post", "recover"],
  visual_planning: ["generate_image_prompts", "revise_copy", "recover"],
  image_prompt_ready: ["generate_images", "plan_visuals", "recover"],
  image_generating: ["select_images", "recover"],
  image_ready: ["select_images", "assemble_post", "generate_images", "recover"],
  assembling: ["run_quality_gate", "revise_copy", "select_images", "recover"],
  reviewing: ["request_publish_confirmation", "schedule_publish", "publish_now", "revise_copy", "select_images", "recover"],
  scheduled: ["recover"],
  published: ["recover"],
  failed: ["recover"]
};

export function getAllowedPostActions(stage: PostStage): PostAction[] {
  return allowedActionsByStage[stage] ?? allowedActionsByStage.empty;
}

export function normalizePostStage(stage: unknown): PostStage {
  return typeof stage === "string" && stage in allowedActionsByStage ? (stage as PostStage) : "empty";
}

export function inferPostStage(project: Partial<PostProject>): PostStage {
  if (project.publishPlan?.status === "published") return "published";
  if (project.publishPlan?.status === "scheduled") return "scheduled";
  if (project.qualityCheck) return project.qualityCheck.canPublish ? "reviewing" : "reviewing";
  if (project.finalPost) return "assembling";
  if (project.selectedImages?.length) return "image_ready";
  if (project.generatedImages?.length) return "image_ready";
  if (project.imagePrompts?.length) return "image_prompt_ready";
  if (project.visualDirection) return "visual_planning";
  if (project.copyDraft || project.copyVersions?.length) return "copy_ready";
  if (project.creativeBrief) return "brief_ready";
  if (project.evidencePack?.insights?.length || project.selectedSamples?.length) return "evidence_ready";
  if (project.topic || project.targetAudience || project.goal || project.tone) return "briefing";
  return "empty";
}

export function withAllowedActions<T extends Partial<PostProject> & { currentStage?: PostStage }>(project: T): T & {
  currentStage: PostStage;
  allowedActions: PostAction[];
} {
  const currentStage = normalizePostStage(project.currentStage ?? inferPostStage(project));
  return {
    ...project,
    currentStage,
    allowedActions: getAllowedPostActions(currentStage)
  };
}
