"use client";

import type { PublishSafetyBoundaryModel } from "@/app/components/publish-safety-boundary";
import type { PendingPublishConfirmation, PostProject, PublishDraftState, RedactedSettings } from "@/app/types";

export function PostStudioPublishReadinessPanel({
  publishVisibility,
  publishScheduleAt,
  publishReady,
  publishDraft,
  selectedImageCount,
  hasVisualDirection,
  citationTraceReady,
  accountReady,
  quality,
  qualityGateFresh,
  pendingPublish,
  activeLoginName,
  publishSafetyBoundary,
  hasExistingVisualDirection,
  busy,
  onVisibilityChange,
  onScheduleAtChange,
  onQuickAction
}: {
  publishVisibility: RedactedSettings["defaultVisibility"];
  publishScheduleAt: string;
  publishReady: boolean;
  publishDraft: PublishDraftState;
  selectedImageCount: number;
  hasVisualDirection: boolean;
  citationTraceReady: boolean;
  accountReady: boolean;
  quality?: PostProject["qualityCheck"];
  qualityGateFresh: boolean;
  pendingPublish: PendingPublishConfirmation | null;
  activeLoginName?: string;
  publishSafetyBoundary: PublishSafetyBoundaryModel;
  hasExistingVisualDirection: boolean;
  busy: boolean;
  onVisibilityChange: (value: RedactedSettings["defaultVisibility"]) => void;
  onScheduleAtChange: (value: string) => void;
  onQuickAction: (action: string) => void;
}) {
  return (
    <>
      <div className="publishInlineControls">
        <label>
          <span>可见范围</span>
          <select value={publishVisibility} onChange={(event) => onVisibilityChange(event.target.value as RedactedSettings["defaultVisibility"])}>
            <option>仅自己可见</option>
            <option>公开可见</option>
            <option>仅互关好友可见</option>
          </select>
        </label>
        <label>
          <span>定时时间</span>
          <input type="datetime-local" value={publishScheduleAt} onChange={(event) => onScheduleAtChange(event.target.value)} />
        </label>
      </div>
      <div className={publishReady ? "publishConfirmMini ready" : "publishConfirmMini warn"}>
        <strong>{publishReady ? "可以生成发布确认单" : "发布前还需要处理"}</strong>
        <p>
          {publishReady
            ? "下一步会进入人工确认页，确认账号、可见范围、图片版本和时间后才会调用小红书发布。"
            : buildPublishReadinessHint({
                title: publishDraft.title,
                content: publishDraft.content,
                tagsText: publishDraft.tagsText,
                imageCount: selectedImageCount,
                hasVisualDirection,
                citationTraceReady,
                accountReady,
                quality,
                qualityGateFresh
              })}
        </p>
        <span>确认单：{pendingPublish ? `${pendingPublish.mode === "schedule" ? "定时" : "立即"} · 待人工确认` : "未生成"}</span>
        {activeLoginName ? <span>登录名：{activeLoginName}</span> : null}
        <div className={`publishSafetyBoundary ${publishSafetyBoundary.state}`} aria-label="发布安全边界">
          <strong>{publishSafetyBoundary.headline}</strong>
          <p>{publishSafetyBoundary.detail}</p>
          <div>
            {publishSafetyBoundary.checkpoints.map((checkpoint) => (
              <em key={checkpoint}>{checkpoint}</em>
            ))}
          </div>
        </div>
        {!publishReady ? (
          <div className="publishInlineFixes" aria-label="发布前快速处理">
            {!hasVisualDirection ? (
              <button disabled={busy} type="button" onClick={() => onQuickAction(hasExistingVisualDirection ? "confirm_visual_direction" : "plan_visuals")}>
                {hasExistingVisualDirection ? "确认图片方向" : "规划图片方向"}
              </button>
            ) : null}
            {(!quality || quality?.canPublish === false || !qualityGateFresh) ? (
              <button disabled={busy} type="button" onClick={() => onQuickAction("run_quality_gate")}>
                运行质量检查
              </button>
            ) : null}
            {!selectedImageCount ? (
              <button disabled={busy} type="button" onClick={() => onQuickAction("select_images")}>
                选择发布图片
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

function buildPublishReadinessHint({
  title,
  content,
  tagsText,
  imageCount,
  hasVisualDirection,
  citationTraceReady,
  accountReady,
  quality,
  qualityGateFresh
}: {
  title: string;
  content: string;
  tagsText: string;
  imageCount: number;
  hasVisualDirection: boolean;
  citationTraceReady: boolean;
  accountReady: boolean;
  quality?: PostProject["qualityCheck"];
  qualityGateFresh: boolean;
}): string {
  const missing: string[] = [];
  if (!title.trim()) missing.push("标题");
  if (!content.trim()) missing.push("正文");
  if (!tagsText.trim()) missing.push("标签");
  if (!imageCount) missing.push("发布图片");
  if (!hasVisualDirection) missing.push("图片方向 / Prompt");
  if (!citationTraceReady) missing.push("字段级证据引用");
  if (!accountReady) missing.push("小红书登录账号");
  if (!quality) {
    missing.push("Quality Gate 未运行");
  }
  if (quality?.canPublish === false) {
    const issueText = quality.issues.slice(0, 2).join("；") || "需要处理质量检查问题";
    missing.push(`Quality Gate：${issueText}`);
  }
  if (quality?.canPublish === true && !qualityGateFresh) {
    missing.push("版本状态：画布改动后需要重新运行 Quality Gate");
  }
  return missing.length ? `还缺：${missing.join("、")}。` : "请先刷新质量检查，再进入人工发布确认。";
}
