"use client";

import type { ReactNode } from "react";
import { FileText, Library, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { EvidencePanelModel } from "@/app/components/evidence-display";
import type { StudioTabSummary } from "@/app/components/studio-tab-summary";
import type { ViralEvidenceSummaryModel } from "@/app/components/viral-evidence-summary";
import type { ViralSaveCandidateModel } from "@/app/components/viral-save-candidates";
import type { CreatorMemoryProfile, PostProject, SampleEvidence } from "@/app/types";
import { buildCreatorMemoryDigest } from "@/lib/agent/memory-digest";
import type { EvidenceCitationReport, EvidenceReferenceSummary } from "@/lib/post-project/citations";

type EvidenceInsight = PostProject["evidencePack"]["insights"][number];
type CreativeBrief = NonNullable<PostProject["creativeBrief"]>;

export function PostStudioInsightsTab({
  realtimeCount,
  viralCount,
  viralEvidenceSummary,
  keyLearningInsights,
  totalInsightCount,
  citationReport,
  creatorMemory,
  projectMemory,
  onOpenViral
}: {
  realtimeCount: number;
  viralCount: number;
  viralEvidenceSummary: ViralEvidenceSummaryModel;
  keyLearningInsights: EvidenceInsight[];
  totalInsightCount: number;
  citationReport: EvidenceCitationReport | null;
  creatorMemory: CreatorMemoryProfile | null;
  projectMemory: string[];
  onOpenViral: () => void;
}) {
  return (
    <SideSection icon={FileText} title="可学习结论">
      <div className="evidenceSourceStrip">
        <span>实时证据 {realtimeCount}</span>
        <span>爆款库 {viralCount}</span>
      </div>
      <EvidenceSourceBreakdown
        realtimeCount={realtimeCount}
        viralCount={viralCount}
        userInputCount={Number(citationReport?.sourceCounts.user_input ?? 0)}
      />
      <ViralEvidenceDigest summary={viralEvidenceSummary} compact onOpenViral={onOpenViral} />
      {keyLearningInsights.length ? (
        <>
          {keyLearningInsights.slice(0, 5).map((insight) => (
            <article className="insightLine" key={insight.id}>
              <span>{labelForInsight(insight.type)} · {labelForSource(insight.sourceType)}</span>
              <p>{insight.insight}</p>
            </article>
          ))}
          {totalInsightCount > keyLearningInsights.length ? (
            <p className="muted">已压缩展示 {Math.min(keyLearningInsights.length, 5)} 条核心规律；完整实时样本、爆款库来源和评论在“证据 / 爆款库”里查看。</p>
          ) : null}
          <CitationSummaryBox citationReport={citationReport} />
          <CreatorMemorySummary memory={creatorMemory} projectMemory={projectMemory} />
        </>
      ) : (
        <>
          <p className="muted">研究完成后这里只显示 3-5 条核心结论；完整样本、评论和原文放在证据详情里。</p>
          <CreatorMemorySummary memory={creatorMemory} projectMemory={projectMemory} />
        </>
      )}
    </SideSection>
  );
}

export function PostStudioBriefTab({
  summary,
  brief,
  briefEvidenceSummary,
  visualEvidenceSummary,
  onQuickAction
}: {
  summary: StudioTabSummary;
  brief: CreativeBrief | null | undefined;
  briefEvidenceSummary?: EvidenceReferenceSummary | null;
  visualEvidenceSummary?: EvidenceReferenceSummary | null;
  onQuickAction: (action: string) => void;
}) {
  return (
    <SideSection icon={Sparkles} title="CreativeBrief">
      <StudioTaskSummary summary={summary} onQuickAction={onQuickAction} />
      {brief ? (
        <div className="briefStack">
          <BriefLine label="人群" value={brief.audience} />
          <BriefLine label="痛点" value={brief.painPoint} />
          <BriefLine label="角度" value={brief.contentAngle} />
          <BriefLine label="语气" value={brief.tone} />
          <BriefLine label="视觉" value={brief.visualMood} />
          {briefEvidenceSummary?.insights.length ? (
            <EvidenceReferenceBox title="Brief 参考证据" summary={briefEvidenceSummary} />
          ) : null}
          {visualEvidenceSummary?.insights.length ? (
            <EvidenceReferenceBox title="图片方向参考证据" summary={visualEvidenceSummary} />
          ) : null}
          <ChipList title="证明点" items={brief.proofPoints} />
          <ChipList title="图片必须有" items={brief.imageMustHave} />
          <ChipList title="图片避免" items={brief.imageMustAvoid} />
          <ChipList title="禁忌词" items={brief.tabooWords} />
          <ChipList title="合规 / 原创边界" items={brief.complianceNotes} />
        </div>
      ) : (
        <p className="muted">完成研究后，系统会把标题、正文、标签和图片规律压缩成统一 Brief，文案和图片都从这里出发。</p>
      )}
    </SideSection>
  );
}

export function PostStudioEvidenceTab({
  evidencePanel,
  viralSaveCandidates,
  saveableSamples,
  summarizeEvidenceSample,
  onOpenEvidenceCatalog,
  onOpenWorkflow,
  onSaveManyToViralLibrary,
  onOpenSample,
  onSaveToViralLibrary
}: {
  evidencePanel: EvidencePanelModel;
  viralSaveCandidates: ViralSaveCandidateModel;
  saveableSamples: SampleEvidence[];
  summarizeEvidenceSample: (sample: SampleEvidence) => string;
  onOpenEvidenceCatalog: () => void;
  onOpenWorkflow: () => void;
  onSaveManyToViralLibrary: (samples: SampleEvidence[]) => void;
  onOpenSample: (sample: SampleEvidence) => void;
  onSaveToViralLibrary: (sample: SampleEvidence) => void;
}) {
  const openPrimary = evidencePanel.totalCount ? onOpenEvidenceCatalog : onOpenWorkflow;
  const visibleSaveCandidates = viralSaveCandidates.candidates.slice(0, 3);
  const hiddenSaveCandidateCount = Math.max(0, viralSaveCandidates.hiddenCandidateCount ?? viralSaveCandidates.candidates.length - visibleSaveCandidates.length);
  const rejectedSamples = viralSaveCandidates.rejectedSamples?.slice(0, 2) ?? [];

  return (
    <>
      <EvidencePanelSummary
        compressionLine={evidencePanel.compressionLine}
        detailHint={evidencePanel.detailHint}
        onPrimaryAction={openPrimary}
        primaryActionLabel={evidencePanel.primaryActionLabel}
        stats={evidencePanel.stats}
        summary={evidencePanel.summary}
      />
      <SideSection icon={Library} title="研究证据">
        <strong>{evidencePanel.inlineTitle}</strong>
        <p className="muted">这里不会铺开原文、评论和图片；默认只保留可判断价值的摘要，完整内容进抽屉。</p>
        <div className="viralCandidateIntro">
          <strong>{viralSaveCandidates.headline}</strong>
          <p>{viralSaveCandidates.detail}</p>
          {hiddenSaveCandidateCount ? <small>另有 {hiddenSaveCandidateCount} 条合格候选已折叠，可打开完整证据目录逐条判断。</small> : null}
          {viralSaveCandidates.rejectedCount ? <small>已过滤 {viralSaveCandidates.rejectedCount} 条证据较薄的样本。</small> : null}
          {rejectedSamples.length ? (
            <details className="viralRejectedDetails">
              <summary>查看被过滤原因</summary>
              {rejectedSamples.map((candidate) => (
                <p key={candidate.sample.id}>
                  <strong>{candidate.sample.title}</strong>
                  {` · 候选分 ${candidate.score} · ${(candidate.warnings.length ? candidate.warnings : candidate.reasons).slice(0, 2).join(" / ")}`}
                </p>
              ))}
            </details>
          ) : null}
        </div>
        {saveableSamples.length ? (
          <>
            <div className="sideActionStack compact">
              <button className="secondaryButton fullWidth" type="button" onClick={() => onSaveManyToViralLibrary(saveableSamples)}>
                {viralSaveCandidates.actionLabel}
              </button>
            </div>
            <div className="miniEvidenceList">
              {visibleSaveCandidates.map((candidate) => {
                const sample = candidate.sample;

                return (
                  <article key={sample.id}>
                    <strong>{sample.title}</strong>
                    <span>赞 {sample.likes} · 藏 {sample.collects} · 评 {sample.comments}</span>
                    <p>{summarizeEvidenceSample(sample)}</p>
                    <small>候选分 {candidate.score} · {candidate.reasons.slice(0, 2).join(" / ")}</small>
                    {candidate.warnings.length ? <em>{candidate.warnings.slice(0, 2).join(" / ")}</em> : null}
                    <div className="evidenceActions">
                      <button className="textButton" type="button" onClick={() => onOpenSample(sample)}>
                        查看详情
                      </button>
                      <button className="textButton" type="button" onClick={() => onSaveToViralLibrary(sample)}>
                        保存到爆款库
                      </button>
                    </div>
                  </article>
                );
              })}
              {hiddenSaveCandidateCount ? (
                <details className="compressedEvidenceDetails">
                  <summary>还有 {hiddenSaveCandidateCount} 条候选已收起</summary>
                  <p>默认只展示最值得判断的 3 条，避免研究证据把创作区挤满；完整样本可以打开证据目录查看。</p>
                  <button className="textButton" type="button" onClick={onOpenEvidenceCatalog}>
                    打开完整证据目录
                  </button>
                </details>
              ) : null}
            </div>
          </>
        ) : null}
        <button className="secondaryButton fullWidth" onClick={openPrimary} type="button">
          {evidencePanel.primaryActionLabel}
        </button>
      </SideSection>
    </>
  );
}

export function ViralEvidenceDigest({
  summary,
  compact = false,
  onOpenViral
}: {
  summary: ViralEvidenceSummaryModel;
  compact?: boolean;
  onOpenViral?: () => void;
}) {
  return (
    <div className={summary.hasEvidence ? "viralEvidenceDigest ready" : "viralEvidenceDigest"}>
      <div className="viralEvidenceDigestHeader">
        <div>
          <strong>{summary.headline}</strong>
          <p>{summary.detail}</p>
        </div>
        <span>{summary.sourceLine}</span>
      </div>
      {summary.keyInsights.length ? (
        <div className="viralEvidenceDigestList">
          {summary.keyInsights.slice(0, compact ? 3 : 5).map((insight) => (
            <article key={insight.id}>
              <span>
                {labelForInsight(insight.type)}
                {insight.isFocused ? " · 重点" : ""}
                {insight.isCited ? " · 已引用" : ""}
              </span>
              <p>{insight.insight}</p>
            </article>
          ))}
        </div>
      ) : null}
      <div className="viralCoverageStrip" aria-label="爆款库创作覆盖">
        {summary.coverage.map((item) => (
          <span className={item.status} key={item.id} title={item.evidenceIds.join(" / ") || item.line}>
            <b>{item.label}</b>
            {item.line}
          </span>
        ))}
      </div>
      {summary.sourceCases.length && !compact ? (
        <div className="viralEvidenceSources">
          {summary.sourceCases.slice(0, 5).map((item) => (
            <span key={item.id} title={buildViralSourceTitle(item)}>
              {item.hookType || item.title} · {item.category} · 分 {Math.round(item.score)}
              {item.doNotCopy.length ? ` · 边界：${item.doNotCopy[0]}` : ""}
              {buildViralSourceMatchLine(item) ? ` · 命中：${buildViralSourceMatchLine(item)}` : ""}
            </span>
          ))}
        </div>
      ) : null}
      <small>{summary.traceLine}</small>
      {summary.missingLine ? <small>{summary.missingLine}</small> : null}
      {onOpenViral ? (
        <button className="textButton" type="button" onClick={onOpenViral}>查看爆款库证据</button>
      ) : null}
    </div>
  );
}

function SideSection({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="studioSideSection">
      <h3><Icon size={16} />{title}</h3>
      {children}
    </section>
  );
}

function CitationSummaryBox({ citationReport }: { citationReport: EvidenceCitationReport | null }) {
  if (!citationReport?.allEvidenceIds.length) return null;

  return (
    <div className="citationSummaryBox">
      <strong>当前草稿证据引用</strong>
      <p>{citationReport.summary}</p>
      <div className="citationFieldGrid">
        {citationReport.sections.slice(0, 4).map((section) => (
          <article key={section.field}>
            <span>{labelForCitationField(section.field)} · {section.insights.length} 条</span>
            <p>{section.insights.slice(0, 2).map((insight) => `${labelForSource(insight.sourceType)}：${insight.insight}`).join(" / ") || "暂无可追溯证据"}</p>
          </article>
        ))}
      </div>
      {citationReport.warnings.length ? (
        <small>{citationReport.warnings.slice(0, 2).join("；")}</small>
      ) : null}
    </div>
  );
}

function EvidenceSourceBreakdown({
  realtimeCount,
  viralCount,
  userInputCount
}: {
  realtimeCount: number;
  viralCount: number;
  userInputCount: number;
}) {
  const total = realtimeCount + viralCount + userInputCount;

  return (
    <div className="evidenceSourceBreakdown" aria-label="当前证据来源构成">
      <strong>证据来源构成</strong>
      <div>
        <span className={realtimeCount ? "ready" : ""}>实时搜索 {realtimeCount}</span>
        <span className={viralCount ? "ready" : ""}>爆款库 {viralCount}</span>
        <span className={userInputCount ? "ready" : ""}>用户输入 {userInputCount}</span>
      </div>
      <small>{total ? "生成内容会优先引用这些结构化结论，不直接复制原文。" : "完成研究后会显示证据来源。"}</small>
    </div>
  );
}

function CreatorMemorySummary({
  memory,
  projectMemory
}: {
  memory: CreatorMemoryProfile | null;
  projectMemory: string[];
}) {
  const digest = buildCreatorMemoryDigest(memory, projectMemory);
  if (!digest.active) {
    return (
      <details className="creatorMemorySummary">
        <summary>创作记忆 · 等待沉淀</summary>
        <p>{digest.detail}</p>
      </details>
    );
  }

  return (
    <details className="creatorMemorySummary">
      <summary>创作记忆 · {digest.signalCount} 条线索</summary>
      <p>{digest.detail}</p>
      <div className="memorySignalGrid">
        <MemorySignalGroup title="会采用" items={digest.willUse} />
        <MemorySignalGroup title="会避免" items={digest.willAvoid} />
        <MemorySignalGroup title="产品线索" items={digest.productHints} />
        <MemorySignalGroup title="标签线索" items={digest.tagHints} />
      </div>
    </details>
  );
}

function MemorySignalGroup({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section>
      <strong>{title}</strong>
      <div>
        {items.slice(0, 4).map((item) => <span key={item}>{item}</span>)}
      </div>
    </section>
  );
}

function BriefLine({ label, value }: { label: string; value?: string }) {
  return (
    <article className="insightLine">
      <span>{label}</span>
      <p>{value || "待补充"}</p>
    </article>
  );
}

function EvidenceReferenceBox({
  title,
  summary
}: {
  title: string;
  summary: EvidenceReferenceSummary;
}) {
  return (
    <article className="citationSummaryBox">
      <strong>{title}</strong>
      <p>{summary.summary}</p>
      <div className="citationFieldGrid">
        {summary.insights.slice(0, 4).map((insight) => (
          <article key={insight.id}>
            <span>{labelForSource(insight.sourceType)} · {labelForInsight(insight.type)}</span>
            <p>{insight.insight}</p>
            <small>{insight.id}</small>
          </article>
        ))}
      </div>
      {summary.missingEvidenceIds.length ? (
        <small>缺失证据 ID：{summary.missingEvidenceIds.slice(0, 3).join("、")}</small>
      ) : null}
    </article>
  );
}

function EvidencePanelSummary({
  summary,
  detailHint,
  compressionLine,
  stats,
  primaryActionLabel,
  onPrimaryAction
}: {
  summary: string;
  detailHint: string;
  compressionLine: string;
  stats: Array<{ label: string; value: string }>;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
}) {
  return (
    <article className="evidencePanelSummary">
      <div>
        <strong>{summary}</strong>
        <p>{detailHint}</p>
        <small>{compressionLine}</small>
      </div>
      <div className="evidencePanelStats" aria-label="证据摘要统计">
        {stats.map((item) => (
          <span key={item.label}>
            <small>{item.label}</small>
            {item.value}
          </span>
        ))}
      </div>
      <button className="secondaryButton fullWidth" type="button" onClick={onPrimaryAction}>
        {primaryActionLabel}
      </button>
    </article>
  );
}

function StudioTaskSummary({
  summary,
  onQuickAction
}: {
  summary: StudioTabSummary;
  onQuickAction: (action: string) => void;
}) {
  return (
    <article className={`studioTaskSummary ${summary.state}`}>
      <div>
        <span>当前状态</span>
        <strong>{summary.headline}</strong>
        <p>{summary.detail}</p>
      </div>
      {summary.primaryAction ? (
        <button className="secondaryButton fullWidth" type="button" onClick={() => onQuickAction(summary.primaryAction!)}>
          {summary.primaryActionLabel}
        </button>
      ) : (
        <small>{summary.primaryActionLabel}</small>
      )}
    </article>
  );
}

function ChipList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="chipList">
      <strong>{title}</strong>
      <div>
        {items.map((item) => <span key={item}>{item}</span>)}
      </div>
    </div>
  );
}

