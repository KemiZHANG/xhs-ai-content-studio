type ViralSaveCandidateReview = {
  sampleId?: string;
  shouldSave?: boolean;
  warnings?: string[];
  reasons?: string[];
  score?: number;
};

type ViralSaveErrorPayload = {
  error?: string;
  candidateReviews?: ViralSaveCandidateReview[];
  skippedSampleIds?: string[];
};

export function formatViralSaveError(error: unknown): string {
  const payload = extractErrorPayload(error);
  const reviews = Array.isArray(payload?.candidateReviews) ? payload.candidateReviews : [];
  const rejected = reviews.filter((review) => review.shouldSave === false);
  if (!payload || !reviews.length || !rejected.length) {
    return error instanceof Error ? error.message : "保存爆款库失败";
  }

  const names = rejected
    .map((review) => review.sampleId)
    .filter((value): value is string => Boolean(value))
    .slice(0, 4)
    .join("、");
  const warnings = rejected
    .flatMap((review) => review.warnings ?? [])
    .filter(Boolean)
    .slice(0, 4);
  const reasons = rejected
    .flatMap((review) => review.reasons ?? [])
    .filter(Boolean)
    .slice(0, 3);
  const skipped = Array.isArray(payload.skippedSampleIds) && payload.skippedSampleIds.length
    ? `已跳过：${payload.skippedSampleIds.slice(0, 4).join("、")}。`
    : "";

  return [
    payload.error ?? "没有达到爆款库入库质量门槛的样本。",
    names ? `未入库样本：${names}。` : "",
    warnings.length ? `原因：${warnings.join("；")}。` : reasons.length ? `原因：${reasons.join("；")}。` : "",
    skipped,
    "建议先保存点赞/收藏/评论更高、正文和评论信息更完整的样本；确实要保留弱参考时，可后续走“强制保存/弱参考”入口。"
  ].filter(Boolean).join(" ");
}

function extractErrorPayload(error: unknown): ViralSaveErrorPayload | null {
  if (!isRecord(error)) return null;
  const data = error.data;
  return isRecord(data) ? data as ViralSaveErrorPayload : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}
