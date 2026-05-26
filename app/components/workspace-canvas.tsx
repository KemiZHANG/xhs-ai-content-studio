"use client";

import { useState } from "react";
import type { AssetRecord, CreatorMemoryProfile, DraftRecord, JobRecord, WorkspaceState } from "@/app/types";

export function WorkspaceCanvas({
  workspace,
  currentDraft,
  creatorMemory,
  assets,
  jobs,
  onOpenImageStudio,
  onOpenPublish
}: {
  workspace: WorkspaceState | null;
  currentDraft: DraftRecord | null;
  creatorMemory: CreatorMemoryProfile | null;
  assets: AssetRecord[];
  jobs: JobRecord[];
  onOpenImageStudio: () => void;
  onOpenPublish: () => void;
}) {
  const activeJob = jobs.find((job) => job.status === "queued" || job.status === "running") ?? jobs[0];
  const draft = workspace?.currentDraft ?? currentDraft;
  const publishPlan = workspace?.publishPlan;
  const samples = Array.isArray(workspace?.selectedSamples) ? workspace?.selectedSamples ?? [] : [];
  const images = draft?.images?.filter((image) => image.path || image.url) ?? [];
  const selectedImageIds = workspace?.selectedImageIds ?? [];
  const productImageIds = workspace?.productImageIds ?? [];
  const selectedAssets = assets.filter((asset) => selectedImageIds.includes(asset.id));
  const productAssets = assets.filter((asset) => productImageIds.includes(asset.id));
  const memorySignals = [
    ...(creatorMemory?.liked ?? []).slice(0, 2).map((item) => item.text),
    ...(creatorMemory?.tone ?? []).slice(0, 2).map((item) => item.text),
    ...(creatorMemory?.disliked ?? []).slice(0, 1).map((item) => `避免：${item.text}`)
  ];
  const [canvasMode, setCanvasMode] = useState<"overview" | "draft" | "visual" | "publish">("overview");

  return (
    <aside className="workspaceCanvas panel" data-canvas-mode={canvasMode}>
      <div className="panelHeader compact">
        <div>
          <h2>成果画布</h2>
          <p>当前对话里的研究、草稿、图片和发布计划。</p>
        </div>
      </div>

      <div className="canvasTabs" role="tablist" aria-label="成果画布视图">
        {[
          { id: "overview", label: "总览" },
          { id: "draft", label: "草稿" },
          { id: "visual", label: "图片" },
          { id: "publish", label: "发布" }
        ].map((item) => (
          <button
            aria-selected={canvasMode === item.id}
            className={canvasMode === item.id ? "active" : ""}
            key={item.id}
            onClick={() => setCanvasMode(item.id as typeof canvasMode)}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {canvasMode === "draft" && draft ? (
        <section className="notePreviewCard" data-canvas-card="draft">
          <div className="notePreviewMedia">
            {selectedAssets[0] ? (
              <img alt={selectedAssets[0].name} src={`/api/assets/file/${selectedAssets[0].id}`} />
            ) : (
              <span>封面待选</span>
            )}
          </div>
          <div className="notePreviewBody">
            <span>发布预览</span>
            <strong>{draft.draft.title}</strong>
            <p>{draft.draft.content.slice(0, 86)}{draft.draft.content.length > 86 ? "..." : ""}</p>
            <div className="tagRow">
              {draft.draft.tags.slice(0, 4).map((tag) => (
                <em key={tag}>#{tag}</em>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {canvasMode === "draft" && !draft ? (
        <section className="canvasCard" data-canvas-card="draft">
          <span>当前草稿</span>
          <strong>还没有草稿</strong>
          <p>在中间对话里让 Agent 先研究主题并生成原创小红书笔记，草稿会同步到这里。</p>
        </section>
      ) : null}

      <section className="canvasCard" data-canvas-card="overview">
        <span>当前项目</span>
        <strong>{workspace?.topic || draft?.draft.title || "等待任务"}</strong>
        <p>最近意图：{workspace?.lastUserIntent || "-"}</p>
      </section>

      {activeJob ? (
        <section className="canvasCard" data-canvas-card="overview">
          <span>后台任务</span>
          <strong>{activeJob.title}</strong>
          <div className="miniProgress">
            <i style={{ width: `${activeJob.progress}%` }} />
          </div>
          <p>{activeJob.status} · {activeJob.progress}%</p>
        </section>
      ) : null}

      <section className="canvasCard" data-canvas-card="overview">
        <span>研究证据</span>
        <strong>{samples.length} 条样本</strong>
        <p>{workspace?.evidenceSummary ? "已生成洞察总结" : "完成研究后会显示标题、正文、标签和图片规律。"}</p>
      </section>

      <section className="canvasCard" data-canvas-card="overview">
        <span>创作者记忆</span>
        <strong>{memorySignals.length ? "已启用" : "等待偏好"}</strong>
        <p>
          {memorySignals.length
            ? memorySignals.slice(0, 2).join("；")
            : "你明确说喜欢/不喜欢的风格、产品信息和常用标签会自动沉淀到这里。"}
        </p>
        {creatorMemory?.tags?.length ? (
          <div className="tagRow">
            {creatorMemory.tags.slice(0, 4).map((tag) => (
              <em key={tag.name}>#{tag.name}</em>
            ))}
          </div>
        ) : null}
      </section>

      {draft ? (
        <section className="canvasCard" data-canvas-card="draft">
          <span>当前草稿</span>
          <strong>{draft.draft.title}</strong>
          <p>{draft.draft.content.slice(0, 120)}{draft.draft.content.length > 120 ? "..." : ""}</p>
          <div className="tagRow">
            {draft.draft.tags.slice(0, 5).map((tag) => (
              <em key={tag}>#{tag}</em>
            ))}
          </div>
        </section>
      ) : null}

      <section className="canvasCard" data-canvas-card="visual">
        <span>发布图片</span>
        <strong>{selectedAssets.length || images.length} 张</strong>
        {selectedAssets.length ? (
          <div className="canvasImageGrid withImages">
            {selectedAssets.slice(0, 4).map((asset, index) => (
              <div key={asset.id}>
                <img alt={asset.name} src={`/api/assets/file/${asset.id}`} />
                <b>{index + 1}</b>
              </div>
            ))}
          </div>
        ) : images.length ? (
          <div className="canvasImageGrid">
            {images.slice(0, 4).map((image, index) => (
              <div key={`${image.path ?? image.url}-${index}`}>{index + 1}</div>
            ))}
          </div>
        ) : (
          <p>可以上传产品图，或进入图片创作台生成场景图。</p>
        )}
        <button className="secondaryButton fullWidth" onClick={onOpenImageStudio} type="button">
          图片创作台
        </button>
      </section>

      {productAssets.length ? (
        <section className="canvasCard" data-canvas-card="visual">
          <span>产品/参考图</span>
          <strong>{productAssets.length} 张</strong>
          <div className="canvasImageGrid withImages">
            {productAssets.slice(0, 4).map((asset, index) => (
              <div key={asset.id}>
                <img alt={asset.name} src={`/api/assets/file/${asset.id}`} />
                <b>{index + 1}</b>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="canvasCard" data-canvas-card="publish">
        <span>发布计划</span>
        <strong>{publishPlan?.status || "未准备"}</strong>
        <p>{publishPlan?.scheduleAt ? `定时：${publishPlan.scheduleAt}` : "默认先进入确认，不会误发。"}</p>
        {publishPlan ? (
          <p>
            可见范围：{publishPlan.visibility}；图片 {publishPlan.images?.length ?? 0} 张；来源：{publishPlan.requestedBy ?? "-"}
          </p>
        ) : null}
        <button className="primaryButton fullWidth" disabled={!draft} onClick={onOpenPublish} type="button">
          发布装配台
        </button>
      </section>
    </aside>
  );
}