type ViralSourceCase = ViralEvidenceSummaryModel["sourceCases"][number];

function buildViralSourceMatchLine(item: ViralSourceCase): string {
  return [
    item.matchedQueries?.length ? `query ${item.matchedQueries.slice(0, 2).join(" / ")}` : "",
    item.reasons?.length ? `原因 ${item.reasons.slice(0, 2).join(" / ")}` : "",
    item.scoreBreakdownLine ? `评分 ${item.scoreBreakdownLine}` : ""
  ].filter(Boolean).join("；");
}

function buildViralSourceTitle(item: ViralSourceCase): string {
  return [
    item.safetySummary,
    item.reusablePatterns.length ? `可学：${item.reusablePatterns.join(" / ")}` : "",
    item.doNotCopy.length ? `不要复制：${item.doNotCopy.join(" / ")}` : "",
    buildViralSourceMatchLine(item) ? `本次 RAG：${buildViralSourceMatchLine(item)}` : ""
  ].filter(Boolean).join("\n");
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

function labelForInsight(type: string): string {
  const labels: Record<string, string> = {
    title: "标题",
    copy: "正文",
    tag: "标签",
    visual: "图片",
    comment: "评论",
    audience: "人群",
    pain_point: "痛点",
    structure: "结构",
    hook: "钩子"
  };
  return labels[type] ?? type;
}

function labelForSource(sourceType?: string): string {
  const labels: Record<string, string> = {
    realtime: "实时",
    viral_library: "爆款库",
    user_input: "用户输入"
  };
  return sourceType ? labels[sourceType] ?? sourceType : "实时";
}
