"use client";

import type { ReactNode } from "react";
import { ImagePlus } from "lucide-react";
import type { AssetPanelSummary } from "@/app/components/asset-panel-summary";
import type { StudioTabSummary } from "@/app/components/studio-tab-summary";
import type { AssetRecord, PostProject, Section } from "@/app/types";

export function PostStudioReferencesTab({
  summary,
  assetSummary,
  publishAssetIds,
  project,
  onQuickAction,
  onSelectPostImages,
  onUploadReferenceFiles,
  onOpenImageStudio,
  onNavigate
}: {
  summary: StudioTabSummary;
  assetSummary: AssetPanelSummary;
  publishAssetIds: string[];
  project: PostProject | null | undefined;
  onQuickAction: (action: string) => void;
  onSelectPostImages: (assetIds: string[]) => void;
  onUploadReferenceFiles: (files: FileList | File[]) => void;
  onOpenImageStudio: () => void;
  onNavigate: (section: Section) => void;
}) {
  return (
    <MediaSideSection title="图片参考">
      <StudioTaskSummary summary={summary} onQuickAction={onQuickAction} />
      <p className="muted">这里主要放产品原图、参考图和当前选中图。默认不铺开全部素材，更多管理在 Assets。</p>
      <p className="assetCompressionLine">{assetSummary.compressionLine}</p>
      <ReferenceDropzone onUploadReferenceFiles={onUploadReferenceFiles} />
      {assetSummary.previewAssets.length ? (
        <AssetPickGrid
          assets={assetSummary.previewAssets}
          label="参考图"
          publishAssetIds={publishAssetIds}
          onSelectPostImages={onSelectPostImages}
        />
      ) : (
        <p className="muted">还没有产品图或参考图。可以直接在这里上传，也可以让 Agent 先生成图片方向。</p>
      )}
      {project?.finalPost?.imageIds.length ? (
        <p className="muted">最终帖子图片：{project.finalPost.imageIds.slice(0, 4).join(" / ")}</p>
      ) : null}
      <div className="inlineActionGrid">
        <label className="secondaryButton fullWidth studioInlineUpload">
          上传产品图 / 参考图
          <input
            accept="image/*"
            multiple
            type="file"
            onChange={(event) => {
              if (event.target.files?.length) {
                onUploadReferenceFiles(event.target.files);
                event.target.value = "";
              }
            }}
          />
        </label>
      </div>
      <details className="mediaUtilityDrawer">
        <summary>
          <strong>素材管理与高级工具</strong>
          <span>打开完整素材库或独立图片创作台</span>
        </summary>
        <button className="secondaryButton fullWidth" onClick={onOpenImageStudio} type="button">高级图片创作台</button>
        <button className="secondaryButton fullWidth" onClick={() => onNavigate("assets")} type="button">管理全部素材</button>
      </details>
    </MediaSideSection>
  );
}

