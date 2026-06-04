"use client";

import type { ViralCase, WorkflowResult } from "@/app/types";

type ViralKnowledgePack = NonNullable<WorkflowResult["viralKnowledge"]>;
type ViralScoreBreakdown = NonNullable<ViralKnowledgePack["results"][number]["scoreBreakdown"]>;

export type RecentViralSummary = {
  item: ViralCase;
  learnings: string[];
  rewriteRules: string[];
};

export function ViralStrategyCard({ viralPack }: { viralPack: ViralKnowledgePack | null }) {
  if (!viralPack?.strategyReport) return null;

  return (
    <div className="viralStrategyCard">
      <strong>爆款策略摘要</strong>
      <p>{viralPack.strategyReport.summary}</p>
      {viralPack.results?.length ? (
        <div className="ragAngleStrip" aria-label="爆款库检索角度">
          {viralPack.results.slice(0, 4).map((result) => (
            <span key={result.case.id} title={[...(result.matchedQueries ?? []), ...result.reasons].slice(0, 3).join(" / ")}>
              {result.angleSummary || `${result.case.hookType} · ${result.case.category}`}
            </span>
          ))}
        </div>
      ) : null}
      <ViralSourceTraceList viralPack={viralPack} />
      <div className="viralStrategyGrid">
        <KnowledgeList title="标题打法" items={viralPack.strategyReport.titleMoves} />
        <KnowledgeList title="正文结构" items={viralPack.strategyReport.structureMoves} />
        <KnowledgeList title="图片方向" items={viralPack.strategyReport.visualMoves} />
        <KnowledgeList title="原创边界" items={viralPack.strategyReport.originalityRules} />
      </div>
    </div>
  );
}

function ViralSourceTraceList({ viralPack }: { viralPack: ViralKnowledgePack }) {
  const traces = buildViralSourceTraceItems(viralPack).slice(0, 3);
  if (!traces.length) return null;
  return (
    <div className="viralSourceTraceList" aria-label="爆款库来源追踪">
      <strong>来源追踪</strong>
      {traces.map((trace) => (
        <article key={trace.caseId}>
          <span>
            {trace.caseId}
            {trace.score ? ` · ${trace.score}` : ""}
          </span>
          <p>{trace.matchedQueries.length ? trace.matchedQueries.slice(0, 2).join(" / ") : "来自本次 RAG 命中样本"}</p>
          {trace.reasons.length ? <small>命中原因：{trace.reasons.slice(0, 2).join(" / ")}</small> : null}
          {trace.scoreBreakdown ? <small>评分拆解：{trace.scoreBreakdown}</small> : null}
          {trace.evidenceInsightIds.length ? <small>进入 evidencePack：{trace.evidenceInsightIds.slice(0, 4).join(" / ")}</small> : null}
        </article>
      ))}
    </div>
  );
}

function buildViralSourceTraceItems(viralPack: ViralKnowledgePack): Array<{
  caseId: string;
  score: string;
  matchedQueries: string[];
  reasons: string[];
  evidenceInsightIds: string[];
  scoreBreakdown: string;
}> {
  const resultsByCaseId = new Map((viralPack.results ?? []).map((result) => [result.case.id, result]));
  const traces = viralPack.evidenceTrace?.map((trace) => ({
    caseId: trace.caseId,
    score: Number.isFinite(trace.score) ? trace.score.toFixed(2) : "",
    matchedQueries: trace.matchedQueries ?? [],
    reasons: trace.reasons ?? [],
    evidenceInsightIds: trace.evidenceInsightIds ?? [],
    scoreBreakdown: formatScoreBreakdown(resultsByCaseId.get(trace.caseId)?.scoreBreakdown)
  })) ?? [];
  const fallback = viralPack.results?.map((result) => ({
    caseId: result.case.id,
    score: Number.isFinite(result.score) ? result.score.toFixed(2) : "",
    matchedQueries: result.matchedQueries ?? [],
    reasons: result.reasons ?? [],
    evidenceInsightIds: [],
    scoreBreakdown: formatScoreBreakdown(result.scoreBreakdown)
  })) ?? [];
  return uniqueTraceItems([...traces, ...fallback]);
}

function formatScoreBreakdown(scoreBreakdown?: ViralScoreBreakdown): string {
  if (!scoreBreakdown) return "";
  return [
    ["语义", scoreBreakdown.semantic],
    ["关键词", scoreBreakdown.keyword],
    ["互动", scoreBreakdown.metrics],
    ["质量", scoreBreakdown.quality],
    ["筛选", scoreBreakdown.filters]
  ]
    .filter(([, value]) => Number.isFinite(value) && Number(value) > 0)
    .map(([label, value]) => `${label} ${Number(value).toFixed(2)}`)
    .join(" / ");
}

function uniqueTraceItems<T extends { caseId: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.caseId || seen.has(item.caseId)) return false;
    seen.add(item.caseId);
    return true;
  });
}

export function RecentViralPanel({
  summaries,
  onOpenCase
}: {
  summaries: RecentViralSummary[];
  onOpenCase: (viralCase: ViralCase) => void;
}) {
  if (!summaries.length) return null;

  return (
    <div className="viralRecentPanel">
      <strong>最近入库提炼</strong>
      {summaries.map(({ item, learnings, rewriteRules }) => (
        <article key={item.id}>
          <div>
            <span className={item.extraction.method === "model" ? "viralExtractionBadge model" : "viralExtractionBadge"}>
              {labelForViralExtraction(item.extraction.method)} · {item.category}
            </span>
            {item.quality ? <span className="viralExtractionBadge">规律质量 {Math.round(item.quality.score * 100)}%</span> : null}
            <button className="textButton" type="button" onClick={() => onOpenCase(item)}>查看</button>
          </div>
          <h4>{item.hookType || item.title}</h4>
          <p>{item.creativeSafety?.summary || learnings[0] || "已入库，等待更多样本补齐可复用规律。"}</p>
          <small>可学：{learnings.slice(0, 2).join(" / ") || "等待更多样本沉淀"}</small>
          <small>必须改写：{rewriteRules.slice(0, 2).join(" / ") || "不要复用原文表达和原图"}</small>
          {item.extraction.fallbackReason ? <small>提炼说明：{item.extraction.fallbackReason}</small> : null}
        </article>
      ))}
    </div>
  );
}

function KnowledgeList({ title, items }: { title: string; items: string[] }) {
  const visible = items.map((item) => item.trim()).filter(Boolean).slice(0, 5);
  if (!visible.length) return null;
  return (
    <article>
      <strong>{title}</strong>
      <ul>
        {visible.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </article>
  );
}

function labelForViralExtraction(method: ViralCase["extraction"]["method"]): string {
  return method === "model" ? "AI 提炼" : "本地启发式";
}
