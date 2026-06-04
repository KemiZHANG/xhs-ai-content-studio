"use client";

import { Bot, FileText, ImagePlus, ShieldCheck, Sparkles } from "lucide-react";
import type { CanvasVersionDisplay } from "@/app/components/post-version-display";
import type { CreationProvenanceCard } from "@/app/components/creation-provenance";
import { citationFieldBadges, formatCitationStripSummary } from "@/app/components/evidence-citation-display";
import type { AssetRecord, PostProject, PublishDraftState, WorkflowResult } from "@/app/types";
import type { EvidenceCitationReport } from "@/lib/post-project/citations";
import type { PostVersionDiffReport, PostVersionStatus } from "@/lib/post-project/versioning";

type CopyVersion = PostProject["copyVersions"][number];
type ImagePromptVersion = PostProject["imagePrompts"][number];
type VersionSwitchGuidance = {
  state: string;
  label: string;
  detail: string;
};

export function PostCanvasPanel({
  canGenerateCopy,
  generatedCopyPrompt,
  creationProvenance,
  canvasVersionDisplay,
  canvasDirty,
  selectedAssets,
  copyVersions,
  copyVersionGuidance,
  publishDraft,
  latestImagePrompt,
  project,
  imagePromptVersions,
  promptVersionGuidance,
  versionStatus,
  versionDiff,
  citationReport,
  onGenerateCopy,
  onOpenEvidence,
  onDraftChange,
  onSelectCopyVersion,
  onSelectImagePromptVersion,
  onQuickAction,
  onCommitCanvas
}: {
  canGenerateCopy: boolean;
  generatedCopyPrompt: string;
  creationProvenance: CreationProvenanceCard[];
  canvasVersionDisplay: CanvasVersionDisplay;
  canvasDirty: boolean;
  selectedAssets: AssetRecord[];
  copyVersions: CopyVersion[];
  copyVersionGuidance: VersionSwitchGuidance;
  publishDraft: PublishDraftState;
  latestImagePrompt: string;
  project: PostProject | null;
  imagePromptVersions: ImagePromptVersion[];
  promptVersionGuidance: VersionSwitchGuidance;
  versionStatus: PostVersionStatus | null;
  versionDiff: PostVersionDiffReport | null;
  citationReport: EvidenceCitationReport | null;
  onGenerateCopy: (prompt: string) => void;
  onOpenEvidence: () => void;
  onDraftChange: (next: PublishDraftState) => void;
  onSelectCopyVersion: (versionId: string) => void;
  onSelectImagePromptVersion: (versionId: string) => void;
  onQuickAction: (action: string) => void;
  onCommitCanvas: () => void;
}) {
  const hasDraftContent = Boolean(publishDraft.title.trim() || publishDraft.content.trim() || publishDraft.tagsText.trim());
  const showCanvasStarter = !hasDraftContent && !selectedAssets.length;

  return (
    <section className="panel postCanvasPane">
      <div className="panelHeader compact">
        <div>
          <h2>Post Canvas</h2>
          <p>最终帖子画布。标题、正文、标签、图片和发布预览在这里合并。</p>
        </div>
        <button className="secondaryButton" disabled={!canGenerateCopy} onClick={() => onGenerateCopy(generatedCopyPrompt)} type="button">
          <Bot size={16} />
          生成文案
        </button>
      </div>

      {showCanvasStarter ? (
        <CanvasStarterGuide
          canGenerateCopy={canGenerateCopy}
          onGenerateCopy={() => onGenerateCopy(generatedCopyPrompt)}
          onQuickAction={onQuickAction}
        />
      ) : null}

      <CreationProvenanceStrip cards={creationProvenance} onOpenEvidence={onOpenEvidence} />
      <CanvasEvidenceBridge project={project} citationReport={citationReport} />
      <CanvasVersionSummary canvasDirty={canvasDirty} display={canvasVersionDisplay} />

      <div className="postPreviewShell">
        <PostPreviewMediaColumn selectedAssets={selectedAssets} />
        <div className="postEditStack">
          <CopyVersionSwitcher
            copyVersionGuidance={copyVersionGuidance}
            copyVersions={copyVersions}
            publishDraft={publishDraft}
            onDraftChange={onDraftChange}
            onSelectCopyVersion={onSelectCopyVersion}
          />
          <PostDraftEditor
            latestImagePrompt={latestImagePrompt}
            project={project}
            publishDraft={publishDraft}
            onDraftChange={onDraftChange}
            onQuickAction={onQuickAction}
          />
          <ImagePromptVersionSwitcher
            imagePromptVersions={imagePromptVersions}
            latestImagePrompt={latestImagePrompt}
            promptVersionGuidance={promptVersionGuidance}
            publishDraft={publishDraft}
            onDraftChange={onDraftChange}
            onSelectImagePromptVersion={onSelectImagePromptVersion}
          />
          <FinalPostAndVersionStatus
            canvasDirty={canvasDirty}
            citationReport={citationReport}
            project={project}
            versionDiff={versionDiff}
            versionStatus={versionStatus}
          />
        </div>
      </div>

      <CanvasActionRow
        canvasDirty={canvasDirty}
        project={project}
        publishDraft={publishDraft}
        onCommitCanvas={onCommitCanvas}
        onQuickAction={onQuickAction}
      />
    </section>
  );
}

