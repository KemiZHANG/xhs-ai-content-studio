"use client";

import { X } from "lucide-react";
import { parseTagsText } from "@/lib/publishing/assembly";
import type { AssetRecord, Health, PendingPublishConfirmation, PublishDraftState, RedactedSettings } from "@/app/types";
import { formatMcpEndpoint } from "@/app/components/xhs-display-utils";
import { StatusLine, StatusPill } from "@/app/components/status-badges";

export function PublishAssemblyPanel({
  assets,
  settings,
  health,
  draft,
  selectedAssetIds,
  visibility,
  scheduleAt,
  status,
  pendingPublish,
  busy,
  onDraftChange,
  onToggleAsset,
  onVisibilityChange,
  onScheduleAtChange,
  onPublishNow,
  onSchedule,
  onConfirmPublish,
  onCancelPublish,
  onGoCopy,
  onGoImage
}: {
  assets: AssetRecord[];
  settings: RedactedSettings;
  health: Health | null;
  draft: PublishDraftState;
  selectedAssetIds: string[];
  visibility: RedactedSettings["defaultVisibility"];
  scheduleAt: string;
  status: string;
  pendingPublish: PendingPublishConfirmation | null;
  busy: boolean;
  onDraftChange: (draft: PublishDraftState) => void;
  onToggleAsset: (id: string) => void;
  onVisibilityChange: (value: RedactedSettings["defaultVisibility"]) => void;
  onScheduleAtChange: (value: string) => void;
  onPublishNow: () => void;
  onSchedule: () => void;
  onConfirmPublish: () => void;
  onCancelPublish: () => void;
  onGoCopy: () => void;
  onGoImage: () => void;
}) {
  const selectedAssets = assets.filter((asset) => selectedAssetIds.includes(asset.id));
  const tagCount = parseTagsText(draft.tagsText).length;
  const ready = Boolean(draft.title.trim() && draft.content.trim() && tagCount && selectedAssets.length);
  const activeAccount = settings.accounts.find((account) => account.id === settings.activeAccountId) ?? settings.accounts[0];
  const accountReady = Boolean(health?.loggedIn);
  const canSubmit = ready && accountReady;

  return (
    <div className="twoColumn wideLeft">
      <section className="panel publishPreviewPanel">
        <div className="panelHeader">
          <div>
            <h2>发布装配台</h2>
            <p>这里是最终发布前的整合页：确认文案、标签、图片、可见范围和发布时间。</p>
          </div>
          <StatusPill ok={ready} label={ready ? "可以发布" : "缺少内容"} />
        </div>

        <div className="publishReadinessGrid">
          <section className="phonePreview">
            <div className="phonePreviewMedia">
              {selectedAssets[0] ? (
                <img alt={selectedAssets[0].name} src={`/api/assets/file/${selectedAssets[0].id}`} />
              ) : (
                <span>选择封面图</span>
              )}
            </div>
            <div className="phonePreviewText">
              <strong>{draft.title || "标题会显示在这里"}</strong>
              <p>{draft.content ? `${draft.content.slice(0, 120)}${draft.content.length > 120 ? "..." : ""}` : "正文预览会在这里显示，发布前先确认读起来像真实笔记。"}</p>
              <div className="tagRow">
                {parseTagsText(draft.tagsText).slice(0, 5).map((tag) => (
                  <em key={tag}>#{tag}</em>
                ))}
              </div>
            </div>
          </section>
          <section className="publishChecklist">
            <h3>发布检查</h3>
            <StatusLine ok={Boolean(draft.title.trim())} label="标题已填写" />
            <StatusLine ok={Boolean(draft.content.trim())} label="正文已填写" />
            <StatusLine ok={Boolean(tagCount)} label={`${tagCount} 个标签`} />
            <StatusLine ok={Boolean(selectedAssets.length)} label={`${selectedAssets.length} 张图片`} />
            <StatusLine ok={visibility === "仅自己可见"} label={`可见范围：${visibility}`} />
            <StatusLine ok={accountReady} label={`发布账号：${activeAccount?.displayName ?? "未配置账号"}`} />
          </section>
        </div>

        <section className={accountReady ? "publishAccountGuard ok" : "publishAccountGuard warn"}>
          <div>
            <strong>将发布到：{activeAccount?.displayName ?? "未配置账号"}</strong>
            <span>{health?.activeAccount?.loginName ? `真实登录名：${health.activeAccount.loginName}` : "真实登录名：检测后显示"}</span>
            <span>{activeAccount?.mcpUrl ?? settings.mcpUrl}</span>
          </div>
          <StatusPill ok={accountReady} label={accountReady ? "账号已登录" : "请先检测/登录"} />
        </section>

        <div className="publishPreview">
          <label>
            <span>标题</span>
            <input value={draft.title} onChange={(event) => onDraftChange({ ...draft, title: event.target.value })} />
          </label>
          <label>
            <span>正文</span>
            <textarea value={draft.content} onChange={(event) => onDraftChange({ ...draft, content: event.target.value })} />
          </label>
          <label>
            <span>标签</span>
            <input
              placeholder="#广州咖啡 #探店"
              value={draft.tagsText}
              onChange={(event) => onDraftChange({ ...draft, tagsText: event.target.value })}
            />
            <small className="fieldHint">当前识别 {tagCount} 个标签。</small>
          </label>
          <label>
            <span>图片提示词记录</span>
            <textarea
              value={draft.imagePrompt}
              onChange={(event) => onDraftChange({ ...draft, imagePrompt: event.target.value })}
            />
          </label>
        </div>

        <section className="resultBlock">
          <div className="blockTitleRow">
            <div>
              <h3>最终发布图片</h3>
              <p>选中的图片会随这篇笔记一起发送。图片创作台生成的新图会自动加入这里，也可以手动勾选素材库里的图片。</p>
            </div>
            <button className="secondaryButton" onClick={onGoImage} type="button">
              去图片创作台
            </button>
          </div>
          {selectedAssets.length ? (
            <div className="attachedAssetStrip large">
              {selectedAssets.map((asset) => (
                <span key={asset.id}>
                  <img alt={asset.name} src={`/api/assets/file/${asset.id}`} />
                  {asset.name}
                  <button type="button" onClick={() => onToggleAsset(asset.id)} aria-label={`移除 ${asset.name}`}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">还没有选择发布图片。先去图片创作台生成，或从右侧素材中选择。</p>
          )}
        </section>

        <div className="publishControls">
          <label>
            <span>可见范围</span>
            <select value={visibility} onChange={(event) => onVisibilityChange(event.target.value as RedactedSettings["defaultVisibility"])}>
              <option>仅自己可见</option>
              <option>公开可见</option>
              <option>仅互关好友可见</option>
            </select>
          </label>
          <label>
            <span>定时发布时间</span>
            <input type="datetime-local" value={scheduleAt} onChange={(event) => onScheduleAtChange(event.target.value)} />
          </label>
        </div>

        {status ? <p className="notice inlineNotice">{status}</p> : null}

        {pendingPublish ? (
          <section className="resultBlock publishConfirmBlock">
            <div className="blockTitleRow">
              <div>
                <h3>{pendingPublish.mode === "schedule" ? "定时发布确认" : "立即发布确认"}</h3>
                <p>
                  系统已生成发布确认单。确认前请再核对标题、正文、标签、图片和可见范围；确认后才会调用小红书 MCP。
                </p>
              </div>
              <StatusPill ok label="等待确认" />
            </div>
            <div className="publishConfirmGrid">
              <span>
                <small>可见范围</small>
                <strong>{pendingPublish.payload.visibility}</strong>
              </span>
              <span>
                <small>图片</small>
                <strong>{pendingPublish.payload.assetIds.length} 张</strong>
              </span>
              <span>
                <small>标签</small>
                <strong>{pendingPublish.payload.tags.length} 个</strong>
              </span>
              <span>
                <small>发布时间</small>
                <strong>{pendingPublish.payload.scheduleAt || "立即"}</strong>
              </span>
              <span>
                <small>发布账号</small>
                <strong>{pendingPublish.accountDisplayName}</strong>
              </span>
              <span>
                <small>登录名</small>
                <strong>{pendingPublish.loginName || "检测后显示"}</strong>
              </span>
            </div>
            <p className="muted">
              这张确认单绑定账号 {pendingPublish.accountDisplayName}（{formatMcpEndpoint(pendingPublish.mcpUrl)}）。如果切换账号，需要重新生成确认单。
            </p>
            <div className="actionRow">
              <button className="secondaryButton" disabled={busy} onClick={onCancelPublish} type="button">
                取消确认
              </button>
              <button className="primaryButton dangerAction" disabled={busy || !accountReady} onClick={onConfirmPublish} type="button">
                {busy ? "提交中" : pendingPublish.mode === "schedule" ? "确认定时发布" : "确认立即发布"}
              </button>
            </div>
          </section>
        ) : null}

        <div className="actionRow publishActions">
          <button className="secondaryButton" onClick={onGoCopy} type="button">
            回文案创作台
          </button>
          <button className="primaryButton" disabled={busy || !canSubmit} onClick={onPublishNow} type="button">
            {busy ? "发布中" : "立即发布"}
          </button>
          <button className="secondaryButton" disabled={busy || !canSubmit || !scheduleAt} onClick={onSchedule} type="button">
            {busy ? "提交中" : "定时发布"}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader compact">
          <h2>可选图片素材</h2>
        </div>
        <div className="assetGrid compactAssets">
          {assets.length ? (
            assets.map((asset) => (
              <article className={selectedAssetIds.includes(asset.id) ? "assetCard selected" : "assetCard"} key={asset.id}>
                <button className="assetImageButton" onClick={() => onToggleAsset(asset.id)} type="button">
                  <img alt={asset.name} src={`/api/assets/file/${asset.id}`} />
                </button>
                <div>
                  <strong>{asset.name}</strong>
                  <span>{asset.kind === "generated" ? "生成图，可发布" : "产品/参考图"}</span>
                </div>
              </article>
            ))
          ) : (
            <p className="muted">还没有素材。请去图片创作台上传或生成图片。</p>
          )}
        </div>
      </section>
    </div>
  );
}
