"use client";

import { ArrowRight, Check, Circle, PlugZap } from "lucide-react";
import type { Health, PostProject } from "@/app/types";
import { getStudioDestination, type StudioPage } from "@/app/components/studio-navigation";

const steps: Array<{ page: StudioPage; label: string; detail: string }> = [
  { page: "research", label: "研究", detail: "确认主题与证据" },
  { page: "compose", label: "文案", detail: "完成标题与正文" },
  { page: "visuals", label: "图片", detail: "准备并选择画面" },
  { page: "publish", label: "发布", detail: "检查后确认发布" }
];

const pageOrder: Record<StudioPage, number> = {
  research: 0,
  compose: 1,
  visuals: 2,
  publish: 3
};

export function StudioWorkspaceHome({
  project,
  health,
  onStart,
  onOpenStage
}: {
  project: PostProject | null;
  health: Health | null;
  onStart: () => void;
  onOpenStage: (page: StudioPage) => void;
}) {
  const stage = project?.currentStage ?? "empty";
  const destination = getStudioDestination(stage);
  const activeIndex = pageOrder[destination.page];
  const hasProject = stage !== "empty";

  return (
    <div className="workspaceHome">
      <section className="workspaceWelcome">
        <span className="workspaceKicker">{hasProject ? destination.eyebrow : "你的创作任务中心"}</span>
        <h1>{hasProject ? destination.title : "今天想写什么？"}</h1>
        <p>
          {hasProject
            ? destination.description
            : "从一个主题开始，依次完成研究、文案、图片和发布。一次只处理一件事。"}
        </p>
        <button className="workspacePrimaryAction" type="button" onClick={onStart}>
          {hasProject ? destination.actionLabel : "新建内容"}
          <ArrowRight size={18} />
        </button>
      </section>

      <section className="workspaceFlow" aria-labelledby="workspace-flow-title">
        <div className="workspaceSectionHeading">
          <div>
            <span>创作流程</span>
            <h2 id="workspace-flow-title">四步完成一篇内容</h2>
          </div>
          <p>完成当前步骤后，下一步会自动出现在工作台。</p>
        </div>

        <ol className="creationSteps">
          {steps.map((step, index) => {
            const complete = hasProject && index < activeIndex;
            const active = index === activeIndex;
            return (
              <li className={active ? "active" : complete ? "complete" : ""} key={step.page}>
                <button type="button" onClick={() => onOpenStage(step.page)}>
                  <span className="creationStepIndex">
                    {complete ? <Check size={16} /> : <Circle size={14} />}
                    0{index + 1}
                  </span>
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                  {active ? <em>当前步骤</em> : null}
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="workspaceOverview">
        <article>
          <span>当前项目</span>
          <strong>{project?.topic || "还没有进行中的项目"}</strong>
          <p>{hasProject ? destination.title : "新建内容后，项目会保存在这里。"}</p>
        </article>
        <article>
          <span>账号连接</span>
          <strong className="workspaceConnection">
            <PlugZap size={17} />
            {health?.loggedIn ? health.activeAccount?.displayName || "账号已连接" : "等待连接"}
          </strong>
          <p>{health?.loggedIn ? "可以进行发布前检查。" : "你仍然可以先完成研究和创作。"}</p>
        </article>
        <article>
          <span>最近活动</span>
          <strong>{hasProject ? "继续当前创作" : "从干净的工作区开始"}</strong>
          <p>{hasProject ? "所有改动会记录在当前项目中。" : "旧的创作记录已经清空。"}</p>
        </article>
      </section>
    </div>
  );
}
