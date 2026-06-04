import type { SampleEvidence } from "@/app/types";
import { scoreEvidence } from "@/app/components/evidence-display";

export type ViralSaveCandidate = {
  sample: SampleEvidence;
  score: number;
  reasons: string[];
  warnings: string[];
  shouldSave: boolean;
};

export type ViralSaveCandidateModel = {
  candidates: ViralSaveCandidate[];
  rejectedSamples: ViralSaveCandidate[];
  rejectedCount: number;
  hiddenCandidateCount: number;
  totalCount: number;
  headline: string;
  detail: string;
  actionLabel: string;
};

export function buildViralSaveCandidateModel(
  samples: SampleEvidence[],
  limit = 3
): ViralSaveCandidateModel {
  const reviewed = samples.map(reviewViralCandidateForUi);
  const approved = reviewed
    .filter((item) => item.shouldSave)
    .sort((left, right) => right.score - left.score)
  const candidates = approved.slice(0, Math.max(0, limit));
  const rejectedSamples = reviewed
    .filter((item) => !item.shouldSave)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
  const rejectedCount = reviewed.length - approved.length;
  const hiddenCandidateCount = Math.max(0, approved.length - candidates.length);

  return {
    candidates,
    rejectedSamples,
    rejectedCount,
    hiddenCandidateCount,
    totalCount: samples.length,
    headline: candidates.length
      ? `发现 ${candidates.length} 条爆款库候选`
      : samples.length
        ? "暂未发现适合入库的高质量样本"
        : "等待研究样本",
    detail: candidates.length
      ? "这些样本互动、正文/评论或图片证据更完整，适合提取标题钩子、结构、标签和视觉规律。"
      : samples.length
        ? "当前样本证据偏薄，可继续搜索或打开详情人工挑选后保存。"
        : "完成主题研究后，系统会先筛选值得沉淀的样本，而不是把所有原文都塞进爆款库。",
    actionLabel: candidates.length
      ? `一键沉淀 ${candidates.length} 条候选`
      : "先继续研究"
  };
}

export function reviewViralCandidateForUi(sample: SampleEvidence): ViralSaveCandidate {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const engagement = scoreEvidence(sample);
  const likes = Number(sample.likes) || 0;
  const collects = Number(sample.collects) || 0;
  const comments = Number(sample.comments) || 0;
  const shares = Number(sample.shares) || 0;
  const detailLength = sample.detailText?.trim().length ?? 0;
  const commentSnippetCount = sample.commentSnippets?.filter(Boolean).length ?? 0;
  const imageCount = (sample.cachedImageUrls?.length ?? 0) + (sample.imageUrls?.length ?? 0);
  let score = 0;

  if (engagement >= 1000 || likes + collects >= 1000) {
    score += 35;
    reasons.push("互动信号强");
  } else if (engagement >= 300 || likes + collects >= 300) {
    score += 22;
    reasons.push("互动信号可参考");
  } else if (likes + collects + comments + shares > 0) {
    score += 8;
    warnings.push("互动数据偏弱");
  } else {
    warnings.push("缺少互动数据");
  }

  if (collects >= 300) {
    score += 20;
    reasons.push("收藏量高，适合沉淀选题规律");
  } else if (collects >= 80) {
    score += 10;
    reasons.push("有一定收藏价值");
  } else {
    warnings.push("收藏信号不足");
  }

  if (detailLength >= 120) {
    score += 20;
    reasons.push("正文信息足够提取结构");
  } else if (detailLength >= 40) {
    score += 10;
    reasons.push("有可参考正文片段");
  } else {
    warnings.push("正文证据偏少");
  }

  if (commentSnippetCount >= 2) {
    score += 10;
    reasons.push("评论能补充用户关注点");
  } else if (comments > 0) {
    score += 4;
    warnings.push("评论片段不足");
  }

  if (imageCount >= 2) {
    score += 10;
    reasons.push("图片风格可学习");
  } else if (imageCount === 0) {
    warnings.push("缺少图片参考");
  }

  if (sample.reasonHighlights?.length) {
    score += 5;
    reasons.push("已有排序理由");
  }

  return {
    sample,
    score,
    reasons: reasons.slice(0, 4),
    warnings: warnings.slice(0, 4),
    shouldSave: score >= 45 && reasons.length >= 2
  };
}
