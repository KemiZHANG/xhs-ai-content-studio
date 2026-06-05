"use client";

import type { FormEvent } from "react";
import { Send, ShieldCheck } from "lucide-react";
import type { PostNextStepCoach } from "@/app/components/post-next-step-coach";
import type { PostFlowPhase } from "@/app/components/post-flow-summary";
import type { PostProjectContextSummary } from "@/app/components/post-project-context";
import type { PostStudioStatusSummary } from "@/app/components/post-studio-status";
import type { Section } from "@/app/types";

export function PostStudioHeaderPanel({
  projectTitle,
  projectContextSummary,
  statusSummary,
  flowSummary,
  nextStepCoach,
  chatInput,
  busy,
  activeAccountId,
  ragCreativeBlocked = false,
  onQuickAction,
  onSwitchAccount,
  onRefreshHealth,
  onNavigate,
  onChatInput,
  onChatSubmit,
  onNewProject
}: {
  projectTitle: string;
  projectContextSummary: PostProjectContextSummary;
  statusSummary: PostStudioStatusSummary;
  flowSummary: PostFlowPhase[];
  nextStepCoach: PostNextStepCoach;
  chatInput: string;
  busy: boolean;
  activeAccountId: string;
  ragCreativeBlocked?: boolean;
  onQuickAction: (action: string) => void;
  onSwitchAccount: (accountId: string) => void;
  onRefreshHealth: () => void;
  onNavigate: (section: Section) => void;
  onChatInput: (value: string) => void;
  onChatSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onNewProject: () => void;
}) {
  return (
    <>
      <div>
        <span className="flowKicker">Post Studio</span>
        <h2>{projectTitle}</h2>
        <p>围绕一篇帖子推进：先研究真实笔记，再生成文案、图片方向、发布预览和安全检查。</p>
        <ProjectContextCard summary={projectContextSummary} />
        <StudioStatusCard
          activeAccountId={activeAccountId}
          statusSummary={statusSummary}
          ragCreativeBlocked={ragCreativeBlocked}
          onNavigate={onNavigate}
          onQuickAction={onQuickAction}
          onRefreshHealth={onRefreshHealth}
          onSwitchAccount={onSwitchAccount}
        />
      </div>
      <div className="postFlowRail" aria-label="帖子创作流程">
        {flowSummary.map((phase, index) => (
          <PostFlowPhaseItem
            index={index}
            key={phase.id}
            phase={phase}
            ragCreativeBlocked={ragCreativeBlocked}
            onQuickAction={onQuickAction}
          />
        ))}
      </div>
      <PostFlowFocusStrip flowSummary={flowSummary} ragCreativeBlocked={ragCreativeBlocked} onQuickAction={onQuickAction} />
      <NextActionBar
        busy={busy}
        chatInput={chatInput}
        nextStepCoach={nextStepCoach}
        ragCreativeBlocked={ragCreativeBlocked}
        onChatInput={onChatInput}
        onChatSubmit={onChatSubmit}
        onNewProject={onNewProject}
        onQuickAction={onQuickAction}
        projectContextSummary={projectContextSummary}
      />
    </>
  );
}

function PostFlowFocusStrip({
  flowSummary,
  ragCreativeBlocked,
  onQuickAction
}: {
  flowSummary: PostFlowPhase[];
  ragCreativeBlocked: boolean;
  onQuickAction: (action: string) => void;
}) {
  const doneCount = flowSummary.filter((phase) => phase.state === "done").length;
  const activePhase = flowSummary.find((phase) => phase.state === "active") ?? flowSummary.find((phase) => phase.state !== "done");
  const remainingCount = Math.max(0, flowSummary.length - doneCount);

  return (
    <div className="postFlowFocusStrip">
      <div>
        <span>主线进度</span>
        <strong>{doneCount}/{flowSummary.length} 已完成</strong>
        <p>{activePhase ? `当前只处理：${activePhase.label}。${activePhase.detail}` : "全部阶段已完成，进入最终人工确认。"}</p>
      </div>
      <div className="postFlowFocusTrail" aria-label="主线阶段摘要">
        {flowSummary.map((phase) => (
          <em className={phase.state} key={phase.id}>{phase.label}</em>
        ))}
      </div>
      {activePhase?.action ? (
        <button type="button" onClick={() => onQuickAction(routeHeaderAction(activePhase.action!, ragCreativeBlocked).action)}>
          {routeHeaderAction(activePhase.action!, ragCreativeBlocked).label ?? activePhase.actionLabel}
        </button>
      ) : (
        <small>还剩 {remainingCount} 个阶段</small>
      )}
    </div>
  );
}

