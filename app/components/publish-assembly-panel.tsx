"use client";

import { X } from "lucide-react";
import { parseTagsText } from "@/lib/publishing/assembly";
import type { AssetRecord, Health, PendingPublishConfirmation, PostProject, PublishDraftState, RedactedSettings } from "@/app/types";
import { activeAccountReadinessHint, isHealthForActiveAccount } from "@/app/components/account-readiness";
import { buildPublishConfirmationReadiness } from "@/app/components/publish-confirmation";
import { formatMcpEndpoint } from "@/app/components/xhs-display-utils";
import { StatusLine, StatusPill } from "@/app/components/status-badges";
import { getPostVersionDiffReport, getPostVersionStatus } from "@/lib/post-project/versioning";

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
  postProject,
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
  postProject: PostProject | null;
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
  const accountReady = isHealthForActiveAccount(health, settings);
  const accountReadyHint = activeAccountReadinessHint(health, settings);
  const quality = postProject?.qualityCheck;
  const finalPost = postProject?.finalPost;
  const postPlan = postProject?.publishPlan;
  const versionStatus = postProject ? getPostVersionStatus(postProject) : null;
  const versionDiff = postProject ? getPostVersionDiffReport(postProject) : null;
  const confirmationReadiness = buildPublishConfirmationReadiness({
    contentReady: ready,
    accountReady,
    qualityCanPublish: quality?.canPublish === true,
    qualityGateFresh: versionStatus?.qualityGateFresh === true,
    hasScheduleAt: Boolean(scheduleAt),
    busy
  });

  return (
    <div className="twoColumn wideLeft">
      <section className="panel publishPreviewPanel">
        <div className="panelHeader">
          <div>
            <h2>发布装配台</h2>
            <p>这里是最终发布前的确认页：核对文案、标签、图片、可见范围、账号和发布时间。</p>
          </div>
          <StatusPill ok={ready} label={ready ? "内容完整" : "缺少内容"} />
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
              <p>{draft.content ? `${draft.content.slice(0, 120)}${draft.content.length > 120 ? "..." : ""}` : "正文预览会显示在这里。发布前请确认读起来像真实笔记，而不是硬广。"}</p>
              <div className="tagRow">
                {parseTagsText(draft.tagsText).slice(0, 5).map((tag) => (
                  <em key={tag}>#{tag}</em>
                ))}
              </div>
            </div>
            {quality?.originalityReview ? (
              <p className="muted">原创边界：{quality.originalityReview.summary}</p>
            ) : null}
          </section>
          <section className="publishChecklist">
            <h3>发布检查</h3>
            <StatusLine ok={Boolean(draft.title.trim())} label="标题已填写" />
            <StatusLine ok={Boolean(draft.content.trim())} label="正文已填写" />
            <StatusLine ok={Boolean(tagCount)} label={`${tagCount} 个标签`} />
            <StatusLine ok={Boolean(selectedAssets.length)} label={`${selectedAssets.length} 张图片`} />
            <StatusLine ok={visibility === "仅自己可见"} label={`可见范围：${visibility}`} />
            <StatusLine ok={accountReady} label={`发布账号：${activeAccount?.displayName ?? "未配置账号"} · ${accountReadyHint}`} />
            <StatusLine ok={quality?.canPublish === true} label={quality ? `Quality Gate：${quality.canPublish ? "通过" : "需处理"}` : "Quality Gate：待检查"} />
            <StatusLine ok={versionStatus?.qualityGateFresh === true} label={versionStatus ? `版本状态：${versionStatus.qualityGateFresh ? "已锁定" : "需复核"}` : "版本状态：待组装"} />
          </section>
        </div>

        {finalPost || quality || postPlan ? (
          <section className="publishProjectState">
            <div>
              <strong>PostProject 发布状态</strong>
              <p>发布确认会绑定当前最终帖子、图片方向 / Prompt、图片版本、账号、可见范围和定时时间。</p>
            </div>
            <div className="publishStateGrid">
              <span>
                <small>最终标题</small>
                <strong>{finalPost?.title || draft.title || "待确认"}</strong>
              </span>
              <span>
                <small>最终图片</small>
                <strong>{finalPost?.imageIds.length ?? selectedAssets.length} 张</strong>
              </span>
              <span>
                <small>Quality</small>
                <strong>{quality ? (quality.canPublish ? "通过" : "阻止") : "待检查"}</strong>
              </span>
              <span>
                <small>确认单</small>
                <strong>{postPlan?.status ? labelForPublishStatus(postPlan.status) : "未生成"}</strong>
              </span>
              <span>
                <small>证据快照</small>
                <strong>{postPlan?.versionSnapshot?.finalPostEvidenceIds?.length ?? finalPost?.basedOnEvidenceIds?.length ?? 0} 条</strong>
              </span>
            </div>
            <div className="publishSafetyGrid" aria-label="发布安全摘要">
              <span className={versionStatus?.qualityGateFresh ? "ok" : "warn"}>
                <small>版本锁定</small>
                <strong>{versionStatus?.qualityGateFresh ? "一致" : "需重新检查"}</strong>
                <em>{versionDiff?.hasChanges ? versionDiff.summary : versionStatus?.summary ?? "等待最终帖子快照"}</em>
              </span>
              <span className={quality?.evidenceReview?.missingEvidenceIds.length ? "warn" : "ok"}>
                <small>证据追溯</small>
                <strong>{quality?.evidenceReview ? `${quality.evidenceReview.referencedEvidenceIds.length} 条引用` : "待检查"}</strong>
                <em>{quality?.evidenceReview?.summary ?? "运行 Quality Gate 后展示"}</em>
              </span>
              <span className={quality?.evidenceAlignment?.isAligned === false ? "warn" : "ok"}>
                <small>图文一致</small>
                <strong>{quality?.evidenceAlignment?.isAligned === false ? "不一致" : quality?.evidenceAlignment ? "一致" : "待检查"}</strong>
                <em>{quality?.evidenceAlignment?.summary ?? "图片方向和文案需要共享证据"}</em>
              </span>
              <span className={quality?.originalityReview?.isSafe === false ? "warn" : "ok"}>
                <small>原创边界</small>
                <strong>{quality?.originalityReview?.isSafe === false ? "有风险" : quality?.originalityReview ? "安全" : "待检查"}</strong>
                <em>{quality?.originalityReview?.summary ?? "避免复制爆款库原文、图片和具体表达"}</em>
              </span>
            </div>
            {quality?.issues.length ? (
              <ul className="publishIssueList">
                {quality.issues.slice(0, 4).map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            ) : null}
            {quality?.evidenceReview ? (
              <p className="muted">证据覆盖：{quality.evidenceReview.summary}</p>
            ) : null}
          </section>
        ) : null}

        <section className={accountReady ? "publishAccountGuard ok" : "publishAccountGuard warn"}>
          <div>
            <strong>将发布到：{activeAccount?.displayName ?? "未配置账号"}</strong>
            <span>{health?.activeAccount?.loginName ? `真实登录名：${health.activeAccount.loginName}` : "真实登录名：检测后显示"}</span>
            <span>{accountReadyHint}</span>
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
              回到 Post Studio 图片面板
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
            <p className="muted">还没有选择发布图片。先回到 Post Studio 图片面板生成，或从右侧素材中选择。</p>
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

        <section className={confirmationReadiness.blockingReasons.length ? "publishConfirmHint warn" : "publishConfirmHint ok"}>
          <strong>发布动作会先生成确认单</strong>
          <p>{confirmationReadiness.helperText}</p>
          {confirmationReadiness.blockingReasons.length ? (
            <ul>
              {confirmationReadiness.blockingReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </section>

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
            {postPlan?.confirmationChecklist?.length ? (
              <ul className="publishIssueList">
                {postPlan.confirmationChecklist.filter((item) => item.required).map((item) => (
                  <li key={item.id}>{item.confirmed ? "已确认" : "待确认"}：{item.label} · {item.detail}</li>
                ))}
              </ul>
            ) : null}
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
          <button className="primaryButton" disabled={!confirmationReadiness.canCreateNowConfirmation} onClick={onPublishNow} type="button">
            {confirmationReadiness.nowButtonLabel}
          </button>
          <button className="secondaryButton" disabled={!confirmationReadiness.canCreateScheduleConfirmation} onClick={onSchedule} type="button">
            {confirmationReadiness.scheduleButtonLabel}
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
            <p className="muted">还没有素材。请回到 Post Studio 上传或生成图片。</p>
          )}
        </div>
      </section>
    </div>
  );
}

function labelForPublishStatus(status: string): string {
  const labels: Record<string, string> = {
    draft: "草稿",
    blocked: "已阻止",
    awaiting_approval: "待人工确认",
    approved: "已确认",
    publishing: "发布中",
    published: "已发布",
    scheduled: "已定时",
    failed: "失败",
    cancelled: "已取消"
  };
  return labels[status] ?? status;
}
