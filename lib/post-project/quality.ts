import { buildEvidenceCitationReport } from "@/lib/post-project/citations";
import type { FinalPost, PostProject, QualityCheck } from "@/lib/post-project/types";

const exaggeratedWords = ["最", "第一", "必买", "永久", "绝对", "无敌", "闭眼入", "封神"];
const riskyClaims = ["认证", "销量", "全网", "官方", "治愈", "疗效", "保证", "before", "after"];

export function runPostQualityGate(project: Pick<
  PostProject,
  "finalPost" | "copyDraft" | "selectedImages" | "creativeBrief" | "visualDirection"
> & Partial<Pick<PostProject, "selectedSamples" | "evidencePack" | "imagePrompts">>): QualityCheck {
  const finalPost = project.finalPost ?? finalPostFromDraft(project);
  const issues: string[] = [];
  const suggestions: string[] = [];

  if (!finalPost?.title.trim()) issues.push("标题为空");
  if (!finalPost?.content.trim()) issues.push("正文为空");
  if (!finalPost?.tags.length) issues.push("标签为空");
  if (!finalPost?.imageIds.length) issues.push("未选择发布图片");
  if (!project.creativeBrief) issues.push("缺少 CreativeBrief，文案和图片可能没有共享创作依据");
  if (!project.evidencePack?.insights.length) issues.push("缺少可追溯证据，不能把生成结果伪装成研究结论");
  const evidenceIds = new Set((project.evidencePack?.insights ?? []).map((insight) => insight.id));
  const draftEvidenceIds = project.copyDraft?.draft.basedOnEvidenceIds ?? [];
  const visualEvidenceIds = collectVisualEvidenceIds(project);
  const hasVisualEvidenceMissing = Boolean(project.visualDirection && !visualEvidenceIds.length);
  const hasVisualEvidenceMismatch = Boolean(
    project.visualDirection &&
      draftEvidenceIds.length &&
      visualEvidenceIds.length &&
      !hasStringOverlap(draftEvidenceIds, visualEvidenceIds)
  );
  const evidenceAlignment = buildEvidenceAlignment(draftEvidenceIds, visualEvidenceIds, Boolean(project.visualDirection));
  const evidenceReview = buildEvidenceReview(project, draftEvidenceIds);
  const evidencePack = project.evidencePack;
  const citationReport = project.copyDraft && evidencePack?.insights.length
    ? buildEvidenceCitationReport({ evidencePack, creativeBrief: project.creativeBrief }, draftEvidenceIds, project.copyDraft.draft.evidenceReferences)
    : null;
  const finalImageIds = finalPost?.imageIds ?? [];
  const selectedImageIds = project.selectedImages ?? [];
  const hasStaleFinalImages = Boolean(
    finalPost &&
      selectedImageIds.length &&
      finalImageIds.length &&
      !sameStringSet(finalImageIds, selectedImageIds)
  );
  if (project.copyDraft && !draftEvidenceIds.length) {
    issues.push("当前草稿缺少 basedOnEvidenceIds，无法证明标题、正文和标签来自 evidencePack 规律");
    suggestions.push("请重新基于当前证据生成文案，或补充草稿引用的证据 ID。");
  }
  const invalidEvidenceIds = draftEvidenceIds.filter((id) => !evidenceIds.has(id));
  if (invalidEvidenceIds.length) {
    issues.push(`当前草稿引用了不存在的证据 ID：${invalidEvidenceIds.slice(0, 3).join("、")}`);
    suggestions.push("请从当前 evidencePack 重新生成文案，保证所有引用可追溯。");
  }
  if (citationReport?.missingEvidenceIds.length) {
    issues.push(`标题/正文/标签/图片方向存在不可追溯证据：${citationReport.missingEvidenceIds.slice(0, 3).join("、")}`);
    suggestions.push("请重新生成文案或图片方向，确保每个创作字段都只引用当前 evidencePack 中的证据。");
  }
  citationReport?.warnings
    .filter((warning) => !warning.includes("证据 ID 不在当前 evidencePack"))
    .slice(0, 2)
    .forEach((warning) => suggestions.push(warning));

  if (hasStaleFinalImages) {
    issues.push("最终帖子图片版本与当前选中图片不一致");
    suggestions.push("请重新组装最终帖子或确认当前选中的图片版本，避免误发旧图。");
  }

  if (hasVisualEvidenceMissing) {
    issues.push("图片方向缺少 basedOnEvidenceIds，无法证明图片策略来自 CreativeBrief 和 evidencePack");
    suggestions.push("请重新基于当前证据生成图片方向或图片 Prompt，确保图文共享同一套创作证据。");
  }
  if (hasVisualEvidenceMismatch) {
    issues.push("图片方向与文案引用的证据不一致，图文可能各走各的爆款逻辑");
    suggestions.push("请基于同一个 CreativeBrief 重新生成图片方向/Prompt，或重新生成文案，确保图文共用同一个证据包。");
  }

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

  const copiedSampleTitle = findOverCopiedSample(titleText, bodyText, [
    ...(project.selectedSamples ?? []),
    ...extractViralSourceSamples(project.evidencePack?.summary)
  ]);
  if (copiedSampleTitle) {
    issues.push(`疑似过度仿写样本：${copiedSampleTitle}`);
    suggestions.push("保留结构规律，重写标题表达、叙述顺序和具体细节，避免贴近原帖。");
  }

  const titleScore = scoreFromIssues([!titleText.trim(), exaggerated.length > 0]);
  const copyScore = scoreFromIssues([
    !bodyText.trim(),
    bodyText.length < 80,
    risky.length > 0,
    Boolean(copiedSampleTitle),
    project.copyDraft ? !draftEvidenceIds.length || invalidEvidenceIds.length > 0 || Boolean(citationReport?.missingEvidenceIds.length) : false
  ]);
  const visualConsistencyScore = scoreFromIssues([
    !finalPost?.imageIds.length,
    !project.visualDirection,
    hasStaleFinalImages,
    hasVisualEvidenceMissing,
    hasVisualEvidenceMismatch
  ]);
  const platformFitScore = scoreFromIssues([(finalPost?.tags.length ?? 0) === 0, (finalPost?.tags.length ?? 0) > 10]);
  const complianceScore = scoreFromIssues([risky.length > 0, exaggerated.length > 1, Boolean(copiedSampleTitle)]);
  const hasCriticalPublishRisk = Boolean(
    !finalPost?.title ||
      !finalPost.content ||
      !finalPost.tags.length ||
      !finalPost.imageIds.length ||
      hasStaleFinalImages ||
      hasVisualEvidenceMissing ||
      hasVisualEvidenceMismatch ||
      exaggerated.length ||
      risky.length ||
      copiedSampleTitle ||
      (project.copyDraft ? !draftEvidenceIds.length || invalidEvidenceIds.length > 0 || Boolean(citationReport?.missingEvidenceIds.length) : false)
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
    evidenceReview,
    evidenceAlignment,
    checkedAt: new Date().toISOString()
  };
}

