"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  Check,
  FileText,
  ImagePlus,
  Library,
  Search,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import type {
  AssetRecord,
  CreatorMemoryProfile,
  DraftRecord,
  Health,
  JobRecord,
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

type FlowSlot = {
  id: keyof FlowSlots;
  label: string;
  helper: string;
  placeholder: string;
};

type FlowSlots = {
  object: string;
  audience: string;
  tone: string;
  mustHave: string;
  avoid: string;
  imageDirection: string;
};

const flowSlots: FlowSlot[] = [
  {
    id: "object",
    label: "你要写什么",
    helper: "产品、门店、服务或具体体验对象。",
    placeholder: "例如：广州东山口一家安静咖啡馆 / 我的香薰蜡烛新品"
  },
  {
    id: "audience",
    label: "给谁看",
    helper: "人群越具体，标题和正文越像真人。",
    placeholder: "例如：周末想找安静座位办公的女生 / 第一次买香薰的新手"
  },
  {
    id: "tone",
    label: "想要的语气",
    helper: "决定是探店感、真实分享、干货收藏还是产品种草。",
    placeholder: "例如：生活化、不广告、有一点松弛感"
  },
  {
    id: "mustHave",
    label: "必须写进去",
    helper: "价格、地址、卖点、使用感、优惠、注意事项都可以放这里。",
    placeholder: "例如：人均 35、靠窗位置舒服、适合一个人待 2 小时"
  },
  {
    id: "avoid",
    label: "不要出现",
    helper: "用来避免夸张、违禁、像广告或不符合品牌的表达。",
    placeholder: "例如：不要夸大功效，不要写成硬广，不要说绝对化词"
  },
  {
    id: "imageDirection",
    label: "图片方向",
    helper: "没有产品图也可以生成图文卡片；有产品图则可做场景化。",
    placeholder: "例如：封面干净、有标题字；正文用 4 张收藏型图文卡片"
  }
];

export function AgentFlowPanel({
  form,
  busy,
  result,
  workspace,
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
  const [slotIndex, setSlotIndex] = useState(0);
  const [slots, setSlots] = useState<FlowSlots>({
    object: "",
    audience: "",
    tone: "",
    mustHave: "",
    avoid: "",
    imageDirection: ""
  });
  const [memoryText, setMemoryText] = useState("");
  const activeJob = jobs.find((job) => job.status === "queued" || job.status === "running") ?? null;
  const selectedAssets = assets.filter((asset) => selectedImageIds.includes(asset.id));
  const draft = workspace?.currentDraft ?? currentDraft;
  const evidenceCount = result?.evidence?.length ?? result?.samples.length ?? workspace?.selectedSamples?.length ?? 0;
  const summary = result?.researchSummary ?? (workspace?.evidenceSummary as WorkflowResult["researchSummary"] | undefined);
  const activeSlot = flowSlots[slotIndex];
  const filledSlots = flowSlots.filter((slot) => slots[slot.id].trim()).length;
  const account =
    settings.accounts.find((item) => item.id === settings.activeAccountId) ?? settings.accounts[0];

  const draftPrompt = useMemo(() => {
    const lines = [
      "请基于当前研究总结生成一篇原创小红书图文笔记，不要重新搜索。",
      `主题：${form.topic || workspace?.topic || slots.object || "未填写"}`,
      `内容类型：${form.contentType}`,
      `写作对象：${slots.object || form.requirements || "请根据研究证据判断"}`,
      `目标人群：${slots.audience || "请根据主题推断并说明"}`,
      `语气风格：${slots.tone || "真实分享、生活化、不像硬广"}`,
      `必须包含：${slots.mustHave || form.requirements || "保留真实可执行的信息"}`,
      `避免：${slots.avoid || "不要抄袭原帖，不要拼凑，不要夸大，不要写虚假承诺"}`,
      `图片方向：${slots.imageDirection || "给出封面和正文配图建议"}`,
      "",
      "请输出：3 个标题候选、最终标题、正文、标签、正文结构、图片创作说明。"
    ];
    return lines.join("\n");
  }, [form, slots, workspace?.topic]);

  function updateSlot(value: string) {
    setSlots((current) => ({ ...current, [activeSlot.id]: value }));
  }

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
          <span className="flowKicker">AI Agent 创作流水线</span>
          <h2>先找真实笔记，再问清需求，最后装配发布。</h2>
          <p>
            这里是新的主入口。你只需要从主题开始，研究、文案、图片、记忆和发布预览会按顺序推进；旧工作台仍然保留在高级入口里。
          </p>
          <div className="flowHeroActions">
            <button className="primaryButton" onClick={onResetProject} type="button">
              新建创作项目
            </button>
            <button className="secondaryButton" onClick={() => onNavigate("chat")} type="button">
              进入 AI 工作台
            </button>
          </div>
        </div>
        <div className="flowHeroRail">
          <FlowRailItem icon={Search} label="研究" ready={evidenceCount > 0} />
          <FlowRailItem icon={Bot} label="创作" ready={Boolean(draft)} />
          <FlowRailItem icon={ImagePlus} label="配图" ready={selectedAssets.length > 0} />
          <FlowRailItem icon={ShieldCheck} label="确认" ready={Boolean(workspace?.publishPlan)} />
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
              <h2>2. 爆款优点</h2>
              <p>这里只展示可学习结论，完整原帖放在高级研究台。</p>
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
              <h2>3. AI 追问创作</h2>
              <p>像对话一样补齐条件，不需要一次写完所有需求。</p>
            </div>
            <span className="flowStepCounter">{filledSlots}/{flowSlots.length}</span>
          </div>
          <div className="questionStepper">
            <div className="questionTabs">
              {flowSlots.map((slot, index) => (
                <button
                  className={index === slotIndex ? "active" : slots[slot.id] ? "done" : ""}
                  key={slot.id}
                  onClick={() => setSlotIndex(index)}
                  type="button"
                >
                  {slots[slot.id] ? <Check size={13} /> : index + 1}
                </button>
              ))}
            </div>
            <label>
              <span>{activeSlot.label}</span>
              <small>{activeSlot.helper}</small>
              <textarea
                placeholder={activeSlot.placeholder}
                value={slots[activeSlot.id]}
                onChange={(event) => updateSlot(event.target.value)}
              />
            </label>
            <div className="actionRow">
              <button
                className="secondaryButton"
                disabled={slotIndex === 0}
                onClick={() => setSlotIndex((index) => Math.max(0, index - 1))}
                type="button"
              >
                上一步
              </button>
              <button
                className="secondaryButton"
                disabled={slotIndex === flowSlots.length - 1}
                onClick={() => setSlotIndex((index) => Math.min(flowSlots.length - 1, index + 1))}
                type="button"
              >
                下一步
              </button>
              <button className="primaryButton" onClick={() => onSendDraftPrompt(draftPrompt)} type="button">
                生成文案
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        <section className="panel flowDraftPanel">
          <div className="panelHeader compact">
            <div>
              <h2>4. 当前成果</h2>
              <p>满意后记忆偏好，再进入图片和发布预览。</p>
            </div>
          </div>
          {draft ? (
            <article className="flowDraftPreview">
              <span>当前草稿</span>
              <strong>{draft.draft.title}</strong>
              <p>{draft.draft.content.slice(0, 220)}{draft.draft.content.length > 220 ? "..." : ""}</p>
              <div className="tagRow">
                {draft.draft.tags.slice(0, 6).map((tag) => (
                  <em key={tag}>#{tag}</em>
                ))}
              </div>
            </article>
          ) : (
            <div className="flowEmptyState">
              <FileText size={24} />
              <strong>草稿会出现在这里</strong>
              <p>研究完成后补齐创作条件，点击“生成文案”，右侧会沉淀成当前草稿。</p>
            </div>
          )}
          <div className="flowActionStack">
            <label>
              <span>满意后记住什么</span>
              <input
                placeholder="例如：以后保持这种生活化、不广告的语气"
                value={memoryText}
                onChange={(event) => setMemoryText(event.target.value)}
              />
            </label>
            <button className="secondaryButton fullWidth" onClick={rememberPreference} type="button">
              记住这次偏好
            </button>
            <div className="flowSplitActions">
              <button className="secondaryButton" onClick={() => onNavigate("imageStudio")} type="button">
                <ImagePlus size={16} />
                去做图片
              </button>
              <button className="primaryButton" disabled={!draft} onClick={() => onNavigate("publish")} type="button">
                <CalendarClock size={16} />
                发布预览
              </button>
            </div>
          </div>
        </section>

        <section className="panel flowPublishPanel">
          <div className="panelHeader compact">
            <div>
              <h2>发布安全</h2>
              <p>真实发布统一进入确认单，不会因为默认设置自动误发。</p>
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
        </section>

        <section className="panel flowAdvancedPanel">
          <div className="panelHeader compact">
            <div>
              <h2>高级入口</h2>
              <p>旧功能没有删除，只是从主流程里降噪。</p>
            </div>
          </div>
          <div className="advancedShortcutGrid">
            <button type="button" onClick={() => onNavigate("workflow")}>主题研究台</button>
            <button type="button" onClick={() => onNavigate("chat")}>AI 工作台</button>
            <button type="button" onClick={() => onNavigate("imageStudio")}>图片创作台</button>
            <button type="button" onClick={() => onNavigate("assets")}>素材库</button>
            <button type="button" onClick={() => onNavigate("jobs")}>任务进度</button>
            <button type="button" onClick={() => onNavigate("audit")}>发布审计</button>
            <button type="button" onClick={() => onNavigate("history")}>历史记录</button>
            <button type="button" onClick={() => onNavigate("settings")}>模型设置</button>
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
