"use client";

import { Library, Sparkles } from "lucide-react";
import { ViralEvidenceDigest } from "@/app/components/post-studio-evidence-tabs";
import { RecentViralPanel, type RecentViralSummary, ViralStrategyCard } from "@/app/components/post-studio-viral-panels";
import type { ViralApplicationModel, ViralApplicationRouteStatus } from "@/app/components/viral-application";
import type { ViralEvidenceSummaryModel } from "@/app/components/viral-evidence-summary";
import type { ViralLibraryHealthModel } from "@/app/components/viral-library-health";
import type { ViralLibrarySearchFilters } from "@/app/components/viral-search";
import type { PostProject, ViralCase, WorkflowResult } from "@/app/types";

type ProjectInsight = PostProject["evidencePack"]["insights"][number];

export type ViralSearchFormState = {
  query: string;
  category: string;
  tags: string;
  audience: string;
  painPoint: string;
  createdAfter: string;
  createdBefore: string;
  minLikes: string;
  minCollects: string;
  minComments: string;
  minShares: string;
  minScore: string;
  sortBy: NonNullable<ViralLibrarySearchFilters["sortBy"]>;
  sortOrder: NonNullable<ViralLibrarySearchFilters["sortOrder"]>;
};

export const emptyViralSearchForm: ViralSearchFormState = {
  query: "",
  category: "",
  tags: "",
  audience: "",
  painPoint: "",
  createdAfter: "",
  createdBefore: "",
  minLikes: "",
  minCollects: "",
  minComments: "",
  minShares: "",
  minScore: "",
  sortBy: "score",
  sortOrder: "desc"
};

export function PostStudioViralTab({
  viralCases,
  viralLibraryHealth,
  viralEvidenceSummary,
  viralSearchForm,
  viralPack,
  viralApplication,
  latestViralSummaries,
  viralInsights,
  keyViralInsights,
  focusedEvidenceIds,
  viralCaseById,
  onSearchFormChange,
  onSearchViralLibrary,
  onResetSearch,
  onQuickAction,
  onFocusEvidenceIds,
  onOpenViralCase,
  onRefreshViralEvidence,
  onReloadViralLibrary
}: {
  viralCases: ViralCase[];
  viralLibraryHealth: ViralLibraryHealthModel;
  viralEvidenceSummary: ViralEvidenceSummaryModel;
  viralSearchForm: ViralSearchFormState;
  viralPack: WorkflowResult["viralKnowledge"] | null | undefined;
  viralApplication: ViralApplicationModel;
  latestViralSummaries: RecentViralSummary[];
  viralInsights: ProjectInsight[];
  keyViralInsights: ProjectInsight[];
  focusedEvidenceIds: string[];
  viralCaseById: Map<string, ViralCase>;
  onSearchFormChange: (patch: Partial<ViralSearchFormState>) => void;
  onSearchViralLibrary: (filters: ViralLibrarySearchFilters) => void;
  onResetSearch: () => void;
  onQuickAction: (action: string) => void;
  onFocusEvidenceIds: (ids: string[]) => void;
  onOpenViralCase: (viralCase: ViralCase) => void;
  onRefreshViralEvidence: () => void;
  onReloadViralLibrary: () => void;
}) {
  const focusedEvidenceIdSet = new Set(focusedEvidenceIds);

  return (
    <section className="studioSideSection">
      <h3><Library size={16} />爆款库证据</h3>
      <strong>{viralCases.length} 条历史爆款规律</strong>
      <p className="muted">默认只看当前项目能用的重点规律和应用建议；检索、过滤、健康报告和历史样本放在下方工具区。</p>
      <ViralEvidenceDigest summary={viralEvidenceSummary} />
      <RagSufficiencyCard viralPack={viralPack} />
      <ViralApplicationPanel
        viralApplication={viralApplication}
        onQuickAction={onQuickAction}
      />
      <ViralInsightList
        focusedEvidenceIdSet={focusedEvidenceIdSet}
        focusedEvidenceIds={focusedEvidenceIds}
        keyViralInsights={keyViralInsights}
        onFocusEvidenceIds={onFocusEvidenceIds}
        onOpenViralCase={onOpenViralCase}
        viralCaseById={viralCaseById}
        viralCases={viralCases}
        viralInsights={viralInsights}
      />
      <div className="sideActionStack">
        <button className="primaryButton fullWidth" onClick={onRefreshViralEvidence} type="button">
          <Sparkles size={16} />
          刷新当前项目 RAG 证据
        </button>
      </div>
      <details className="viralUtilityDrawer">
        <summary>
          <strong>爆款库工具与检索</strong>
          <span>搜索、过滤、健康报告、最近入库样本</span>
        </summary>
        <ViralLibraryHealthCard viralLibraryHealth={viralLibraryHealth} />
        <ViralSearchDrawer
          caseCount={viralCases.length}
          form={viralSearchForm}
          onChange={onSearchFormChange}
          onResetSearch={onResetSearch}
          onSearchViralLibrary={onSearchViralLibrary}
        />
        <ViralStrategyCard viralPack={viralPack ?? null} />
        <RecentViralPanel summaries={latestViralSummaries} onOpenCase={onOpenViralCase} />
        <button className="secondaryButton fullWidth" onClick={onReloadViralLibrary} type="button">
          只刷新本地爆款库列表
        </button>
      </details>
    </section>
  );
}

