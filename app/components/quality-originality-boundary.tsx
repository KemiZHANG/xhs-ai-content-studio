"use client";

import type { PostProject } from "@/app/types";

type QualityCheck = NonNullable<PostProject["qualityCheck"]>;

export function QualityOriginalityBoundary({
  review,
  compact = false
}: {
  review: NonNullable<QualityCheck["originalityReview"]>;
  compact?: boolean;
}) {
  const visibleRules = review.rules.slice(0, compact ? 2 : 3);
  const visibleSourceIds = review.sourceSampleIds.slice(0, compact ? 3 : 4);
  const visibleRisks = review.riskSamples.slice(0, compact ? 2 : 3);
  const hiddenDetailCount = Math.max(review.rules.length - visibleRules.length, 0)
    + Math.max(review.sourceSampleIds.length - visibleSourceIds.length, 0)
    + Math.max(review.riskSamples.length - visibleRisks.length, 0);

  return (
    <div
      className={`${review.isSafe ? "qualityOriginalityBoundary ok" : "qualityOriginalityBoundary warn"}${compact ? " compact" : ""}`}
      aria-label="Quality Gate 原创安全边界"
    >
      <span>{review.isSafe ? "原创边界" : "原创边界风险"}</span>
      <strong>{review.summary}</strong>
      {visibleRules.length ? (
        <div className="qualityOriginalityRows" aria-label="可学习规则">
          {visibleRules.map((rule) => (
            <em key={rule}>只学规律：{rule}</em>
          ))}
        </div>
      ) : null}
      {visibleSourceIds.length ? (
        <p>参考样本：{visibleSourceIds.join(" / ")}</p>
      ) : null}
      {visibleRisks.length ? (
        <div className="qualityOriginalityRows risk" aria-label="近似复刻风险">
          {visibleRisks.map((risk) => (
            <em key={risk}>风险样本：{risk}</em>
          ))}
        </div>
      ) : null}
      {hiddenDetailCount ? (
        <small>另有 {hiddenDetailCount} 条边界细节已收进发布检查详情。</small>
      ) : null}
    </div>
  );
}
