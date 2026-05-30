"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  Library,
  Search,
  ShieldCheck,
} from "lucide-react";
import type {
  AssetRecord,
  CreatorMemoryProfile,
  DraftRecord,
  Health,
  JobRecord,
  PostProject,
  RedactedSettings,
  Section,
  WorkflowResult,
  WorkspaceState
} from "@/app/types";

type FlowForm = {
  topic: string;
  contentType: string;
  timeRange: string;
  sampleCount: number;
  analyzeImages: boolean;
  requirements: string;
};

type FlowSlots = {
  object: string;
  audience: string;
  tone: string;
  mustHave: string;
  avoid: string;
  imageDirection: string;
};

export function AgentFlowPanel({
  form,
  busy,
  result,
  workspace,
  postProject,
  currentDraft,
  creatorMemory,
  assets,
  selectedImageIds,
  jobs,
  settings,
  health,
  onChange,
  onSubmitResearch,
  onSendDraftPrompt,
  onRememberPreference,
  onResetProject,
  onNavigate
}: {
  form: FlowForm;
  busy: boolean;
  result: WorkflowResult | null;
  workspace: WorkspaceState | null;
  postProject: PostProject | null;
  currentDraft: DraftRecord | null;
  creatorMemory: CreatorMemoryProfile | null;
  assets: AssetRecord[];
  selectedImageIds: string[];
  jobs: JobRecord[];
  settings: RedactedSettings;
  health: Health | null;
  onChange: (next: FlowForm) => void;
  onSubmitResearch: (event: FormEvent<HTMLFormElement>) => void;
  onSendDraftPrompt: (message: string) => void;
  onRememberPreference: (text: string) => void;
  onResetProject: () => void;
  onNavigate: (section: Section) => void;
}) {
  const [slots] = useState<FlowSlots>({
    object: "",
    audience: "",
    tone: "",
    mustHave: "",
    avoid: "",
    imageDirection: ""
  });
  const [creativeNeed, setCreativeNeed] = useState("");
  const [memoryText, setMemoryText] = useState("");
  const activeJob = jobs.find((job) => job.status === "queued" || job.status === "running") ?? null;
  const selectedAssets = assets.filter((asset) => selectedImageIds.includes(asset.id));
  const draft = workspace?.currentDraft ?? currentDraft;
  const evidenceCount = result?.evidence?.length ?? result?.samples.length ?? workspace?.selectedSamples?.length ?? 0;
  const summary = result?.researchSummary ?? (workspace?.evidenceSummary as WorkflowResult["researchSummary"] | undefined);
  const account =
    settings.accounts.find((item) => item.id === settings.activeAccountId) ?? settings.accounts[0];
  const stageLabel = postProject ? labelForStage(postProject.currentStage) : "等待开始";
  const nextActions = postProject?.allowedActions.slice(0, 3).map(labelForAction) ?? ["填写主题", "开始研究"];

  const draftPrompt = useMemo(() => {
    const lines = [
      "请基于当前研究总结生成一篇原创小红书图文笔记，不要重新搜索。",
      `主题：${form.topic || workspace?.topic || slots.object || "未填写"}`,
      `内容类型：${form.contentType}`,
      `我的创作要求：${creativeNeed || form.requirements || "请先根据研究证据生成一个可直接修改的初稿"}`,
      `写作对象：${slots.object || "请根据主题和研究证据判断"}`,
      `目标人群：${slots.audience || "请根据主题推断并说明"}`,
      `语气风格：${slots.tone || "真实分享、生活化、不像硬广"}`,
      `必须包含：${slots.mustHave || form.requirements || "保留真实可执行的信息"}`,
      `避免：${slots.avoid || "不要抄袭原帖，不要拼凑，不要夸大，不要写虚假承诺"}`,
      `图片方向：${slots.imageDirection || "给出封面和正文配图建议"}`,
      "",
      "请输出：3 个标题候选、最终标题、正文、标签、正文结构、图片创作说明。"
    ];
    return lines.join("\n");
  }, [creativeNeed, form, slots, workspace?.topic]);

  function rememberPreference() {
    const text =
      memoryText.trim() ||
      (draft
        ? `我满意这篇草稿的标题、口吻和结构：${draft.draft.title}`
        : `${slots.tone || form.contentType} 风格适合我后续的小红书创作`);
    onRememberPreference(text);
    setMemoryText("");
  }

  return (
    <div className="agentFlow">
      <section className="flowHero panel">
        <div>
          <span className="flowKicker">XHS AI Content Studio</span>
          <h2>一个主题，三步生成小红书笔记。</h2>
          <p>
            先搜索真实笔记，提炼标题、正文、标签和图片优点；再按你的要求生成文案；最后进入图片和发布确认。
          </p>
          <div className="flowHeroActions">
            <button className="primaryButton" onClick={onResetProject} type="button">
              新建创作项目
            </button>
            <button className="secondaryButton" onClick={() => onNavigate("chat")} type="button">
              进入 AI 工作台
            </button>
          </div>
          <div className="postProjectStatus">
            <strong>当前项目：{postProject?.topic || form.topic || "未命名帖子"}</strong>
            <span>阶段：{stageLabel}</span>
            <span>下一步：{nextActions.join(" / ")}</span>
          </div>
        </div>
        <div className="flowHeroRail simple">
          <FlowRailItem icon={Search} label="1 搜索笔记" ready={evidenceCount > 0} />
          <FlowRailItem icon={Bot} label="2 生成文案" ready={Boolean(draft)} />
          <FlowRailItem icon={ShieldCheck} label="3 发布确认" ready={Boolean(workspace?.publishPlan)} />
        </div>
      </section>

      <div className="flowGrid">
        <section className="panel flowResearchPanel">
          <div className="panelHeader compact">
            <div>
              <h2>1. 搜索真实笔记</h2>
              <p>先拿小红书证据，只做研究，不会生成草稿或发布。</p>
            </div>
          </div>
          <form className="flowResearchForm" onSubmit={onSubmitResearch}>
            <label>
              <span>主题</span>
              <input value={form.topic} onChange={(event) => onChange({ ...form, topic: event.target.value })} />
            </label>
            <div className="formRow">
              <label>
                <span>类型</span>
                <select value={form.contentType} onChange={(event) => onChange({ ...form, contentType: event.target.value })}>
                  <option>图文</option>
                  <option>探店</option>
                  <option>种草</option>
                  <option>干货</option>
                  <option>穿搭</option>
                  <option>视频</option>
                </select>
              </label>
              <label>
                <span>时间</span>
                <select value={form.timeRange} onChange={(event) => onChange({ ...form, timeRange: event.target.value })}>
                  <option>一天内</option>
                  <option>一周内</option>
                  <option>两周内</option>
                  <option>半年内</option>
                </select>
              </label>
            </div>
            <div className="formRow">
              <label>
                <span>样本数</span>
                <input
                  max={20}
                  min={3}
                  type="number"
                  value={form.sampleCount}
                  onChange={(event) => onChange({ ...form, sampleCount: Number(event.target.value) })}
                />
              </label>
              <label className="flowInlineCheck">
                <input
                  checked={form.analyzeImages}
                  type="checkbox"
                  onChange={(event) => onChange({ ...form, analyzeImages: event.target.checked })}
                />
                <span>分析图片风格</span>
              </label>
            </div>
            <label>
              <span>补充条件</span>
              <textarea
                placeholder="可写点赞/收藏范围、城市、价格、产品卖点、想避开的表达。"
                value={form.requirements}
                onChange={(event) => onChange({ ...form, requirements: event.target.value })}
              />
            </label>
            <button className="primaryButton fullWidth" disabled={busy} type="submit">
              <Search size={16} />
              {busy ? "研究中" : "开始研究"}
            </button>
          </form>
        </section>

        <section className="panel flowInsightPanel">
          <div className="panelHeader compact">
            <div>
              <h2>2. 可学习结论</h2>
              <p>只看结论，不把整篇原帖塞进主界面。</p>
            </div>
            <button className="secondaryButton" onClick={() => onNavigate("workflow")} type="button">
              完整证据
            </button>
          </div>
          {summary || evidenceCount ? (
            <div className="insightDigestGrid">
              <DigestCard title="标题怎么学" items={summary?.contentStrengths ?? []} fallback={`${evidenceCount} 条样本已就绪`} />
              <DigestCard title="正文怎么学" items={summary?.learningsForContent ?? []} fallback="等待模型总结正文结构" />
              <DigestCard title="标签怎么学" items={extractTagHints(result)} fallback="根据样本标签和搜索词生成" />
              <DigestCard title="图片怎么学" items={summary?.learningsForImages ?? summary?.imageStrengths ?? []} fallback="可进入图片创作台继续生成" />
            </div>
          ) : activeJob ? (
            <div className="flowProgressCard">
              <strong>{activeJob.title}</strong>
              <div className="miniProgress">
                <i style={{ width: `${activeJob.progress}%` }} />
              </div>
              <p>{activeJob.status} · {activeJob.progress}%</p>
            </div>
          ) : (
            <div className="flowEmptyState">
              <Library size={24} />
              <strong>还没有研究证据</strong>
              <p>先在左侧输入主题，完成后会把标题、正文、标签和图片优点压缩成下一步能直接使用的简报。</p>
            </div>
          )}
        </section>

        <section className="panel flowConsultPanel">
          <div className="panelHeader compact">
            <div>
              <h2>3. 写下你的要求</h2>
              <p>不需要填很多表。把你想强调的人群、语气、卖点、禁忌写在这里。</p>
            </div>
          </div>
          <div className="questionStepper simple">
            <textarea
              className="creativeNeedBox"
              placeholder="例如：写给第一次来上海安静咖啡馆办公的人；语气真实、不广告；必须写环境、价格、适合停留多久；不要夸张。"
              value={creativeNeed}
              onChange={(event) => setCreativeNeed(event.target.value)}
            />
            <div className="actionRow">
              <button className="primaryButton" onClick={() => onSendDraftPrompt(draftPrompt)} type="button">
                生成文案
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        <section className="panel flowPublishPanel">
          <div className="panelHeader compact">
            <div>
              <h2>下一步</h2>
              <p>文案满意后，再去生成图片或进入发布确认。</p>
            </div>
          </div>
          <div className="publishAccountGuard ok">
            <div>
              <strong>{account?.displayName ?? "当前小红书账号"}</strong>
              <span>{health?.activeAccount?.loginName ? `登录名：${health.activeAccount.loginName}` : "登录名待检测"}</span>
              <span>MCP：{settings.mcpUrl}</span>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="flowPublishFacts">
            <span>可见范围：{settings.defaultVisibility}</span>
            <span>发布策略：{settings.agentPublishPolicy === "draft_only" ? "只生成草稿" : "先生成确认单"}</span>
            <span>发布图片：{selectedAssets.length} 张</span>
          </div>
          <div className="flowNextActions">
            <button className="secondaryButton" onClick={() => onNavigate("imageStudio")} type="button">
              去图片创作台
            </button>
            <button className="primaryButton" disabled={!draft} onClick={() => onNavigate("publish")} type="button">
              发布预览
            </button>
            <button className="secondaryButton" onClick={rememberPreference} type="button">
              记住当前偏好
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function FlowRailItem({ icon: Icon, label, ready }: { icon: typeof Search; label: string; ready: boolean }) {
  return (
    <span className={ready ? "flowRailItem ready" : "flowRailItem"}>
      <Icon size={15} />
      {label}
    </span>
  );
}

function DigestCard({ title, items, fallback }: { title: string; items: string[]; fallback: string }) {
  const visible = items.filter(Boolean).slice(0, 3);
  return (
    <article className="digestCard">
      <span>{title}</span>
      {visible.length ? (
        <ul>
          {visible.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{fallback}</p>
      )}
    </article>
  );
}

function extractTagHints(result: WorkflowResult | null): string[] {
  if (!result?.draft?.tags.length) {
    return [];
  }
  return [`保留主题词 + 场景词：${result.draft.tags.slice(0, 4).map((tag) => `#${tag}`).join(" ")}`];
}

function labelForStage(stage: PostProject["currentStage"]): string {
  const labels: Record<PostProject["currentStage"], string> = {
    empty: "空项目",
    briefing: "补充需求",
    researching: "研究中",
    evidence_ready: "证据已就绪",
    brief_ready: "创作简报已就绪",
    copy_drafting: "文案生成中",
    copy_ready: "文案已就绪",
    visual_planning: "图片方向规划",
    image_prompt_ready: "图片提示词已就绪",
    image_generating: "图片生成中",
    image_ready: "图片已就绪",
    assembling: "组装帖子",
    reviewing: "发布检查",
    scheduled: "已定时",
    published: "已发布",
    failed: "失败"
  };
  return labels[stage] ?? stage;
}

function labelForAction(action: string): string {
  const labels: Record<string, string> = {
    start_brief: "填写主题",
    update_brief_inputs: "补充需求",
    search_research: "搜索笔记",
    summarize_evidence: "总结证据",
    create_creative_brief: "生成创作简报",
    generate_copy: "生成文案",
    revise_copy: "修改文案",
    plan_visuals: "规划图片",
    generate_image_prompts: "生成图片提示词",
    generate_images: "生成图片",
    select_images: "选图",
    assemble_post: "组装帖子",
    run_quality_gate: "发布检查",
    request_publish_confirmation: "生成确认单",
    schedule_publish: "定时发布",
    publish_now: "立即发布",
    recover: "恢复/重试"
  };
  return labels[action] ?? action;
}
