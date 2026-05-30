import type { FinalPost, PostProject, QualityCheck } from "@/lib/post-project/types";

const exaggeratedWords = ["最", "第一", "必买", "永久", "绝对", "无敌", "闭眼入", "封神"];
const riskyClaims = ["认证", "销量", "全网", "官方", "治愈", "疗效", "保证", "before", "after"];

export function runPostQualityGate(project: Pick<
  PostProject,
  "finalPost" | "copyDraft" | "selectedImages" | "creativeBrief" | "visualDirection"
>): QualityCheck {
  const finalPost = project.finalPost ?? finalPostFromDraft(project);
  const issues: string[] = [];
  const suggestions: string[] = [];

  if (!finalPost?.title.trim()) issues.push("标题为空");
  if (!finalPost?.content.trim()) issues.push("正文为空");
  if (!finalPost?.tags.length) issues.push("标签为空");
  if (!finalPost?.imageIds.length) issues.push("未选择发布图片");
  if (!project.creativeBrief) issues.push("缺少 CreativeBrief，文案和图片可能没有共享创作依据");

  const titleText = finalPost?.title ?? "";
  const bodyText = finalPost?.content ?? "";
  const tagText = finalPost?.tags.join(" ") ?? "";
  const combined = `${titleText}\n${bodyText}\n${tagText}`;

  const exaggerated = exaggeratedWords.filter((word) => combined.includes(word));
  if (exaggerated.length) {
    issues.push(`存在夸张词：${exaggerated.slice(0, 4).join("、")}`);
    suggestions.push("把绝对化表达改成具体体验、适用场景或个人感受。");
  }

  const risky = riskyClaims.filter((word) => combined.toLowerCase().includes(word.toLowerCase()));
  if (risky.length) {
    issues.push(`存在需要核实的认证/销量/功效类表达：${risky.slice(0, 4).join("、")}`);
    suggestions.push("删除无法证明的认证、销量、功效和 before/after 对比。");
  }

  if ((finalPost?.tags.length ?? 0) > 10) {
    issues.push("标签数量偏多，可能像标签堆砌");
    suggestions.push("保留主题词、场景词、人群词和 1-2 个风格词。");
  }

  if (bodyText.length < 80) {
    issues.push("正文过短，场景感和可信度不足");
    suggestions.push("补充使用场景、真实细节、适用人群和注意事项。");
  }

  const titleScore = scoreFromIssues([!titleText.trim(), exaggerated.length > 0]);
  const copyScore = scoreFromIssues([!bodyText.trim(), bodyText.length < 80, risky.length > 0]);
  const visualConsistencyScore = scoreFromIssues([!finalPost?.imageIds.length, !project.visualDirection]);
  const platformFitScore = scoreFromIssues([(finalPost?.tags.length ?? 0) === 0, (finalPost?.tags.length ?? 0) > 10]);
  const complianceScore = scoreFromIssues([risky.length > 0, exaggerated.length > 1]);
  const hasCriticalPublishRisk = Boolean(
    !finalPost?.title ||
      !finalPost.content ||
      !finalPost.tags.length ||
      !finalPost.imageIds.length ||
      exaggerated.length ||
      risky.length
  );
  const canPublish = !hasCriticalPublishRisk && complianceScore >= 70;

  if (canPublish && !suggestions.length) {
    suggestions.push("发布前仍需人工确认账号、可见范围、图片版本和定时时区。");
  }

  return {
    titleScore,
    copyScore,
    visualConsistencyScore,
    platformFitScore,
    complianceScore,
    canPublish,
    issues,
    suggestions,
    checkedAt: new Date().toISOString()
  };
}

function finalPostFromDraft(project: Pick<PostProject, "copyDraft" | "selectedImages">): FinalPost | undefined {
  if (!project.copyDraft) return undefined;
  return {
    title: project.copyDraft.draft.title,
    content: project.copyDraft.draft.content,
    tags: project.copyDraft.draft.tags,
    imageIds: project.selectedImages,
    coverImageId: project.selectedImages[0],
    copyVersionId: `copy-${project.copyDraft.id}`,
    imagePromptVersionIds: []
  };
}

function scoreFromIssues(flags: boolean[]): number {
  const penalty = flags.filter(Boolean).length * 18;
  return Math.max(0, 100 - penalty);
}