function ViralLibraryHealthCard({ viralLibraryHealth }: { viralLibraryHealth: ViralLibraryHealthModel }) {
  return (
    <div className={viralLibraryHealth.status === "ready" ? "viralLibraryHealth ready" : "viralLibraryHealth"}>
      <div>
        <strong>{viralLibraryHealth.headline}</strong>
        <p>{viralLibraryHealth.detail}</p>
      </div>
      <div className="viralLibraryHealthStats">
        {viralLibraryHealth.stats.map((item) => (
          <span className={item.tone} key={item.label}>
            {item.label} <b>{item.value}</b>
          </span>
        ))}
      </div>
      {viralLibraryHealth.warnings.length ? (
        <small>风险：{viralLibraryHealth.warnings.slice(0, 2).join(" / ")}</small>
      ) : null}
      {viralLibraryHealth.recommendations.length ? (
        <small>建议：{viralLibraryHealth.recommendations.slice(0, 2).join(" / ")}</small>
      ) : null}
    </div>
  );
}

function ViralSearchDrawer({
  caseCount,
  form,
  onChange,
  onSearchViralLibrary,
  onResetSearch
}: {
  caseCount: number;
  form: ViralSearchFormState;
  onChange: (patch: Partial<ViralSearchFormState>) => void;
  onSearchViralLibrary: (filters: ViralLibrarySearchFilters) => void;
  onResetSearch: () => void;
}) {
  return (
    <details className="viralSearchDrawer">
      <summary>
        <div>
          <strong>检索 / 过滤爆款库</strong>
          <span>默认收起，避免把创作证据挤到页面下方。</span>
        </div>
        <em>{caseCount} 条可检索</em>
      </summary>
      <form
        className="viralSearchPanel"
        onSubmit={(event) => {
          event.preventDefault();
          onSearchViralLibrary(form);
        }}
      >
        <label>
          <span>知识库检索</span>
          <input value={form.query} onChange={(event) => onChange({ query: event.target.value })} placeholder="例如：广州咖啡馆、通勤包、产品种草" />
        </label>
        <div className="viralSearchGrid">
          <TextFilter label="类目" placeholder="探店 / 干货 / 种草" value={form.category} onChange={(category) => onChange({ category })} />
          <TextFilter label="目标人群" placeholder="例如：上班族" value={form.audience} onChange={(audience) => onChange({ audience })} />
          <TextFilter label="痛点" placeholder="例如：不知道怎么选" value={form.painPoint} onChange={(painPoint) => onChange({ painPoint })} />
          <TextFilter label="标签" placeholder="逗号分隔" value={form.tags} onChange={(tags) => onChange({ tags })} />
        </div>
        <details className="viralAdvancedSearch">
          <summary>高级过滤</summary>
          <div className="viralSearchGrid">
            <DateFilter label="入库开始日期" value={form.createdAfter} onChange={(createdAfter) => onChange({ createdAfter })} />
            <DateFilter label="入库结束日期" value={form.createdBefore} onChange={(createdBefore) => onChange({ createdBefore })} />
            <NumberFilter label="最低点赞" value={form.minLikes} onChange={(minLikes) => onChange({ minLikes })} />
            <NumberFilter label="最低收藏" value={form.minCollects} onChange={(minCollects) => onChange({ minCollects })} />
            <NumberFilter label="最低评论" value={form.minComments} onChange={(minComments) => onChange({ minComments })} />
            <NumberFilter label="最低分享" value={form.minShares} onChange={(minShares) => onChange({ minShares })} />
            <NumberFilter label="最低评分" decimal value={form.minScore} onChange={(minScore) => onChange({ minScore })} />
            <label>
              <span>排序</span>
              <select value={form.sortBy} onChange={(event) => onChange({ sortBy: event.target.value as ViralSearchFormState["sortBy"] })}>
                <option value="score">综合分</option>
                <option value="collects">收藏</option>
                <option value="likes">点赞</option>
                <option value="comments">评论</option>
                <option value="shares">分享</option>
                <option value="createdAt">入库时间</option>
              </select>
            </label>
            <label>
              <span>排序方向</span>
              <select value={form.sortOrder} onChange={(event) => onChange({ sortOrder: event.target.value as ViralSearchFormState["sortOrder"] })}>
                <option value="desc">高到低 / 最新</option>
                <option value="asc">低到高 / 最早</option>
              </select>
            </label>
          </div>
        </details>
        <div className="viralSearchActions">
          <button className="primaryButton" type="submit">检索爆款规律</button>
          <button className="secondaryButton" type="button" onClick={onResetSearch}>重置</button>
        </div>
      </form>
    </details>
  );
}