function buildEvidenceAlignment(
  draftEvidenceIds: string[],
  visualEvidenceIds: string[],
  hasVisualDirection: boolean
): NonNullable<QualityCheck["evidenceAlignment"]> {
  const copyEvidenceIds = uniqueStrings(draftEvidenceIds).slice(0, 12);
  const visualIds = uniqueStrings(visualEvidenceIds).slice(0, 12);
  const sharedEvidenceIds = copyEvidenceIds.filter((id) => visualIds.includes(id));
  const isAligned = !hasVisualDirection || !copyEvidenceIds.length || !visualIds.length || sharedEvidenceIds.length > 0;
  const summary = hasVisualDirection
    ? isAligned
      ? sharedEvidenceIds.length
        ? `图文共享 ${sharedEvidenceIds.length} 条证据`
        : "证据引用不足，未形成强校验"
      : "文案与图片方向没有共享证据"
    : "尚未生成图片方向";

  return {
    copyEvidenceIds,
    visualEvidenceIds: visualIds,
    sharedEvidenceIds,
    isAligned,
    summary
  };
}

function buildEvidenceReview(
  project: Partial<Pick<PostProject, "copyDraft" | "creativeBrief" | "visualDirection" | "imagePrompts" | "evidencePack">>,
  draftEvidenceIds: string[]
): QualityCheck["evidenceReview"] {
  const insights = project.evidencePack?.insights ?? [];
  const insightIds = new Set(insights.map((insight) => insight.id));
  const referencedEvidenceIds = uniqueStrings([
    ...draftEvidenceIds,
    ...(project.creativeBrief?.basedOnEvidenceIds ?? []),
    ...(project.visualDirection?.basedOnEvidenceIds ?? []),
    ...collectVisualEvidenceIds(project)
  ]).slice(0, 20);
  const missingEvidenceIds = referencedEvidenceIds.filter((id) => !insightIds.has(id));
  const realtimeEvidenceIds = referencedEvidenceIds.filter((id) => {
    const insight = insights.find((item) => item.id === id);
    return insight && (insight.sourceType ?? "realtime") === "realtime";
  });
  const viralEvidenceIds = referencedEvidenceIds.filter((id) => {
    const insight = insights.find((item) => item.id === id);
    return insight?.sourceType === "viral_library";
  });
  const summary = [
    `引用证据 ${referencedEvidenceIds.length} 条`,
    `实时研究 ${realtimeEvidenceIds.length} 条`,
    `爆款库 ${viralEvidenceIds.length} 条`,
    missingEvidenceIds.length ? `缺失 ${missingEvidenceIds.length} 条` : "无缺失证据"
  ].join("；");
  return {
    referencedEvidenceIds,
    realtimeEvidenceIds,
    viralEvidenceIds,
    missingEvidenceIds,
    summary
  };
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

function collectVisualEvidenceIds(
  project: Partial<Pick<PostProject, "visualDirection" | "imagePrompts">>
): string[] {
  return uniqueStrings([
    ...(project.visualDirection?.basedOnEvidenceIds ?? []),
    ...(project.imagePrompts ?? []).flatMap((prompt) => prompt.basedOnEvidenceIds ?? [])
  ]);
}

function hasStringOverlap(left: string[], right: string[]): boolean {
  const rightSet = new Set(right);
  return left.some((item) => rightSet.has(item));
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

function findOverCopiedSample(title: string, body: string, samples: unknown[]): string | null {
  const normalizedTitle = normalizeForSimilarity(title);
  const normalizedBody = normalizeForSimilarity(body);
  for (const sample of samples) {
    if (!isRecord(sample)) continue;
    const sampleTitle = typeof sample.title === "string" ? sample.title : "";
    const sampleBody = typeof sample.detailText === "string" ? sample.detailText : "";
    const normalizedSampleTitle = normalizeForSimilarity(sampleTitle);
    const normalizedSampleBody = normalizeForSimilarity(sampleBody);
    if (normalizedTitle && normalizedSampleTitle && normalizedTitle === normalizedSampleTitle) {
      return sampleTitle;
    }
    if (normalizedBody && normalizedSampleBody && overlapRatio(normalizedBody, normalizedSampleBody) > 0.72) {
      return sampleTitle || "未命名样本";
    }
  }
  return null;
}

function extractViralSourceSamples(summary: unknown): unknown[] {
  if (!isRecord(summary)) return [];
  const viralKnowledge = summary.viralKnowledge;
  if (!isRecord(viralKnowledge) || !Array.isArray(viralKnowledge.results)) return [];
  return viralKnowledge.results
    .map((item) => {
      if (!isRecord(item) || !isRecord(item.case)) return null;
      const extractedInsights = isRecord(item.case.extractedInsights) ? item.case.extractedInsights : {};
      const reusablePatternText = [
        ...stringArray(extractedInsights.reusableRules),
        ...stringArray(extractedInsights.titleHooks),
        ...stringArray(extractedInsights.copyStructures),
        ...stringArray(extractedInsights.tagPatterns),
        ...stringArray(extractedInsights.visualPatterns)
      ].join(" ");
      return {
        title: typeof item.case.title === "string" ? item.case.title : "",
        detailText: [
          typeof item.case.bodyExcerpt === "string" ? item.case.bodyExcerpt : "",
          reusablePatternText
        ].filter(Boolean).join(" "),
        sourceType: "viral_library"
      };
    })
    .filter(Boolean);
}

function normalizeForSimilarity(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\u4e00-\u9fa5]+/gu, "");
}

function overlapRatio(a: string, b: string): number {
  if (a.length < 40 || b.length < 40) return 0;
  const gramsA = new Set(ngrams(a, 4));
  const gramsB = new Set(ngrams(b, 4));
  if (!gramsA.size || !gramsB.size) return 0;
  let overlap = 0;
  for (const gram of gramsA) {
    if (gramsB.has(gram)) overlap += 1;
  }
  return overlap / Math.min(gramsA.size, gramsB.size);
}

function ngrams(value: string, size: number): string[] {
  const grams: string[] = [];
  for (let index = 0; index <= value.length - size; index += 1) {
    grams.push(value.slice(index, index + size));
  }
  return grams;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function scoreFromIssues(flags: boolean[]): number {
  const penalty = flags.filter(Boolean).length * 18;
  return Math.max(0, 100 - penalty);
}
