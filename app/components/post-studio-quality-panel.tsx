"use client";

import type { QualityViralCoverageView } from "@/app/components/quality-viral-coverage";
import type { PostProject } from "@/app/types";
import type { EvidenceCitationReport } from "@/lib/post-project/citations";

type QualityCheck = NonNullable<PostProject["qualityCheck"]>;

export function PostStudioQualityPanel({
  quality,
  qualityViralCoverage,
  citationReport,
  citationTraceReady
}: {
  quality: QualityCheck | undefined;
  qualityViralCoverage: QualityViralCoverageView;
  citationReport: EvidenceCitationReport | null;
  citationTraceReady: boolean;
}) {
  if (!quality) return null;

  return (
    <div className="qualityBox">
      <strong>{quality.canPublish ? "质量检查通过" : "质量检查需要处理"}</strong>
      <div className="qualityScores">
        <span>标题 {quality.titleScore}</span>
        <span>正文 {quality.copyScore}</span>
        <span>图文 {quality.visualConsistencyScore}</span>
        <span>平台 {quality.platformFitScore}</span>
        <span>合规 {quality.complianceScore}</span>
      </div>
      {quality.issues.slice(0, 3).map((issue) => (
        <p className="muted" key={issue}>- {issue}</p>
      ))}
      {quality.issues.length || quality.suggestions.length ? (
        <div className="qualityActionList" aria-label="Quality Gate action list">
          {quality.issues.slice(0, 3).map((issue) => (
            <div className="qualityActionItem issue" key={`issue-${issue}`}>
              <span>阻塞项</span>
              <strong>{issue}</strong>
            </div>
          ))}
          {quality.suggestions.slice(0, 3).map((suggestion) => (
            <div className="qualityActionItem suggestion" key={`suggestion-${suggestion}`}>
              <span>建议优化</span>
              <strong>{suggestion}</strong>
            </div>
          ))}
          {quality.issues.length > 3 || quality.suggestions.length > 3 ? (
            <small>还有 {Math.max(quality.issues.length - 3, 0) + Math.max(quality.suggestions.length - 3, 0)} 条细节，已收进发布检查详情。</small>
          ) : null}
        </div>
      ) : null}
      {quality.evidenceReview ? (
        <p className="muted">证据覆盖：{quality.evidenceReview.summary}</p>
      ) : null}
      <QualityViralCoverageStrip view={qualityViralCoverage} />
      {quality.originalityReview ? (
        <p className={quality.originalityReview.isSafe ? "muted" : "qualityWarningText"}>
          原创边界：{quality.originalityReview.summary}
        </p>
      ) : null}
      {citationReport?.allEvidenceIds.length ? (
        <div className={citationTraceReady ? "citationAudit ok" : "citationAudit warn"}>
          <span>字段级证据追踪</span>
          <strong>{citationReport.summary}</strong>
          <div>
            {citationReport.sections.map((section) => (
              <em key={section.field}>{labelForCitationField(section.field)} {section.insights.length}</em>
            ))}
          </div>
          {citationReport.missingEvidenceIds.length ? (
            <p>缺失：{citationReport.missingEvidenceIds.slice(0, 3).join(" / ")}</p>
          ) : null}
        </div>
      ) : null}
      {quality.evidenceAlignment ? (
        <div className={quality.evidenceAlignment.isAligned ? "evidenceAlignment ok" : "evidenceAlignment warn"}>
          <span>图文证据</span>
          <strong>{quality.evidenceAlignment.summary}</strong>
          <p>
            文案 {quality.evidenceAlignment.copyEvidenceIds.length} 条 · 图片 {quality.evidenceAlignment.visualEvidenceIds.length} 条 · 共同 {quality.evidenceAlignment.sharedEvidenceIds.length} 条
          </p>
        </div>
      ) : null}
    </div>
  );
}

function QualityViralCoverageStrip({ view }: { view: QualityViralCoverageView }) {
  if (!view.hasCoverage) return null;
  return (
    <div className="qualityViralCoverage" aria-label="Quality Gate 爆款库覆盖">
      <div>
        <strong>{view.headline}</strong>
        <span>{view.detail}</span>
      </div>
      <div>
        {view.items.map((item) => (
          <em className={item.status} key={item.field} title={item.line}>
            <b>{item.label}</b>
            {item.line}
          </em>
        ))}
      </div>
    </div>
  );
}

function labelForCitationField(field: string): string {
  const labels: Record<string, string> = {
    title: "标题",
    content: "正文",
    tags: "标签",
    imagePrompt: "图片方向"
  };
  return labels[field] ?? field;
}