function TextFilter({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberFilter({ label, value, decimal = false, onChange }: { label: string; value: string; decimal?: boolean; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <input inputMode={decimal ? "decimal" : "numeric"} value={value} onChange={(event) => onChange(event.target.value)} placeholder="可选" />
    </label>
  );
}

function RagSufficiencyCard({ viralPack }: { viralPack: WorkflowResult["viralKnowledge"] | null | undefined }) {
  if (!viralPack?.sufficiency) return null;
  return (
    <div className={viralPack.sufficiency.isEnough ? "ragStatus good" : "ragStatus warn"}>
      <strong>{viralPack.sufficiency.isEnough ? "RAG 证据充足" : "RAG 证据还不够"}</strong>
      <p>{viralPack.sufficiency.recommendation}</p>
      {viralPack.filterSummary ? (
        <small className="ragFilterLine">本次筛选：{viralPack.filterSummary}</small>
      ) : null}
      {viralPack.rewrittenQueries?.length ? (
        <small>检索扩展：{viralPack.rewrittenQueries.slice(0, 3).join(" / ")}</small>
      ) : null}
    </div>
  );
}

function ViralApplicationPanel({
  viralApplication,
  onQuickAction
}: {
  viralApplication: ViralApplicationModel;
  onQuickAction: (action: string) => void;
}) {
  return (
    <div className={viralApplication.evidenceCount ? "viralApplyPanel ready" : "viralApplyPanel"}>
      <div>
        <strong>{viralApplication.headline}</strong>
        <p>{viralApplication.detail}</p>
        {viralApplication.evidenceCount ? <small>当前已接入 {viralApplication.evidenceCount} 条爆款库 evidencePack 结论。</small> : null}
        {viralApplication.focusedCount ? <small>本次重点：{viralApplication.focusedCount} 条，生成时会优先引用。</small> : null}
        {viralApplication.citedEvidenceIds.length ? (
          <small>已被当前创作引用：{viralApplication.citedEvidenceIds.slice(0, 4).join(" / ")}</small>
        ) : null}
        <div className={`ragReadinessLine ${viralApplication.ragStatus}`}>
          <strong>{viralApplication.ragLine}</strong>
          {viralApplication.missingEvidence.length ? <span>缺口：{viralApplication.missingEvidence.slice(0, 3).join(" / ")}</span> : null}
          <span>{viralApplication.recommendation}</span>
        </div>
      </div>
      <div className="viralApplicationRoutes" aria-label="爆款库应用路径">
        {viralApplication.routes.map((route) => (
          <article className={`viralApplicationRoute ${route.status}`} key={route.id}>
            <span>{route.label}</span>
            <strong>{labelForViralRouteStatus(route.status)}</strong>
            <p>{route.detail}</p>
            {route.evidenceIds.length ? <small>证据：{route.evidenceIds.slice(0, 3).join(" / ")}</small> : null}
          </article>
        ))}
      </div>
      <div className="inlineActionGrid">
        {viralApplication.actions.map((item) => (
          <button className={item.primary ? "primaryButton fullWidth" : "secondaryButton fullWidth"} key={item.id} onClick={() => onQuickAction(item.action)} type="button">
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ViralInsightList({
  viralInsights,
  keyViralInsights,
  viralCases,
  viralCaseById,
  focusedEvidenceIds,
  focusedEvidenceIdSet,
  onFocusEvidenceIds,
  onOpenViralCase
}: {
  viralInsights: ProjectInsight[];
  keyViralInsights: ProjectInsight[];
  viralCases: ViralCase[];
  viralCaseById: Map<string, ViralCase>;
  focusedEvidenceIds: string[];
  focusedEvidenceIdSet: Set<string>;
  onFocusEvidenceIds: (ids: string[]) => void;
  onOpenViralCase: (viralCase: ViralCase) => void;
}) {
  if (viralInsights.length) {
    return (
      <div className="miniEvidenceList">
        {keyViralInsights.map((insight) => {
          const source = findViralCaseForInsight(insight, viralCaseById);
          return (
            <article className="keyViralInsight" key={insight.id}>
              <span>{labelForInsight(insight.type)} · 爆款库 · 置信 {Math.round(insight.confidence * 100)}%</span>
              <p>{insight.insight}</p>
              <small>{focusedEvidenceIdSet.has(insight.id) ? "本次重点 · " : ""}{insight.id}</small>
              <div className="evidenceActions">
                <button
                  className={focusedEvidenceIdSet.has(insight.id) ? "textButton activeTextButton" : "textButton"}
                  type="button"
                  onClick={() => onFocusEvidenceIds(toggleFocusedEvidenceId(focusedEvidenceIds, insight.id))}
                >
                  {focusedEvidenceIdSet.has(insight.id) ? "取消重点" : "设为本次重点"}
                </button>
                {source ? (
                  <button className="textButton" type="button" onClick={() => onOpenViralCase(source)}>
                    查看来源规律
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
        {viralInsights.length > keyViralInsights.length ? (
          <p className="muted">已默认压缩展示 {keyViralInsights.length} 条关键规律，完整 {viralInsights.length} 条已写入 evidencePack，生成文案和图片方向时可追溯引用。</p>
        ) : null}
      </div>
    );
  }

  if (viralCases.length) {
    return (
      <div className="miniEvidenceList">
        {viralCases.slice(0, 5).map((item) => (
          <article key={item.id}>
            <strong>{item.hookType}</strong>
            <span className="viralAngleLine">{item.hookType} · {item.category} · {item.imageStyle}</span>
            <p>{item.extractedInsights.reusableRules[0] || item.contentStructure.join(" / ")}</p>
            <span>赞 {item.metrics.likes} · 藏 {item.metrics.collects}{item.quality ? ` · 规律质量 ${Math.round(item.quality.score * 100)}%` : ""}</span>
            <div className="evidenceActions">
              <button className="textButton" type="button" onClick={() => onOpenViralCase(item)}>
                查看规律
              </button>
            </div>
          </article>
        ))}
      </div>
    );
  }

  return <p className="muted">还没有爆款库样本。可以先在“研究证据”里把高质量样本保存进库。</p>;
}

function toggleFocusedEvidenceId(currentIds: string[], id: string): string[] {
  return currentIds.includes(id)
    ? currentIds.filter((item) => item !== id)
    : [...currentIds, id].slice(-8);
}

function findViralCaseForInsight(insight: ProjectInsight, viralCaseById: Map<string, ViralCase>): ViralCase | undefined {
  for (const id of insight.sourceSampleIds) {
    const viralCase = viralCaseById.get(id);
    if (viralCase) return viralCase;
  }
  return undefined;
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

function labelForViralRouteStatus(status: ViralApplicationRouteStatus): string {
  if (status === "ready") return "已应用";
  if (status === "pending") return "待应用";
  return "未开始";
}
