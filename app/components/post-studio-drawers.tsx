"use client";

import { ExternalLink } from "lucide-react";
import type { SampleEvidence, ViralCase } from "@/app/types";
import { scoreEvidence, summarizeEvidenceSample } from "@/app/components/evidence-display";

export function EvidenceDrawer({
  sample,
  onClose,
  onSave
}: {
  sample: SampleEvidence;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="studioDrawerBackdrop" role="presentation" onClick={onClose}>
      <aside className="studioDrawer" role="dialog" aria-modal="true" aria-label="证据详情" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>Evidence Detail</span>
            <h3>{sample.title}</h3>
            <p>{sample.author || "未知作者"} · 赞 {sample.likes} · 藏 {sample.collects} · 评 {sample.comments}</p>
          </div>
          <button type="button" onClick={onClose}>关闭</button>
        </header>

        <section className="drawerSection">
          <h4>正文摘要</h4>
          <p>{sample.detailText || "当前 MCP 详情没有返回正文；可以保留互动数据和图片风格作为证据。"}</p>
        </section>

        {sample.reasonHighlights.length ? (
          <section className="drawerSection">
            <h4>为什么值得参考</h4>
            <ul>
              {sample.reasonHighlights.slice(0, 6).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ) : null}

        {sample.commentSnippets.length ? (
          <section className="drawerSection">
            <h4>评论关注点</h4>
            <ul>
              {sample.commentSnippets.slice(0, 8).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ) : null}

        {(sample.cachedImageUrls?.length ?? 0) || (sample.imageUrls?.length ?? 0) ? (
          <section className="drawerSection">
            <h4>图片参考</h4>
            <div className="drawerImageGrid">
              {[...(sample.cachedImageUrls ?? []), ...(sample.imageUrls ?? [])].slice(0, 6).map((url) => (
                <img alt={sample.title} key={url} src={url} />
              ))}
            </div>
          </section>
        ) : null}

        <footer>
          {sample.url ? (
            <a className="secondaryButton" href={sample.url} target="_blank" rel="noreferrer">
              <ExternalLink size={14} />
              来源链接
            </a>
          ) : null}
          <button className="primaryButton" type="button" onClick={onSave}>保存到爆款库</button>
        </footer>
      </aside>
    </div>
  );
}

export function EvidenceCatalogDrawer({
  samples,
  onClose,
  onOpenSample,
  onSaveSample
}: {
  samples: SampleEvidence[];
  onClose: () => void;
  onOpenSample: (sample: SampleEvidence) => void;
  onSaveSample: (sample: SampleEvidence) => void;
}) {
  const sortedSamples = [...samples].sort((left, right) => scoreEvidence(right) - scoreEvidence(left));

  return (
    <div className="studioDrawerBackdrop" role="presentation" onClick={onClose}>
      <aside className="studioDrawer" role="dialog" aria-modal="true" aria-label="研究证据目录" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>Evidence Catalog</span>
            <h3>研究证据目录</h3>
            <p>完整样本留在抽屉里，不打断主创作台；打开单条后可查看正文、评论和图片。</p>
          </div>
          <button type="button" onClick={onClose}>关闭</button>
        </header>

        <section className="drawerSection">
          <div className="drawerEvidenceList">
            {sortedSamples.map((sample, index) => (
              <article key={sample.id}>
                <div>
                  <span>#{index + 1} · 赞 {sample.likes} · 藏 {sample.collects} · 评 {sample.comments}</span>
                  <strong>{sample.title}</strong>
                  <p>{summarizeEvidenceSample(sample)}</p>
                </div>
                <div className="evidenceActions">
                  <button className="textButton" type="button" onClick={() => onOpenSample(sample)}>
                    打开详情
                  </button>
                  <button className="textButton" type="button" onClick={() => onSaveSample(sample)}>
                    保存到爆款库
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

export function ViralCaseDrawer({ viralCase, onClose }: { viralCase: ViralCase; onClose: () => void }) {
  const insights = viralCase.extractedInsights;
  return (
    <div className="studioDrawerBackdrop" role="presentation" onClick={onClose}>
      <aside className="studioDrawer" role="dialog" aria-modal="true" aria-label="爆款库规律详情" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>Viral Knowledge Detail</span>
            <h3>{viralCase.hookType || viralCase.title}</h3>
            <p>{viralCase.topic} · {viralCase.category} · 赞 {viralCase.metrics.likes} · 藏 {viralCase.metrics.collects} · 评 {viralCase.metrics.comments}</p>
            <p className="muted">
              Extraction: {viralCase.extraction.method === "model" ? "AI model" : "local heuristic"}
              {" · "}Source: {viralCase.extraction.sourceSampleId || viralCase.sourceSampleId}
              {viralCase.quality ? ` · Quality: ${Math.round(viralCase.quality.score * 100)}%` : ""}
              {viralCase.extraction.fallbackReason ? ` · fallback: ${viralCase.extraction.fallbackReason}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose}>关闭</button>
        </header>

        <section className="drawerSection">
          <h4>可复用规律</h4>
          <ul>
            {insights.reusableRules.slice(0, 8).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="drawerSection">
          <h4>结构化创作知识</h4>
          {viralCase.creativeSafety ? (
            <div className="drawerInlineWarning">
              <strong>原创安全摘要</strong>
              <p>{viralCase.creativeSafety.summary}</p>
              {viralCase.quality?.warnings.length ? (
                <p>质量提示：{viralCase.quality.warnings.slice(0, 2).join(" / ")}</p>
              ) : null}
              <KnowledgeList title="可学习" items={viralCase.creativeSafety.reusablePatterns} />
              <KnowledgeList title="必须改写/替换" items={viralCase.creativeSafety.transformationGuidance} />
            </div>
          ) : null}
          <div className="viralKnowledgeGrid">
            <KnowledgeList title="标题钩子" items={insights.titleHooks.length ? insights.titleHooks : [viralCase.hookType]} />
            <KnowledgeList title="正文结构" items={insights.copyStructures.length ? insights.copyStructures : viralCase.contentStructure} />
            <KnowledgeList title="标签组合" items={insights.tagPatterns.length ? insights.tagPatterns : viralCase.tags} />
            <KnowledgeList title="图片风格" items={insights.visualPatterns.length ? insights.visualPatterns : [viralCase.imageStyle]} />
            <KnowledgeList title="目标人群" items={insights.audienceSignals.length ? insights.audienceSignals : [viralCase.audience]} />
            <KnowledgeList title="痛点/情绪" items={[...insights.painPoints, ...insights.emotionalTriggers].length ? [...insights.painPoints, ...insights.emotionalTriggers] : [viralCase.painPoint, viralCase.emotionalTrigger]} />
          </div>
        </section>

        {insights.commentConcerns.length ? (
          <section className="drawerSection">
            <h4>评论关注点</h4>
            <ul>
              {insights.commentConcerns.slice(0, 8).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ) : null}

        {insights.avoidCopying.length ? (
          <section className="drawerSection warningSection">
            <h4>不可复制/仿写</h4>
            <ul>
              {insights.avoidCopying.slice(0, 6).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ) : null}

        {viralCase.bodyExcerpt ? (
          <section className="drawerSection">
            <h4>原文摘要</h4>
            <p>{viralCase.bodyExcerpt}</p>
          </section>
        ) : null}

        <footer>
          {viralCase.sourceUrl ? (
            <a className="secondaryButton" href={viralCase.sourceUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={14} />
              来源链接
            </a>
          ) : null}
          <span className="drawerFootnote">只学习结构、风格和规律，不复制原文或原图。</span>
        </footer>
      </aside>
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
