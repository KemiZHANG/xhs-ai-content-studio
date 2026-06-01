"use client";

import { useState } from "react";
import type { ResearchSummary, SampleEvidence, WorkflowResult } from "@/app/types";
import { displayEvidenceImages, displaySample, sampleToEvidence } from "@/app/components/xhs-display-utils";

export function WorkflowResultView({
  result,
  onDraftCommand,
  onCopyStudio,
  onImageStudio,
  onOpenPublish
}: {
  result: WorkflowResult;
  onDraftCommand?: (message: string) => void;
  onCopyStudio?: (brief?: string) => void;
  onImageStudio?: (brief?: string) => void;
  onOpenPublish?: (draft?: NonNullable<WorkflowResult["draft"]>) => void;
}) {
  const [draftInstruction, setDraftInstruction] = useState("帮我把当前草稿改得更有真实探店感，并补充具体信息");
  const [scheduleAt, setScheduleAt] = useState("");
  const [creativeBrief, setCreativeBrief] = useState(
    "我想基于这些证据写一篇原创小红书笔记。具体对象是：；我想强调：；目标人群是：。"
  );
  const evidence = result.evidence?.length ? result.evidence : result.samples.map(sampleToEvidence);

  return (
    <div className="workflowResult">
      <div className="resultStatus">
        <strong>{result.status}</strong>
        <span>{evidence.length} 条证据样本</span>
      </div>

      {!result.draft && (onCopyStudio || onImageStudio) && result.status === "research_ready" ? (
        <section className="resultBlock creativeBriefBlock priorityBriefBlock">
          <div>
            <h3>研究完成，直接进入下一步</h3>
            <p>
              已经提炼出标题、正文、标签和图片风格的学习结论。你可以先补充自己的产品、对象、口吻，再进入文案或图片创作。
            </p>
          </div>
          <label>
            <span>你的真实需求</span>
            <textarea value={creativeBrief} onChange={(event) => setCreativeBrief(event.target.value)} />
          </label>
          <div className="creativeGatewayGrid">
            <button
              className="modeCard active"
              type="button"
              onClick={() => onCopyStudio?.(creativeBrief)}
            >
              <strong>进入文案创作窗口</strong>
              <span>只带标题、正文、标签的学习结论，不把原帖全文塞进对话。</span>
            </button>
            <button
              className="modeCard"
              type="button"
              onClick={() => onImageStudio?.(creativeBrief)}
            >
              <strong>进入图片创作台</strong>
              <span>带图片风格结论生成配图，可上传产品图或直接生成卡片。</span>
            </button>
          </div>
        </section>
      ) : null}

      <div className="stepList">
        {result.steps.map((step) => (
          <div className={`stepItem ${step.status}`} key={step.id}>
            <span>{step.label}</span>
            <p>{step.detail}</p>
          </div>
        ))}
      </div>

      {evidence.length ? (
        <section className="resultBlock">
          <div className="blockTitleRow">
            <div>
              <h3>真实笔记证据</h3>
              <p>先看别人真实笔记里写了什么、图怎么拍、互动为什么高；点击卡片可在本页展开完整图文。</p>
            </div>
          </div>
          <div className="evidenceGrid">
            {evidence.map((item, index) => (
              <EvidenceCard item={item} index={index} key={`${item.id}-${index}`} />
            ))}
          </div>
        </section>
      ) : null}

      {result.researchSummary ? (
        <ResearchSummaryView summary={result.researchSummary} />
      ) : null}

      {result.report ? (
        <section className="resultBlock">
          <h3>分析报告</h3>
          <p>{result.report}</p>
        </section>
      ) : null}

      {result.imageStyleReport ? (
        <section className="resultBlock">
          <h3>图片风格分析</h3>
          <p>{result.imageStyleReport}</p>
        </section>
      ) : null}

      {result.samples.length ? (
        <section className="resultBlock">
          <h3>爆款样本表</h3>
          <div className="tableWrap">
            <table className="sampleTable">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>作者</th>
                  <th>点赞</th>
                  <th>收藏</th>
                  <th>评论</th>
                  <th>评分</th>
                  <th>链接</th>
                </tr>
              </thead>
              <tbody>
                {result.samples.map((sample) => {
                  const display = displaySample(sample);
                  return (
                  <tr key={sample.id}>
                    <td>{display.title}</td>
                    <td>{display.author || "-"}</td>
                    <td>{display.likes}</td>
                    <td>{display.collects}</td>
                    <td>{display.comments}</td>
                    <td>{Math.round(display.score)}</td>
                    <td>
                      {display.url ? (
                        <a href={display.url} rel="noreferrer" target="_blank">
                          打开
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {result.draft ? (
        <section className="resultBlock">
          <h3>生成草稿：{result.draft.title}</h3>
          <p>{result.draft.content}</p>
          <div className="tagRow">
            {result.draft.tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
          <pre className="logBox">{result.draft.imagePrompt}</pre>
          {onDraftCommand || onOpenPublish ? (
            <div className="draftActions">
              {onDraftCommand ? (
                <label>
                  <span>继续修改这篇草稿</span>
                  <input value={draftInstruction} onChange={(event) => setDraftInstruction(event.target.value)} />
                </label>
              ) : null}
              <div className="actionRow">
                <button
                  className="secondaryButton"
                  onClick={() => void navigator.clipboard?.writeText(`${result.draft?.title}\n\n${result.draft?.content}`)}
                  type="button"
                >
                  复制草稿
                </button>
                {onDraftCommand ? (
                  <button
                    className="secondaryButton"
                    onClick={() => onDraftCommand(draftInstruction)}
                    type="button"
                  >
                    让 AI 修改
                  </button>
                ) : null}
                {onOpenPublish ? (
                  <button className="primaryButton" onClick={() => onOpenPublish(result.draft ?? undefined)} type="button">
                    回到 Post Studio 发布检查
                  </button>
                ) : null}
              </div>
              {onOpenPublish ? (
              <div className="actionRow">
                <input value={scheduleAt} type="datetime-local" onChange={(event) => setScheduleAt(event.target.value)} />
                <button
                  className="secondaryButton"
                  onClick={() => onOpenPublish(result.draft ?? undefined)}
                  type="button"
                >
                  去设置定时发布
                </button>
              </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {result.images.length ? (
        <section className="resultBlock">
          <h3>生成图片</h3>
          <div className="assetList">
            {result.images.map((image, index) => (
              <span key={`${image.path ?? image.url}-${index}`}>{image.path ?? image.url}</span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function EvidenceCard({ item, index }: { item: SampleEvidence; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const images = displayEvidenceImages(item);
  const hasLongText = item.detailText.length > 180;
  const shownText = expanded || !hasLongText ? item.detailText : `${item.detailText.slice(0, 180)}...`;

  return (
    <article
      className={expanded ? "evidenceCard expanded" : "evidenceCard"}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a,button")) return;
        setExpanded((value) => !value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setExpanded((value) => !value);
        }
      }}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
    >
      <div className="evidenceHeader">
        <span>样本 {index + 1}</span>
        {item.url ? (
          <a href={item.url} rel="noreferrer" target="_blank">
            备用打开原笔记
          </a>
        ) : null}
      </div>
      <h4>{item.title}</h4>
      <p className="muted">{item.author || "未知作者"}</p>
      <button className="evidenceOpenButton" type="button" onClick={() => setExpanded((value) => !value)}>
        {expanded ? "收起卡片" : "查看完整图文"}
      </button>
      <div className="metricStrip">
        <span>赞 {item.likes}</span>
        <span>藏 {item.collects}</span>
        <span>评 {item.comments}</span>
        <span>转 {item.shares}</span>
      </div>
      {images.length ? (
        <div className="evidenceImages">
          {images.slice(0, expanded ? 8 : 4).map((url) => (
            <img alt={item.title} key={url} src={url} />
          ))}
        </div>
      ) : (
        <p className="muted">没有拿到可展示图片。</p>
      )}
      {item.detailText ? (
        <div className="evidenceBody">
          <strong>正文内容</strong>
          <p className="evidenceText">{shownText}</p>
          {hasLongText ? (
            <button className="inlineTextButton" type="button" onClick={() => setExpanded((value) => !value)}>
              {expanded ? "收起正文" : "展开完整正文"}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="muted">详情正文暂未获取到，本条只使用搜索卡片信息。</p>
      )}
      {item.commentSnippets.length ? (
        <div className="quoteList">
          {item.commentSnippets.slice(0, expanded ? 6 : 3).map((comment) => (
            <span key={comment}>评论：{comment}</span>
          ))}
        </div>
      ) : null}
      <div className="reasonList">
        {item.reasonHighlights.map((reason) => (
          <span key={reason}>{reason}</span>
        ))}
      </div>
    </article>
  );
}

export function ResearchSummaryView({ summary }: { summary: ResearchSummary }) {
  return (
    <section className="resultBlock researchSummaryGrid">
      <InsightList title="内容哪里好" items={summary.contentStrengths} />
      <InsightList title="图片哪里好" items={summary.imageStrengths} />
      <InsightList title="正文怎么学" items={summary.learningsForContent} />
      <InsightList title="图片怎么学" items={summary.learningsForImages} />
      <InsightList title="生成前要补充" items={summary.nextQuestions} wide />
    </section>
  );
}

export function InsightList({ title, items, wide = false }: { title: string; items: string[]; wide?: boolean }) {
  return (
    <div className={wide ? "insightCard wide" : "insightCard"}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