function ProjectContextCard({ summary }: { summary: PostProjectContextSummary }) {
  return (
    <div className={`projectContextCard ${summary.state}`}>
      <div>
        <span>当前帖子项目</span>
        <strong>{summary.title}</strong>
        <p>{summary.projectLine}</p>
        <small>{summary.boundaryLine}</small>
        <div className="projectContextBoundaryChecklist" aria-label="项目边界清单">
          {summary.boundaryChecklist.map((item) => (
            <em key={item}>{item}</em>
          ))}
        </div>
      </div>
      <div className="projectContextLines">
        <span>{summary.accountLine}</span>
        <span>{summary.scopeLine}</span>
        <span>{summary.publishLine}</span>
      </div>
      <div className="projectContextChips">
        {summary.chips.map((item) => (
          <em className={item.state} key={item.label}>
            <small>{item.label}</small>
            {item.value}
          </em>
        ))}
      </div>
    </div>
  );
}

function StudioStatusCard({
  statusSummary,
  activeAccountId,
  ragCreativeBlocked,
  onQuickAction,
  onSwitchAccount,
  onRefreshHealth,
  onNavigate
}: {
  statusSummary: PostStudioStatusSummary;
  activeAccountId: string;
  ragCreativeBlocked: boolean;
  onQuickAction: (action: string) => void;
  onSwitchAccount: (accountId: string) => void;
  onRefreshHealth: () => void;
  onNavigate: (section: Section) => void;
}) {
  return (
    <div className={`studioStatusSummary ${statusSummary.riskLevel}`}>
      <div>
        <span>当前判断</span>
        <strong>{statusSummary.headline}</strong>
        <p>{statusSummary.detail}</p>
      </div>
      <div className="studioStatusProgress" aria-label="帖子项目完成度">
        <div>
          <span>{statusSummary.stageLine}</span>
          {statusSummary.primaryAction ? (
            <button type="button" onClick={() => onQuickAction(routeHeaderAction(statusSummary.primaryAction!, ragCreativeBlocked).action)}>
              建议：{routeHeaderAction(statusSummary.primaryAction!, ragCreativeBlocked).label ?? statusSummary.primaryActionLabel}
            </button>
          ) : statusSummary.primaryActionLabel ? (
            <b>建议：{statusSummary.primaryActionLabel}</b>
          ) : null}
        </div>
        <i><em style={{ width: `${statusSummary.progressPercent}%` }} /></i>
      </div>
      <div className="studioStatusChips">
        {statusSummary.chips.map((item) => (
          <em className={item.state} key={item.label}>
            <small>{item.label}</small>
            {item.value}
          </em>
        ))}
      </div>
      <div className="studioAccountLine">
        <ShieldCheck size={15} />
        <span>{statusSummary.accountLine}</span>
      </div>
      <div className={`studioAccountControl ${statusSummary.accountReady ? "ready" : "warn"}`}>
        <div>
          <small>发布账号</small>
          <strong>{statusSummary.accountName}</strong>
          <span>{statusSummary.accountLoginName ? `登录名：${statusSummary.accountLoginName}` : "登录名待检测"}</span>
          <span>MCP：{statusSummary.accountMcpEndpoint}</span>
        </div>
        {statusSummary.accountCount > 1 ? (
          <label>
            <span>切换</span>
            <select value={activeAccountId} onChange={(event) => onSwitchAccount(event.target.value)}>
              {statusSummary.accountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="studioAccountButtons">
          <button className="secondaryButton" type="button" onClick={onRefreshHealth}>
            检测当前账号
          </button>
          <button className="secondaryButton" type="button" onClick={() => onNavigate("settings")}>
            账号设置
          </button>
        </div>
        <div className="studioAccountOptionList" aria-label="账号切换状态">
          {statusSummary.accountOptions.slice(0, 3).map((account) => (
            <article className={account.isReady ? "ready" : account.isActive ? "active" : ""} key={account.id}>
              <strong>{account.label}</strong>
              <span>{account.detail}</span>
              {account.isActive ? <em>当前使用</em> : <em>可切换</em>}
            </article>
          ))}
        </div>
        <small className="studioAccountSwitchHint">{statusSummary.accountSwitchHint}</small>
      </div>
      {statusSummary.blockers.length ? (
        <ul className="studioStatusBlockers">
          {statusSummary.blockers.map((item) => {
            const action = actionForBlocker(item, ragCreativeBlocked);
            return (
              <li key={item}>
                <span>{item}</span>
                {action ? (
                  <button type="button" onClick={() => onQuickAction(action.action)}>
                    {action.label}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function PostFlowPhaseItem({
  phase,
  index,
  ragCreativeBlocked,
  onQuickAction
}: {
  phase: PostFlowPhase;
  index: number;
  ragCreativeBlocked: boolean;
  onQuickAction: (action: string) => void;
}) {
  const routedAction = phase.action ? routeHeaderAction(phase.action, ragCreativeBlocked) : null;

  return (
    <article className={`postFlowPhase ${phase.state}`}>
      <span className="postFlowIndex">{index + 1}</span>
      <div>
        <strong>{phase.label}</strong>
        <p>{phase.detail}</p>
      </div>
      {phase.state === "active" && phase.action ? (
        <button type="button" onClick={() => routedAction && onQuickAction(routedAction.action)}>
          {routedAction?.label ?? phase.actionLabel}
        </button>
      ) : null}
    </article>
  );
}

function NextActionBar({
  nextStepCoach,
  chatInput,
  busy,
  projectContextSummary,
  ragCreativeBlocked,
  onQuickAction,
  onChatInput,
  onChatSubmit,
  onNewProject
}: {
  nextStepCoach: PostNextStepCoach;
  chatInput: string;
  busy: boolean;
  projectContextSummary: PostProjectContextSummary;
  ragCreativeBlocked: boolean;
  onQuickAction: (action: string) => void;
  onChatInput: (value: string) => void;
  onChatSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onNewProject: () => void;
}) {
  return (
    <div className="nextActionBar">
      <span className="nextActionEyebrow">下一步建议</span>
      <strong>{nextStepCoach.headline}</strong>
      <p>{nextStepCoach.detail}</p>
      {nextStepCoach.progressLine ? <small>{nextStepCoach.progressLine}</small> : null}
      <div className="nextActionReasonGrid" aria-label="下一步决策摘要">
        <span>
          <small>为什么</small>
          {nextStepCoach.whyLine}
        </span>
        <span>
          <small>完成后</small>
          {nextStepCoach.outcomeLine}
        </span>
        {nextStepCoach.safetyLine ? (
          <span className="safety">
            <small>安全</small>
            {nextStepCoach.safetyLine}
          </span>
        ) : null}
      </div>
      <div className="nextActionButtons">
        {nextStepCoach.primaryAction ? (
          <button className="isPrimaryNext" type="button" onClick={() => onQuickAction(routeHeaderAction(nextStepCoach.primaryAction!, ragCreativeBlocked).action)}>
            现在只做：{routeHeaderAction(nextStepCoach.primaryAction!, ragCreativeBlocked).label ?? nextStepCoach.primaryLabel}
          </button>
        ) : null}
        {nextStepCoach.secondaryActions.length ? (
          <details className="secondaryNextActions">
            <summary>其他可选动作</summary>
            <div>
              {nextStepCoach.secondaryActions.map((item) => (
                <button key={item.action} type="button" onClick={() => onQuickAction(routeHeaderAction(item.action, ragCreativeBlocked).action)}>
                  {routeHeaderAction(item.action, ragCreativeBlocked).label ?? item.label}
                </button>
              ))}
            </div>
          </details>
        ) : null}
      </div>
      <form className="studioTopComposer" onSubmit={onChatSubmit}>
        <textarea
          aria-label="给 Agent 的下一步指令"
          value={chatInput}
          onChange={(event) => onChatInput(event.target.value)}
          placeholder="直接告诉 Agent 下一步：补充产品卖点 / 标题更生活化 / 用第二张图 / 今晚八点发"
        />
        <button className="primaryButton" disabled={busy} type="submit">
          <Send size={15} />
          发送
        </button>
      </form>
      <div className={`topComposerContext ${projectContextSummary.state}`}>
        <span>这句话会作用于：{projectContextSummary.title}</span>
        <span>{projectContextSummary.scopeLine}</span>
        <span>{projectContextSummary.publishLine}</span>
      </div>
      <details className="nextActionDecision">
        <summary>查看完整决策说明</summary>
        <span>为什么：{nextStepCoach.whyLine}</span>
        <span>完成后：{nextStepCoach.outcomeLine}</span>
        {nextStepCoach.safetyLine ? <span className="nextActionSafety">{nextStepCoach.safetyLine}</span> : null}
      </details>
      <button className="secondaryButton" onClick={onNewProject} type="button">新建项目</button>
    </div>
  );
}

function actionForBlocker(blocker: string, ragCreativeBlocked: boolean): { action: string; label: string } | null {
  if (blocker.includes("账号") || blocker.includes("登录")) {
    return null;
  }
  if (blocker.includes("Quality") || blocker.includes("检查") || blocker.includes("风险")) {
    return { action: "run_quality_gate", label: "刷新检查" };
  }
  if (blocker.includes("图片") || blocker.includes("选图")) {
    return { action: "select_images", label: "选择图片" };
  }
  if (blocker.includes("视觉") || blocker.includes("方向")) {
    const routedAction = routeHeaderAction("plan_visuals", ragCreativeBlocked, "规划图片");
    return { action: routedAction.action, label: routedAction.label ?? "规划图片" };
  }
  if (blocker.includes("文案") || blocker.includes("标题") || blocker.includes("正文")) {
    const routedAction = routeHeaderAction("generate_copy", ragCreativeBlocked, "补文案");
    return { action: routedAction.action, label: routedAction.label ?? "补文案" };
  }
  if (blocker.includes("证据") || blocker.includes("研究")) {
    return { action: "search_research", label: "做研究" };
  }
  if (blocker.includes("保存")) {
    return { action: "assemble_post", label: "保存装配" };
  }
  return null;
}

function routeHeaderAction(action: string, ragCreativeBlocked: boolean, fallbackLabel?: string): { action: string; label?: string } {
  if (ragCreativeBlocked && ["generate_copy", "plan_visuals", "generate_images"].includes(action)) {
    return { action: "retrieve_viral_knowledge", label: "补强爆款证据" };
  }
  return { action, label: fallbackLabel };
}