export function PostStudioGeneratedTab({
  summary,
  assetSummary,
  publishAssetIds,
  project,
  ragCreativeBlocked = false,
  onQuickAction,
  onSelectPostImages,
  onOpenImageStudio
}: {
  summary: StudioTabSummary;
  assetSummary: AssetPanelSummary;
  publishAssetIds: string[];
  project: PostProject | null | undefined;
  ragCreativeBlocked?: boolean;
  onQuickAction: (action: string) => void;
  onSelectPostImages: (assetIds: string[]) => void;
  onOpenImageStudio: () => void;
}) {
  const visualDirectionConfirmed = Boolean(project?.visualDirection?.confirmedAt || project?.visualDirection?.confirmationStatus === "confirmed");
  const hasVisualDirection = Boolean(project?.visualDirection);
  const imageGenerationAction = ragCreativeBlocked ? "retrieve_viral_knowledge" : "generate_images";
  const imageGenerationBlocked = !ragCreativeBlocked && !visualDirectionConfirmed;
  const imageGenerationLabel = ragCreativeBlocked
    ? "补强爆款证据"
    : visualDirectionConfirmed
    ? "Agent 生成配图"
    : hasVisualDirection
      ? "先确认图片方向"
      : "先规划图片方向";

  return (
    <MediaSideSection title="已生成素材">
      <StudioTaskSummary summary={summary} onQuickAction={onQuickAction} />
      <div className={`assetPanelSummary ${assetSummary.state}`}>
        <strong>{assetSummary.headline}</strong>
        <p>{assetSummary.detail}</p>
        <small>{assetSummary.compressionLine}</small>
        <span>{assetSummary.actionHint}</span>
      </div>
      {assetSummary.previewAssets.length ? (
        <AssetPickGrid
          assets={assetSummary.previewAssets}
          label="生成图"
          publishAssetIds={publishAssetIds}
          project={project}
          onSelectPostImages={onSelectPostImages}
        />
      ) : (
        <p className="muted">可以让 Agent 在当前项目里生成配图；需要更多参数时再打开高级图片工具。</p>
      )}
      <div className="inlineActionGrid">
        <button
          className="secondaryButton fullWidth"
          disabled={imageGenerationBlocked}
          onClick={() => onQuickAction(imageGenerationAction)}
          title={imageGenerationBlocked ? "图片方向必须人工确认后才能生成配图。" : undefined}
          type="button"
        >
          {imageGenerationLabel}
        </button>
        <button className="secondaryButton fullWidth" onClick={() => onQuickAction("generate_cards")} type="button">生成图文卡片</button>
      </div>
      <details className="mediaUtilityDrawer">
        <summary>
          <strong>更多生成参数</strong>
          <span>需要批量、尺寸或复杂卡片设置时再打开</span>
        </summary>
        <button className="secondaryButton fullWidth" onClick={onOpenImageStudio} type="button">高级图片工具</button>
      </details>
    </MediaSideSection>
  );
}

function MediaSideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="studioSideSection">
      <h3><ImagePlus size={16} />{title}</h3>
      {children}
    </section>
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

function ReferenceDropzone({ onUploadReferenceFiles }: { onUploadReferenceFiles: (files: FileList | File[]) => void }) {
  return (
    <div
      className="studioReferenceDropzone"
      onDragOver={(event) => {
        if (hasImageFiles(event.dataTransfer.files)) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        if (!hasImageFiles(event.dataTransfer.files)) return;
        event.preventDefault();
        onUploadReferenceFiles(event.dataTransfer.files);
      }}
      onPaste={(event) => {
        if (!hasImageFiles(event.clipboardData.files)) return;
        event.preventDefault();
        onUploadReferenceFiles(event.clipboardData.files);
      }}
      tabIndex={0}
    >
      <ImagePlus size={18} />
      <span>拖入或粘贴产品图 / 参考图</span>
    </div>
  );
}

function AssetPickGrid({
  assets,
  label,
  publishAssetIds,
  project,
  onSelectPostImages
}: {
  assets: AssetRecord[];
  label: string;
  publishAssetIds: string[];
  project?: PostProject | null;
  onSelectPostImages: (assetIds: string[]) => void;
}) {
  return (
    <div className="studioAssetGrid selectable">
      {assets.map((asset) => {
        const selected = publishAssetIds.includes(asset.id);
        const projectImage = project?.generatedImages.find((image) => (image.assetId ?? image.id) === asset.id);
        return (
          <button
            className={selected ? "studioAssetPick selected" : "studioAssetPick"}
            key={asset.id}
            type="button"
            onClick={() =>
              onSelectPostImages(
                selected
                  ? publishAssetIds.filter((id) => id !== asset.id)
                  : [...publishAssetIds, asset.id]
              )
            }
          >
            <img alt={asset.name} src={`/api/assets/file/${asset.id}`} />
            <span>{selected ? "已选" : label}</span>
            {projectImage?.promptVersionId || projectImage?.basedOnEvidenceIds?.length ? (
              <small>
                {projectImage.promptVersionId ? `Prompt ${projectImage.promptVersionId}` : "Prompt 待绑定"}
                {projectImage.basedOnEvidenceIds?.length ? ` · 证据 ${projectImage.basedOnEvidenceIds.length}` : ""}
              </small>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function hasImageFiles(files: FileList | File[]): boolean {
  return Array.from(files).some((file) => file.type.startsWith("image/"));
}
