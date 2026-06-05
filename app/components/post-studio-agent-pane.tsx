"use client";

import type { FormEvent } from "react";
import { useRef } from "react";
import { MessageSquareText, Search, Send } from "lucide-react";
import { isHighPriorityAgentCard, pickVisibleAgentCards } from "@/app/components/agent-card-visibility";
import { buildAgentMessageDisplay } from "@/app/components/agent-message-display";
import { extractAgentCreationProvenanceDisplay } from "@/app/components/agent-creation-provenance-display";
import { extractAgentDirectorSummaryDisplay } from "@/app/components/agent-director-summary-display";
import { extractStageGuidanceDisplay } from "@/app/components/agent-stage-guidance";
import { buildAgentTraceSummary } from "@/app/components/agent-trace-summary";
import { selectStudioChatWindow } from "@/app/components/studio-chat-window";
import { labelForPostAction } from "@/app/components/post-action-labels";
import type { AgentResponseCard, ChatMessage, JobRecord, PostProject } from "@/app/types";

export type PostStudioResearchFormState = {
  topic: string;
  contentType: string;
  timeRange: string;
  sampleCount: number;
  analyzeImages: boolean;
  requirements: string;
};

const starterPrompts = [
  "帮我找最近一周高收藏笔记，分析标题、正文、标签和图片风格。",
  "基于当前证据生成 CreativeBrief，然后给我一版原创小红书文案。",
  "根据当前文案规划图片方向，生成适合小红书的图片 Prompt。"
];