function CanvasStarterGuide({
  canGenerateCopy,
  onGenerateCopy,
  onQuickAction
}: {
  canGenerateCopy: boolean;
  onGenerateCopy: () => void;
  onQuickAction: (action: string) => void;
}) {
  return (
    <section className="canvasStarterGuide" aria-label="Post Canvas 起步引导">
      <div>
        <span>空画布</span>
        <strong>先让 Agent 建立证据，再把文案和图片放到同一篇帖子里</strong>
        <p>这里最终只负责承载标题、正文、标签、图片和发布预览；研究和生成动作会同步写回当前 PostProject。</p>
      </div>
      <div>
        <button type="button" onClick={() => onQuickAction("search_research")}>搜索真实笔记</button>
        <button disabled={!canGenerateCopy} type="button" onClick={onGenerateCopy}>生成文案</button>
        <button type="button" onClick={() => onQuickAction("select_images")}>选择图片</button>
      </div>
    </section>
  );
}

function CreationProvenanceStrip({
  cards,
  onOpenEvidence
}: {
  cards: CreationProvenanceCard[];
  onOpenEvidence: () => void;
}) {
  return (
    <section className="creationProvenanceStrip" aria-label="创作证据追溯">
      <div className="creationProvenanceHeader">
        <div>
          <span>为什么这样创作</span>
          <strong>Brief、文案和图片方向都需要能追溯到 evidencePack</strong>
        </div>
        <button className="textButton" type="button" onClick={onOpenEvidence}>
          查看证据
        </button>
      </div>
      <div className="creationProvenanceGrid">
        {cards.map((card) => (
          <article className={`creationProvenanceCard ${card.state}`} key={card.id}>
            <span>{card.label}</span>
            <strong>{card.headline}</strong>
            <p>{card.detail}</p>
            {card.safetyLine ? <p className="creationProvenanceSafety">{card.safetyLine}</p> : null}
            <small>
              {card.sourceLine} · 证据 {card.evidenceCount}
              {card.missingCount ? ` · 待补 ${card.missingCount}` : ""}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}

function CanvasEvidenceBridge({
  project,
  citationReport
}: {
  project: PostProject | null;
  citationReport: EvidenceCitationReport | null;
}) {
  const briefCount = project?.creativeBrief?.basedOnEvidenceIds.length ?? 0;
  const copyCount = project?.copyDraft?.draft.basedOnEvidenceIds?.length ?? 0;
  const visualCount = project?.visualDirection?.basedOnEvidenceIds.length ?? 0;
  const total = citationReport?.allEvidenceIds.length ?? briefCount + copyCount + visualCount;
  const sourceCounts = countReferencedEvidenceSources(project, citationReport);

  return (
    <section className="evidenceReferenceStrip" aria-label="Brief 与证据来源">
      <strong>创作依据</strong>
      <span>{formatCanvasEvidenceSourceLine(sourceCounts)}</span>
      <div className="citationBadgeRow">
        <em className={briefCount ? "ok" : "warn"}>Brief {briefCount}</em>
        <em className={copyCount ? "ok" : "warn"}>文案 {copyCount}</em>
        <em className={visualCount ? "ok" : "warn"}>图片 {visualCount}</em>
        <em className={total ? "ok" : "warn"}>总证据 {total}</em>
        <em className={sourceCounts.viral_library ? "ok" : "warn"}>爆款库 {sourceCounts.viral_library}</em>
      </div>
      <small>文案和图片共享当前 CreativeBrief；没有证据支持的内容不会标记为研究结论。</small>
    </section>
  );
}

function CanvasVersionSummary({
  canvasDirty,
  display
}: {
  canvasDirty: boolean;
  display: CanvasVersionDisplay;
}) {
  return (
    <section className={`canvasVersionSummary ${display.tone}`} aria-label="画布版本同步摘要">
      <div>
        <span>版本同步</span>
        <strong>{canvasDirty ? "画布有未保存修改" : display.label}</strong>
        <p>{canvasDirty ? "请先保存画布，再组装最终稿或运行发布检查。" : display.detail}</p>
      </div>
      <div className="canvasVersionLanes">
        {display.lanes.map((lane) => (
          <span className={lane.state} key={lane.id}>
            <small>{lane.label}</small>
            {lane.value}
          </span>
        ))}
      </div>
    </section>
  );
}

function PostPreviewMediaColumn({ selectedAssets }: { selectedAssets: AssetRecord[] }) {
  return (
    <div className="postPreviewMediaColumn">
      <div className="postCoverPreview">
        {selectedAssets[0] ? (
          <img alt={selectedAssets[0].name} src={`/api/assets/file/${selectedAssets[0].id}`} />
        ) : (
          <div>
            <ImagePlus size={28} />
            <span>封面待选择</span>
          </div>
        )}
      </div>
      <section className={selectedAssets.length ? "selectedPostImages ready" : "selectedPostImages empty"} aria-label="已选择发布图片">
        <div>
          <strong>{selectedAssets.length ? `已选 ${selectedAssets.length} 张发布图片` : "发布图片未选择"}</strong>
          <span>{selectedAssets.length ? "这些图片已同步到当前 PostProject，会进入发布装配与安全检查。" : "在参考图或生成素材里选择图片，或让 Agent 先生成配图。"}</span>
        </div>
        {selectedAssets.length ? (
          <div className="selectedPostImageThumbs">
            {selectedAssets.slice(0, 4).map((asset) => (
              <img alt={asset.name} key={asset.id} src={`/api/assets/file/${asset.id}`} />
            ))}
            {selectedAssets.length > 4 ? <span>+{selectedAssets.length - 4}</span> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function CopyVersionSwitcher({
  copyVersions,
  copyVersionGuidance,
  publishDraft,
  onDraftChange,
  onSelectCopyVersion
}: {
  copyVersions: CopyVersion[];
  copyVersionGuidance: VersionSwitchGuidance;
  publishDraft: PublishDraftState;
  onDraftChange: (next: PublishDraftState) => void;
  onSelectCopyVersion: (versionId: string) => void;
}) {
  if (!copyVersions.length) return null;

  return (
    <details className="versionSwitcher canvasVersionDrawer" aria-label="文案版本">
      <summary>
        <strong>文案版本</strong>
        <span>最近 {Math.min(copyVersions.length, 4)} 个可回滚版本 · {copyVersionGuidance.detail}</span>
      </summary>
      <div>
        {copyVersions.slice(-4).map((version, index) => (
          <article className="versionCard" key={version.id}>
            <div>
              <strong>{version.value.title || version.label || `版本 ${index + 1}`}</strong>
              <span>{formatDateTime(version.createdAt)} · 证据 {version.basedOnEvidenceIds.length}</span>
            </div>
            <p>{summarizeDraftDiff(publishDraft, version.value)}</p>
            <small className={`versionSwitchHint ${copyVersionGuidance.state}`}>{copyVersionGuidance.label}</small>
            <button
              type="button"
              onClick={() => {
                onDraftChange({
                  title: version.value.title,
                  content: version.value.content,
                  tagsText: version.value.tags.map((tag) => `#${tag}`).join(" "),
                  imagePrompt: version.value.imagePrompt || publishDraft.imagePrompt
                });
                onSelectCopyVersion(version.id);
              }}
            >
              回到此版本
            </button>
          </article>
        ))}
      </div>
    </details>
  );
}

function PostDraftEditor({
  publishDraft,
  latestImagePrompt,
  project,
  onDraftChange,
  onQuickAction
}: {
  publishDraft: PublishDraftState;
  latestImagePrompt: string;
  project: PostProject | null;
  onDraftChange: (next: PublishDraftState) => void;
  onQuickAction: (action: string) => void;
}) {
  const visualDirectionConfirmed = Boolean(project?.visualDirection?.confirmedAt || project?.visualDirection?.confirmationStatus === "confirmed");

  return (
    <>
      <label>
        <span>标题</span>
        <input value={publishDraft.title} onChange={(event) => onDraftChange({ ...publishDraft, title: event.target.value })} placeholder="生成或手动填写标题" />
      </label>
      <label>
        <span>正文</span>
        <textarea value={publishDraft.content} onChange={(event) => onDraftChange({ ...publishDraft, content: event.target.value })} placeholder="正文会从 Agent 草稿同步过来，也可以直接编辑。" />
      </label>
      <label>
        <span>标签</span>
        <input value={publishDraft.tagsText} onChange={(event) => onDraftChange({ ...publishDraft, tagsText: event.target.value })} placeholder="#小红书 #探店" />
      </label>
      <label>
        <span>图片方向 / Prompt</span>
        <textarea
          value={latestImagePrompt}
          onChange={(event) => onDraftChange({ ...publishDraft, imagePrompt: event.target.value })}
          placeholder="文案和图片共享 CreativeBrief，图片方向会沉淀在这里。"
        />
      </label>
      {project?.visualDirection ? (
        <section className={visualDirectionConfirmed ? "versionIntegrity ok" : "versionIntegrity warn"} aria-label="图片方向确认状态">
          <strong>{visualDirectionConfirmed ? "图片方向已确认" : "图片方向待确认"}</strong>
          <p>
            {project.visualDirection.mood} · {project.visualDirection.composition}
          </p>
          {project.visualDirection.confirmedAt ? <small>确认时间: {formatDateTime(project.visualDirection.confirmedAt)}</small> : null}
          {!visualDirectionConfirmed ? (
            <button className="secondaryButton compactButton" type="button" onClick={() => onQuickAction("confirm_visual_direction")}>
              确认图片方向
            </button>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function ImagePromptVersionSwitcher({
  imagePromptVersions,
  latestImagePrompt,
  promptVersionGuidance,
  publishDraft,
  onDraftChange,
  onSelectImagePromptVersion
}: {
  imagePromptVersions: ImagePromptVersion[];
  latestImagePrompt: string;
  promptVersionGuidance: VersionSwitchGuidance;
  publishDraft: PublishDraftState;
  onDraftChange: (next: PublishDraftState) => void;
  onSelectImagePromptVersion: (versionId: string) => void;
}) {
  if (!imagePromptVersions.length) return null;

  return (
    <details className="versionSwitcher compactVersionSwitcher canvasVersionDrawer" aria-label="图片 Prompt 版本">
      <summary>
        <strong>Prompt 版本</strong>
        <span>最近 {Math.min(imagePromptVersions.length, 3)} 个可切换 Prompt · {promptVersionGuidance.detail}</span>
      </summary>
      <div>
        {imagePromptVersions.slice(-3).map((version, index) => (
          <article className="versionCard promptVersionCard" key={version.id}>
            <div>
              <strong>{version.label || `Prompt ${index + 1}`}</strong>
              <span>{formatDateTime(version.createdAt)} · 证据 {version.basedOnEvidenceIds.length}</span>
            </div>
            <p>{summarizePromptDiff(latestImagePrompt, version.value.prompt)}</p>
            <small className={`versionSwitchHint ${promptVersionGuidance.state}`}>{promptVersionGuidance.label}</small>
            {version.value.negativePrompt ? <small>避免: {version.value.negativePrompt.slice(0, 90)}</small> : null}
            <button
              type="button"
              onClick={() => {
                onDraftChange({ ...publishDraft, imagePrompt: version.value.prompt });
                onSelectImagePromptVersion(version.id);
              }}
            >
              使用此 Prompt
            </button>
          </article>
        ))}
      </div>
    </details>
  );
}

function FinalPostAndVersionStatus({
  project,
  versionStatus,
  versionDiff,
  canvasDirty,
  citationReport
}: {
  project: PostProject | null;
  versionStatus: PostVersionStatus | null;
  versionDiff: PostVersionDiffReport | null;
  canvasDirty: boolean;
  citationReport: EvidenceCitationReport | null;
}) {
  return (
    <>
      {project?.finalPost ? (
        <section className="finalPostSnapshot" aria-label="最终帖子快照">
          <strong>最终帖子快照</strong>
          <div>
            <span>文案版本: {project.finalPost.copyVersionId ?? "当前画布"}</span>
            <span>图片: {project.finalPost.imageIds.length} 张</span>
            <span>Prompt: {project.finalPost.imagePromptVersionIds.length} 个</span>
            <span>证据: {project.finalPost.basedOnEvidenceIds?.length ?? 0} 条</span>
          </div>
        </section>
      ) : null}
      {versionStatus ? (
        <section className={versionStatus.qualityGateFresh ? "versionIntegrity ok" : "versionIntegrity warn"} aria-label="版本与发布检查状态">
          <strong>{canvasDirty ? "画布有未保存修改" : versionStatus.qualityGateFresh ? "版本已确认" : "版本需要复核"}</strong>
          <p>{canvasDirty ? "请先保存画布到当前 PostProject，再运行发布检查，避免误用旧草稿或旧图片。" : versionStatus.summary}</p>
          {versionDiff?.hasChanges ? (
            <div className="versionDiffList" aria-label="版本差异">
              {versionDiff.changes
                .filter((change) => change.changed)
                .slice(0, 3)
                .map((change) => (
                  <small key={change.field}>
                    {change.label}: {change.beforeSummary} {"->"} {change.afterSummary}
                  </small>
                ))}
            </div>
          ) : null}
          <div>
            <span>文案: {versionStatus.activeCopyVersionId ?? "待生成"}</span>
            <span>Prompt: {versionStatus.activeImagePromptVersionIds.length || 0} 个</span>
          </div>
          {versionStatus.warnings.slice(0, 3).map((warning) => (
            <small key={warning}>{warning}</small>
          ))}
        </section>
      ) : null}
      {citationReport?.allEvidenceIds.length ? (
        <section className="evidenceReferenceStrip" aria-label="文案证据引用">
          <strong>证据引用</strong>
          <span>{formatCitationStripSummary(citationReport)}</span>
          <div className="citationBadgeRow">
            {citationFieldBadges(citationReport).map((badge) => (
              <em className={badge.status} key={badge.label}>
                {badge.label} {badge.count}
              </em>
            ))}
          </div>
          {citationReport.warnings.length ? <small>{citationReport.warnings[0]}</small> : null}
        </section>
      ) : null}
    </>
  );
}

function CanvasActionRow({
  publishDraft,
  canvasDirty,
  project,
  onCommitCanvas,
  onQuickAction
}: {
  publishDraft: PublishDraftState;
  canvasDirty: boolean;
  project: PostProject | null;
  onCommitCanvas: () => void;
  onQuickAction: (action: string) => void;
}) {
  const visualDirectionConfirmed = Boolean(project?.visualDirection?.confirmedAt || project?.visualDirection?.confirmationStatus === "confirmed");
  const hasVisualDirection = Boolean(project?.visualDirection);
  const imageGenerationBlocked = !visualDirectionConfirmed;
  const imageGenerationLabel = visualDirectionConfirmed
    ? "Agent 生图"
    : hasVisualDirection
      ? "先确认图片方向"
      : "先规划图片方向";

  return (
    <div className="canvasActionRow">
      <button className={canvasDirty ? "primaryButton" : "secondaryButton"} disabled={!publishDraft.title && !publishDraft.content} onClick={onCommitCanvas} type="button">
        <FileText size={16} />
        {canvasDirty ? "保存画布" : "画布已同步"}
      </button>
      <button className="secondaryButton" onClick={() => onQuickAction("plan_visuals")} type="button">
        <Sparkles size={16} />
        规划图片方向
      </button>
      <button
        className="secondaryButton"
        disabled={imageGenerationBlocked}
        onClick={() => onQuickAction("generate_images")}
        title={imageGenerationBlocked ? "图片方向必须人工确认后才能生成配图。" : undefined}
        type="button"
      >
        <ImagePlus size={16} />
        {imageGenerationLabel}
      </button>
      <button className="secondaryButton" onClick={() => onQuickAction("generate_cards")} disabled={!publishDraft.title || !publishDraft.content} type="button">
        <ImagePlus size={16} />
        生成图文卡片
      </button>
      <button className="primaryButton" onClick={() => onQuickAction("run_quality_gate")} disabled={!publishDraft.title || !publishDraft.content || canvasDirty} type="button">
        <ShieldCheck size={16} />
        {canvasDirty ? "先保存再检查" : "发布检查"}
      </button>
    </div>
  );
}

function countReferencedEvidenceSources(
  project: PostProject | null,
  citationReport: EvidenceCitationReport | null
): Record<"realtime" | "viral_library" | "user_input", number> {
  const counts = { realtime: 0, viral_library: 0, user_input: 0 };
  if (citationReport) {
    counts.realtime = Number(citationReport.sourceCounts.realtime ?? 0);
    counts.viral_library = Number(citationReport.sourceCounts.viral_library ?? 0);
    counts.user_input = Number(citationReport.sourceCounts.user_input ?? 0);
    return counts;
  }

  const evidenceById = new Map((project?.evidencePack.insights ?? []).map((insight) => [insight.id, insight.sourceType ?? "realtime"]));
  const referencedIds = new Set([
    ...(project?.creativeBrief?.basedOnEvidenceIds ?? []),
    ...(project?.copyDraft?.draft.basedOnEvidenceIds ?? []),
    ...(project?.visualDirection?.basedOnEvidenceIds ?? []),
    ...((project?.imagePrompts ?? []).flatMap((prompt) => prompt.basedOnEvidenceIds ?? [])),
    ...(project?.finalPost?.basedOnEvidenceIds ?? [])
  ]);

  for (const id of referencedIds) {
    const source = evidenceById.get(id);
    if (source === "viral_library") counts.viral_library += 1;
    else if (source === "user_input") counts.user_input += 1;
    else if (source === "realtime") counts.realtime += 1;
  }
  return counts;
}

function formatCanvasEvidenceSourceLine(counts: Record<"realtime" | "viral_library" | "user_input", number>): string {
  const total = counts.realtime + counts.viral_library + counts.user_input;
  if (!total) {
    return "文案和图片还没有可追溯证据；先搜索真实笔记或刷新爆款库 RAG。";
  }
  const parts = [
    counts.realtime ? `实时研究 ${counts.realtime}` : "",
    counts.viral_library ? `爆款库 ${counts.viral_library}` : "",
    counts.user_input ? `用户输入 ${counts.user_input}` : ""
  ].filter(Boolean);
  return `当前稿件引用：${parts.join(" / ")}。爆款库只提供结构、钩子和视觉规律，不复制原文。`;
}

function summarizeDraftDiff(current: PublishDraftState, version: NonNullable<WorkflowResult["draft"]>): string {
  const changes = [];
  if (current.title.trim() && current.title.trim() !== version.title.trim()) changes.push("标题不同");
  const currentLength = current.content.trim().length;
  const nextLength = version.content.trim().length;
  if (currentLength && currentLength !== nextLength) changes.push(`正文 ${nextLength - currentLength > 0 ? "+" : ""}${nextLength - currentLength} 字`);
  const currentTags = parseTags(current.tagsText).join("|");
  const versionTags = version.tags.join("|");
  if (currentTags && currentTags !== versionTags) changes.push("标签不同");
  return changes.length ? changes.join(" · ") : "当前画布一致";
}

function summarizePromptDiff(currentPrompt: string, nextPrompt: string): string {
  const current = currentPrompt.trim();
  const next = nextPrompt.trim();
  if (!current) return next ? `将填入 ${next.length} 字图片 Prompt` : "Prompt 为空";
  if (current === next) return "当前 Prompt 一致";
  const delta = next.length - current.length;
  return `Prompt ${delta > 0 ? "+" : ""}${delta} 字`;
}

function parseTags(value: string): string[] {
  return value
    .split(/[#\s,，、]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatDateTime(value?: string): string {
  if (!value) return "未知时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