export function PostStudioAgentPane({
  evidenceCount,
  researchForm,
  messages,
  runningJob,
  chatInput,
  busy,
  onRunResearch,
  onResearchFormChange,
  onChatInput,
  onChatSubmit,
  onQuickAction
}: {
  evidenceCount: number;
  researchForm: PostStudioResearchFormState;
  messages: ChatMessage[];
  runningJob: JobRecord | null | undefined;
  chatInput: string;
  busy: boolean;
  onRunResearch: (event: FormEvent<HTMLFormElement>) => void;
  onResearchFormChange: (form: PostStudioResearchFormState) => void;
  onChatInput: (value: string) => void;
  onChatSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onQuickAction: (action: string) => void;
}) {
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const focusComposer = () => {
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    composerRef.current?.focus();
  };

  return (
    <section className="panel studioAgentPane">
      <div className="panelHeader compact">
        <div>
          <h2>AI Agent</h2>
          <p>像内容导演一样工作：先判断阶段和信息是否足够，再搜索、总结、生成或追问。</p>
        </div>
        <button className="secondaryButton compactButton" type="button" onClick={focusComposer}>
          继续输入
        </button>
      </div>

      <div className="agentStartRail" aria-label="Post Studio 快速开始">
        <button type="button" onClick={focusComposer}>
          <span>自然语言</span>
          <strong>直接描述你要发什么</strong>
        </button>
        <button type="button" onClick={() => onQuickAction("search_research")}>
          <span>第一步</span>
          <strong>搜索真实笔记</strong>
        </button>
        <button type="button" onClick={() => onQuickAction(evidenceCount ? "generate_copy" : "search_research")}>
          <span>{evidenceCount ? "下一步" : "先补证据"}</span>
          <strong>{evidenceCount ? "生成原创文案" : "先做研究"}</strong>
        </button>
      </div>

      <div className="agentSafetyHint" aria-label="Agent 发布安全提示">
        <strong>安全规则</strong>
        <span>模糊指令会先追问；“发布 / 定时发布”只会生成确认单，不会直接调用小红书发布。</span>
      </div>

      <details className="studioResearchDetails" open={!evidenceCount}>
        <summary>
          <span>真实笔记研究</span>
          <strong>{evidenceCount ? `${evidenceCount} 条证据已绑定` : "先搜索证据"}</strong>
        </summary>
        <form className="studioResearchBox" onSubmit={onRunResearch}>
          <label>
            <span>主题</span>
            <input
              placeholder="例如：广州咖啡馆 / 通勤包 / 产品种草"
              value={researchForm.topic}
              onChange={(event) => onResearchFormChange({ ...researchForm, topic: event.target.value })}
            />
          </label>
          <div className="formRow">
            <label>
              <span>时间</span>
              <select value={researchForm.timeRange} onChange={(event) => onResearchFormChange({ ...researchForm, timeRange: event.target.value })}>
                <option>一天内</option>
                <option>一周内</option>
                <option>两周内</option>
                <option>半年内</option>
              </select>
            </label>
            <label>
              <span>样本</span>
              <input min={3} max={20} type="number" value={researchForm.sampleCount} onChange={(event) => onResearchFormChange({ ...researchForm, sampleCount: Number(event.target.value) })} />
            </label>
          </div>
          <label>
            <span>创作要求</span>
            <textarea
              placeholder="目标人群、语气、卖点、禁忌词、产品信息等。"
              value={researchForm.requirements}
              onChange={(event) => onResearchFormChange({ ...researchForm, requirements: event.target.value })}
            />
          </label>
          <button className="primaryButton fullWidth" disabled={busy} type="submit">
            <Search size={16} />
            搜索并提炼证据
          </button>
        </form>
      </details>

      {runningJob ? <AgentRunningJobPanel runningJob={runningJob} /> : null}

      <div className="studioChatList">
        {selectStudioChatWindow(messages).map((message, index) => (
          <StudioChatBubble
            index={index}
            key={message.id ?? `${message.role}-${index}`}
            message={message}
            onQuickAction={onQuickAction}
          />
        ))}
        {!messages.length ? (
          <div className="studioEmpty">
            <MessageSquareText size={22} />
            <strong>告诉 Agent 你要做什么</strong>
            <p>例如：找最近一周高收藏笔记，分析标题和图片风格，再生成一篇适合探店账号的图文笔记。</p>
            <div className="agentStarterPrompts" aria-label="Post Studio 起步指令">
              {starterPrompts.map((prompt) => (
                <button key={prompt} type="button" onClick={() => onChatInput(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <form className="studioComposer" onSubmit={onChatSubmit}>
        <span className="studioComposerHint">输入框固定在底部，可随时继续改文案、选图或发布</span>
        <textarea ref={composerRef} value={chatInput} onChange={(event) => onChatInput(event.target.value)} placeholder="继续追问：再生活化一点 / 用第二张图 / 今晚八点发..." />
        <button className="primaryButton" disabled={busy} type="submit">
          <Send size={16} />
          发送
        </button>
      </form>
    </section>
  );
}

function AgentRunningJobPanel({ runningJob }: { runningJob: JobRecord }) {
  return (
    <div className="studioToolTrace">
      <div className="studioToolTraceHeader">
        <strong>{runningJob.title}</strong>
        <span>{runningJob.status} · {runningJob.progress}%</span>
      </div>
      <div className="miniProgress"><i style={{ width: `${runningJob.progress}%` }} /></div>
      {runningJob.steps.length ? (
        <ul className="studioToolStepList" aria-label="后台工具步骤">
          {runningJob.steps.slice(-3).map((step) => (
            <li className={step.status} key={step.id}>
              <span>{labelForTraceStatus(step.status === "done" ? "completed" : step.status)}</span>
              <p>{step.label}</p>
              {step.detail ? <small>{step.detail}</small> : null}
            </li>
          ))}
        </ul>
      ) : (
        <span>任务已创建，等待工具步骤回传。</span>
      )}
    </div>
  );
}

function StudioChatBubble({
  message,
  index,
  onQuickAction
}: {
  message: ChatMessage;
  index: number;
  onQuickAction: (action: string) => void;
}) {
  const display = buildAgentMessageDisplay(message.content, {
    maxChars: message.role === "assistant" ? 420 : 260,
    maxLines: message.role === "assistant" ? 7 : 4
  });

  return (
    <article className={message.role === "user" ? "studioChatBubble user" : "studioChatBubble"} data-message-index={index}>
      <div className="chatBubbleHeader">
        <strong>{message.role === "user" ? "你" : "AI Agent"}</strong>
        {message.role === "assistant" ? (
          <AgentIntentBadge
            confidence={message.intentConfidence}
            intent={message.intent}
            needsUserInput={message.needsUserInput}
            stage={message.stage}
          />
        ) : null}
      </div>
      {display.visibleText ? <p>{display.visibleText}</p> : null}
      {display.truncated ? (
        <details className="agentLongMessage">
          <summary>{message.role === "assistant" ? "展开完整回复" : "展开完整输入"}</summary>
          <p>{display.fullText}</p>
        </details>
      ) : null}
      {message.role === "assistant" ? (
        <AgentStructuredMessage message={message} onQuickAction={onQuickAction} />
      ) : null}
    </article>
  );
}

function AgentStructuredMessage({
  message,
  onQuickAction
}: {
  message: ChatMessage;
  onQuickAction: (action: string) => void;
}) {
  const allCards = message.cards ?? [];
  const cards = pickVisibleAgentCards(allCards);
  const hiddenCards = allCards.filter((card) => !cards.some((visible) => visible.id === card.id));
  const traceSummary = buildAgentTraceSummary(message.toolTrace ?? []);
  const trace = traceSummary.visibleTrace;
  const actions = (message.quickActions ?? []).slice(0, 3);
  if (!cards.length && !trace.length && !actions.length && !message.questions?.length) {
    return null;
  }

  return (
    <div className="agentMessageMeta">
      {message.questions?.length ? (
        <div className="agentQuestionBox priority">
          <strong>Agent 还需要你补充</strong>
          {message.questions.slice(0, 3).map((question) => <p key={question}>{question}</p>)}
        </div>
      ) : null}

      {cards.length ? (
        <div className="agentCardStrip">
          {cards.map((card) => (
            <article className={`agentMiniCard ${card.type} ${isHighPriorityAgentCard(card.type) ? "highPriority" : ""}`} key={card.id}>
              <span>{labelForAgentCard(card.type)}</span>
              <strong>{card.title}</strong>
              <p>{card.summary}</p>
              <AgentCardInlineDetails card={card} onQuickAction={onQuickAction} />
              {extractEvidenceIdsFromAgentCard(card).length ? (
                <small>证据: {extractEvidenceIdsFromAgentCard(card).slice(0, 3).join(" / ")}</small>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {hiddenCards.length ? (
        <details className="agentHiddenCards">
          <summary>还有 {hiddenCards.length} 张结果卡已折叠</summary>
          {hiddenCards.slice(0, 6).map((card) => (
            <p key={card.id}>{labelForAgentCard(card.type)}: {card.title}</p>
          ))}
        </details>
      ) : null}

      {trace.length ? (
        <details className="agentTraceMini">
          <summary>工具轨迹 · {traceSummary.summaryLabel}</summary>
          {trace.map((item) => (
            <div key={item.id}>
              <span className={`traceStatus ${item.status}`}>{labelForTraceStatus(item.status)}</span>
              <p>{item.label}: {item.detail}</p>
            </div>
          ))}
          {traceSummary.recoveryHint ? <p className="traceRecoveryHint">{traceSummary.recoveryHint}</p> : null}
        </details>
      ) : null}

      {actions.length ? (
        <div className="agentQuickActionRow">
          {actions.map((action) => (
            <button
              className="miniActionButton"
              disabled={action.disabled}
              key={action.id}
              onClick={() => onQuickAction(action.action)}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AgentCardInlineDetails({
  card,
  onQuickAction
}: {
  card: AgentResponseCard;
  onQuickAction: (action: string) => void;
}) {
  const clarify = extractClarifyNextStepsDisplay(card);
  const directorSummary = extractAgentDirectorSummaryDisplay(card);
  const stageGuidance = extractStageGuidanceDisplay(card);
  const provenance = extractAgentCreationProvenanceDisplay(card);
  const viralKnowledge = extractViralKnowledgeDisplay(card);
  if (clarify) {
    return (
      <div className="agentClarifyMini">
        <div>
          <span>需要补充</span>
          {clarify.questions.slice(0, 3).map((question) => (
            <p key={question}>{question}</p>
          ))}
        </div>
        {clarify.replyTemplate ? (
          <blockquote>{clarify.replyTemplate}</blockquote>
        ) : null}
        {clarify.quickActions.length ? (
          <div className="agentClarifyActions">
            {clarify.quickActions.slice(0, 3).map((action) => (
              <button className="miniActionButton" key={action.action} type="button" onClick={() => onQuickAction(action.action)}>
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
        {clarify.safetyNote ? <small>{clarify.safetyNote}</small> : null}
      </div>
    );
  }
  if (directorSummary) {
    return (
      <div className="agentDirectorMini">
        <div className="agentDirectorReason">
          <span>{directorSummary.needsUserInput ? "需要补充" : "阶段判断"}</span>
          <strong>{directorSummary.stageTitle}</strong>
          <p>{directorSummary.stageDescription}</p>
        </div>
        <div className="agentDirectorWhy">
          <span>为什么这样做</span>
          <p>{directorSummary.why}</p>
        </div>
        <div className="agentDirectorStats">
          <span>进度 <b>{directorSummary.progress ?? 0}%</b></span>
          <span>证据 <b>{directorSummary.evidenceCount}</b></span>
          <span>草稿 <b>{directorSummary.hasDraft ? "已建立" : "待生成"}</b></span>
          <span>记忆 <b>{directorSummary.memorySignalCount}</b></span>
        </div>
        {directorSummary.memoryHints.length ? (
          <div className="agentDirectorMemory">
            <span>本项目记忆</span>
            {directorSummary.memoryHints.map((item) => <p key={item}>{item}</p>)}
          </div>
        ) : null}
        {directorSummary.blockerCount ? <small className="agentDirectorBlocker">还有 {directorSummary.blockerCount} 个阻塞项需要处理</small> : null}
        {directorSummary.nextAction ? (
          <button className="miniActionButton primaryInline" type="button" onClick={() => onQuickAction(directorSummary.nextAction!)}>
            建议下一步 {directorSummary.nextActionLabel}
          </button>
        ) : null}
      </div>
    );
  }
  if (provenance) {
    return (
      <div className="agentProvenanceMini">
        <div className="agentProvenanceHeader">
          <span>{provenance.headline}</span>
          <p>{provenance.detail}</p>
        </div>
        <div className="agentProvenanceItems">
          {provenance.items.map((item) => (
            <div className={item.status} key={item.id}>
              <span>{item.status === "ready" ? "已追溯" : item.status === "warn" ? "需复核" : "待建立"}</span>
              <strong>{item.label}</strong>
              <p>{item.summary}</p>
              <small>
                {item.sourceLine} · 证据 {item.evidenceCount}
                {item.missingCount ? ` · 待补 ${item.missingCount}` : ""}
              </small>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (viralKnowledge) {
    return (
      <div className="agentViralKnowledgeMini">
        {viralKnowledge.sources.length ? (
          <div>
            <span>命中来源</span>
            {viralKnowledge.sources.map((source) => (
              <p key={source.caseId}>
                <strong>{source.caseId}</strong>
                {source.score ? ` · ${source.score}` : ""}
                {source.matchedQueries.length ? ` · ${source.matchedQueries.slice(0, 2).join(" / ")}` : ""}
                {source.reasons.length ? ` · ${source.reasons.slice(0, 2).join(" / ")}` : ""}
                {source.scoreBreakdown ? ` · 评分拆解 ${source.scoreBreakdown}` : ""}
                {source.evidenceInsightIds.length ? ` · 证据 ${source.evidenceInsightIds.slice(0, 3).join(" / ")}` : ""}
                {source.sourceUrl ? (
                  <>
                    {" · "}
                    <a href={source.sourceUrl} target="_blank" rel="noreferrer">查看来源</a>
                  </>
                ) : null}
              </p>
            ))}
          </div>
        ) : null}
        {viralKnowledge.originalityRules.length ? (
          <div>
            <span>原创边界</span>
            {viralKnowledge.originalityRules.slice(0, 2).map((rule) => <p key={rule}>{rule}</p>)}
          </div>
        ) : null}
        {viralKnowledge.nextActions.length ? (
          <div className="agentViralActions" aria-label="爆款库下一步">
            <span>建议下一步</span>
            {viralKnowledge.nextActions.slice(0, 3).map((action) => (
              <button
                className="miniActionButton"
                disabled={action.disabled}
                key={action.action}
                onClick={() => onQuickAction(action.action)}
                type="button"
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }
  if (!stageGuidance) return null;
  return (
    <div className="agentStageMiniFlow">
      <div className="agentStageProgress">
        <span>进度</span>
        <strong>{stageGuidance.progress ?? 0}%</strong>
      </div>
      <div className="agentStageChecklist">
        {stageGuidance.items.map((item) => (
          <div className={item.ready ? "ready" : "todo"} key={`${item.label}-${item.action ?? item.detail}`}>
            <span>{item.ready ? "已完成" : "下一步"}</span>
            <strong>{item.label}</strong>
            <p>{item.detail}</p>
            {!item.ready && item.action ? (
              <button type="button" onClick={() => onQuickAction(item.action!)}>
                {labelForPostAction(item.action)}
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {stageGuidance.primaryAction ? (
        <button className="miniActionButton primaryInline" type="button" onClick={() => onQuickAction(stageGuidance.primaryAction!)}>
          建议下一步 {labelForPostAction(stageGuidance.primaryAction)}
        </button>
      ) : null}
    </div>
  );
}

function extractViralKnowledgeDisplay(card: AgentResponseCard): {
  sources: Array<{
    caseId: string;
    score: string;
    matchedQueries: string[];
    reasons: string[];
    evidenceInsightIds: string[];
    scoreBreakdown: string;
    sourceUrl: string;
  }>;
  originalityRules: string[];
  nextActions: Array<{ label: string; action: string; disabled?: boolean }>;
} | null {
  if (card.type !== "viral_knowledge" || !isRecordValue(card.data)) {
    return null;
  }
  const resultRecords = Array.isArray(card.data.results) ? card.data.results.filter(isRecordValue) : [];
  const resultBreakdownsByCaseId = new Map<string, string>();
  for (const result of resultRecords) {
    if (!isRecordValue(result.case) || typeof result.case.id !== "string") continue;
    const breakdown = formatViralScoreBreakdown(result.scoreBreakdown);
    if (breakdown) resultBreakdownsByCaseId.set(result.case.id, breakdown);
  }
  const traceSources = Array.isArray(card.data.evidenceTrace)
    ? card.data.evidenceTrace.flatMap((item) => {
        if (!isRecordValue(item)) return [];
        const caseId = typeof item.caseId === "string" ? item.caseId : "";
        if (!caseId) return [];
        return [{
          caseId,
          score: typeof item.score === "number" ? item.score.toFixed(2) : "",
          matchedQueries: stringListFromRecordValue(item.matchedQueries),
          reasons: stringListFromRecordValue(item.reasons),
          evidenceInsightIds: stringListFromRecordValue(item.evidenceInsightIds),
          scoreBreakdown: resultBreakdownsByCaseId.get(caseId) ?? "",
          sourceUrl: typeof item.sourceUrl === "string" ? item.sourceUrl : ""
        }];
      })
    : [];
  const resultSources = resultRecords
    .flatMap((item) => {
        if (!isRecordValue(item) || !isRecordValue(item.case) || typeof item.case.id !== "string") return [];
        return [{
          caseId: item.case.id,
          score: typeof item.score === "number" ? item.score.toFixed(2) : "",
          matchedQueries: stringListFromRecordValue(item.matchedQueries),
          reasons: stringListFromRecordValue(item.reasons),
          evidenceInsightIds: [],
          scoreBreakdown: formatViralScoreBreakdown(item.scoreBreakdown),
          sourceUrl: typeof item.case.sourceUrl === "string" ? item.case.sourceUrl : ""
        }];
      });
  const sources = uniqueViralSources([...traceSources, ...resultSources]).slice(0, 2);
  const strategyReport = isRecordValue(card.data.strategyReport) ? card.data.strategyReport : null;
  const originalityRules = strategyReport ? stringListFromRecordValue(strategyReport.originalityRules).slice(0, 3) : [];
  const nextActions = Array.isArray(card.data.nextActions)
    ? card.data.nextActions.flatMap((item) => {
        if (!isRecordValue(item) || typeof item.label !== "string" || typeof item.action !== "string") {
          return [];
        }
        return [{ label: item.label, action: item.action, disabled: item.disabled === true }];
      })
    : [];
  return sources.length || originalityRules.length || nextActions.length ? { sources, originalityRules, nextActions } : null;
}

function uniqueViralSources(sources: Array<{
  caseId: string;
  score: string;
  matchedQueries: string[];
  reasons: string[];
  evidenceInsightIds: string[];
  scoreBreakdown: string;
  sourceUrl: string;
}>): Array<{
  caseId: string;
  score: string;
  matchedQueries: string[];
  reasons: string[];
  evidenceInsightIds: string[];
  scoreBreakdown: string;
  sourceUrl: string;
}> {
  const result: Array<{
    caseId: string;
    score: string;
    matchedQueries: string[];
    reasons: string[];
    evidenceInsightIds: string[];
    scoreBreakdown: string;
    sourceUrl: string;
  }> = [];
  for (const source of sources) {
    const existingIndex = result.findIndex((item) => item.caseId === source.caseId);
    if (existingIndex >= 0) {
      const existing = result[existingIndex];
      result[existingIndex] = {
        caseId: existing.caseId,
        score: existing.score || source.score,
        matchedQueries: existing.matchedQueries.length ? existing.matchedQueries : source.matchedQueries,
        reasons: existing.reasons.length ? existing.reasons : source.reasons,
        evidenceInsightIds: existing.evidenceInsightIds.length ? existing.evidenceInsightIds : source.evidenceInsightIds,
        scoreBreakdown: existing.scoreBreakdown || source.scoreBreakdown,
        sourceUrl: existing.sourceUrl || source.sourceUrl
      };
      continue;
    }
    result.push(source);
  }
  return result;
}

function formatViralScoreBreakdown(value: unknown): string {
  if (!isRecordValue(value)) return "";
  return [
    ["语义", value.semantic],
    ["关键词", value.keyword],
    ["互动", value.metrics],
    ["质量", value.quality],
    ["筛选", value.filters]
  ]
    .filter(([, score]) => typeof score === "number" && Number.isFinite(score) && score > 0)
    .map(([label, score]) => `${label} ${Number(score).toFixed(2)}`)
    .join(" / ");
}

function extractClarifyNextStepsDisplay(card: AgentResponseCard): {
  questions: string[];
  replyTemplate: string;
  safetyNote: string;
  quickActions: Array<{ label: string; action: string }>;
} | null {
  if (card.type !== "clarify_next_steps" || !isRecordValue(card.data)) {
    return null;
  }
  const quickActions = Array.isArray(card.data.quickActions)
    ? card.data.quickActions.flatMap((item) => {
        if (!isRecordValue(item) || typeof item.label !== "string" || typeof item.action !== "string") {
          return [];
        }
        return [{ label: item.label, action: item.action }];
      })
    : [];
  return {
    questions: stringListFromRecordValue(card.data.questions),
    replyTemplate: typeof card.data.replyTemplate === "string" ? card.data.replyTemplate : "",
    safetyNote: typeof card.data.safetyNote === "string" ? card.data.safetyNote : "",
    quickActions
  };
}

function AgentIntentBadge({
  intent,
  confidence,
  needsUserInput,
  stage
}: {
  intent?: string;
  confidence?: number;
  needsUserInput?: boolean;
  stage?: PostProject["currentStage"];
}) {
  if (!intent && confidence === undefined && !needsUserInput && !stage) return null;
  const confidenceLabel = confidence === undefined ? "" : `${Math.round(confidence * 100)}%`;
  return (
    <span className={needsUserInput ? "agentIntentBadge ask" : "agentIntentBadge"}>
      {needsUserInput ? "需补充" : labelForAgentIntent(intent)}
      {confidenceLabel ? ` · ${confidenceLabel}` : ""}
      {stage ? ` · ${labelForStage(stage)}` : ""}
    </span>
  );
}

function extractEvidenceIdsFromAgentCard(card: AgentResponseCard): string[] {
  if (!isRecordValue(card.data)) return [];
  const directIds = stringListFromRecordValue(card.data.basedOnEvidenceIds);
  const reportIds = stringListFromRecordValue(card.data.allEvidenceIds);
  const viralIds = stringListFromRecordValue(card.data.evidenceIds);
  return uniqueText([...directIds, ...reportIds, ...viralIds]).slice(0, 6);
}

function stringListFromRecordValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function uniqueText(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const clean = value.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result;
}

function labelForStage(stage: PostProject["currentStage"]): string {
  const labels: Record<PostProject["currentStage"], string> = {
    empty: "空项目",
    briefing: "补充需求",
    researching: "研究中",
    evidence_ready: "证据就绪",
    brief_ready: "Brief 就绪",
    copy_drafting: "文案生成中",
    copy_ready: "文案就绪",
    visual_planning: "规划图片",
    image_prompt_ready: "Prompt 就绪",
    image_generating: "图片生成中",
    image_ready: "图片就绪",
    assembling: "组装帖子",
    reviewing: "发布检查",
    scheduled: "已定时",
    published: "已发布",
    failed: "失败"
  };
  return labels[stage];
}

function labelForAgentIntent(intent?: string): string {
  if (!intent) return "Agent";
  const labels: Record<string, string> = {
    start_project: "开始项目",
    research_to_draft: "研究到文案",
    research_only: "仅研究",
    create_creative_brief: "生成简报",
    retrieve_viral_knowledge: "爆款库 RAG",
    save_viral_knowledge: "保存爆款规律",
    revise_draft: "修改文案",
    confirm_visual_direction: "确认图片方向",
    generate_images: "生成图片",
    generate_cards: "生成卡片",
    select_images: "选择图片",
    assemble_post: "组装帖子",
    quality_check: "发布检查",
    recover_project: "恢复项目",
    prepare_publish: "准备发布",
    schedule_publish: "定时发布",
    review_publish_confirmation: "确认发布",
    cancel_publish_confirmation: "取消发布",
    ask: "追问信息",
    answer: "直接回答"
  };
  return labels[intent] ?? intent;
}

function labelForAgentCard(type: string): string {
  const labels: Record<string, string> = {
    director_summary: "导演摘要",
    clarify_next_steps: "补充信息",
    agent_plan: "Agent 计划",
    stage_guidance: "下一步",
    evidence_summary: "证据摘要",
    viral_knowledge: "爆款库",
    evidence_citations: "证据引用",
    creation_provenance: "创作依据",
    creative_brief: "CreativeBrief",
    copy_draft: "文案草稿",
    visual_direction: "图片方向",
    image_prompt: "图片 Prompt",
    publish_check: "发布检查",
    quality_check: "质量检查"
  };
  return labels[type] ?? type;
}

function labelForTraceStatus(status: string): string {
  const labels: Record<string, string> = {
    planned: "已计划",
    running: "执行中",
    completed: "完成",
    failed: "失败"
  };
  return labels[status] ?? status;
}
