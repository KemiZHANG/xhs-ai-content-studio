"use client";

import type { PublishSafetyBoundaryModel } from "@/app/components/publish-safety-boundary";
import type { PendingPublishConfirmation, PostProject, PublishDraftState, RedactedSettings } from "@/app/types";
import { publishVisibilityValues } from "@/app/config/default-settings";

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
  const fixChecklist = buildPublishFixChecklist({
    publishDraft,
    selectedImageCount,
    hasVisualDirection,
    citationTraceReady,
    accountReady,
    quality,
    qualityGateFresh,
    publishScheduleAt,
    hasExistingVisualDirection
  });
  const scheduleInputValue = toDatetimeLocalInputValue(publishScheduleAt);

  return (
    <>
      <div className="publishInlineControls">
        <label>
          <span>可见范围</span>
          <select value={publishVisibility} onChange={(event) => onVisibilityChange(event.target.value as RedactedSettings["defaultVisibility"])}>
            {publishVisibilityValues.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>定时时间</span>
          <input
            type="datetime-local"
            value={scheduleInputValue}
            onChange={(event) => onScheduleAtChange(normalizePublishScheduleInput(event.target.value))}
          />
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
                qualityGateFresh,
                publishScheduleAt
              })}
        </p>
        {!publishReady && fixChecklist.length ? (
          <div className="publishFixChecklist" aria-label="发布前阻塞清单">
            {fixChecklist.slice(0, 5).map((item) => (
              <span className={item.action ? "actionable" : ""} key={item.label}>
                <em>{item.label}</em>
                {item.action ? (
                  <button disabled={busy} type="button" onClick={() => onQuickAction(item.action!)}>
                    {item.actionLabel}
                  </button>
                ) : (
                  <small>{item.detail}</small>
                )}
              </span>
            ))}
          </div>
        ) : null}
        <span>确认单: {pendingPublish ? `${pendingPublish.mode === "schedule" ? "定时" : "立即"} · 待人工确认` : "未生成"}</span>
        {activeLoginName ? <span>登录名: {activeLoginName}</span> : null}
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

type PublishFixChecklistItem = {
  label: string;
  detail: string;
  action?: string;
  actionLabel?: string;
};

function buildPublishFixChecklist({
  publishDraft,
  selectedImageCount,
  hasVisualDirection,
  citationTraceReady,
  accountReady,
  quality,
  qualityGateFresh,
  publishScheduleAt,
  hasExistingVisualDirection
}: {
  publishDraft: PublishDraftState;
  selectedImageCount: number;
  hasVisualDirection: boolean;
  citationTraceReady: boolean;
  accountReady: boolean;
  quality?: PostProject["qualityCheck"];
  qualityGateFresh: boolean;
  publishScheduleAt: string;
  hasExistingVisualDirection: boolean;
}): PublishFixChecklistItem[] {
  const items: PublishFixChecklistItem[] = [];
  if (!publishDraft.title.trim() || !publishDraft.content.trim() || !publishDraft.tagsText.trim()) {
    items.push({
      label: "补齐标题/正文/标签",
      detail: "最终发布稿需要完整文案",
      action: "generate_copy",
      actionLabel: "补文案"
    });
  }
  if (!hasVisualDirection) {
    items.push({
      label: hasExistingVisualDirection ? "确认图片方向" : "规划图片方向",
      detail: "图片方向会影响生图和发布风险",
      action: hasExistingVisualDirection ? "confirm_visual_direction" : "plan_visuals",
      actionLabel: hasExistingVisualDirection ? "确认方向" : "去规划"
    });
  }
  if (!selectedImageCount) {
    items.push({
      label: "选择发布图片",
      detail: "至少选择一张图片",
      action: "select_images",
      actionLabel: "选图"
    });
  }
  if (!citationTraceReady) {
    items.push({
      label: "补证据引用",
      detail: "标题、正文、标签、图片方向需要可追溯",
      action: "create_creative_brief",
      actionLabel: "补证据"
    });
  }
  if (!quality || quality.canPublish === false || !qualityGateFresh) {
    items.push({
      label: quality?.canPublish === true && !qualityGateFresh ? "刷新 Quality Gate" : "运行 Quality Gate",
      detail: "检查夸张标题、广告感、图文一致和合规风险",
      action: "run_quality_gate",
      actionLabel: "检查"
    });
  }
  if (!accountReady) {
    items.push({
      label: "确认小红书账号",
      detail: "用上方账号卡检测当前 MCP 登录状态"
    });
  }
  const scheduleBlocker = getPublishScheduleBlocker(publishScheduleAt);
  if (scheduleBlocker) {
    items.push({
      label: "修正定时时间",
      detail: scheduleBlocker,
      action: "schedule_publish",
      actionLabel: "改时间"
    });
  }
  return items;
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
  qualityGateFresh,
  publishScheduleAt
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
  publishScheduleAt: string;
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
    const issueText = quality.issues.slice(0, 2).join("，") || "需要处理质量检查问题";
    missing.push(`Quality Gate: ${issueText}`);
  }
  if (quality?.canPublish === true && !qualityGateFresh) {
    missing.push("版本状态: 画布改动后需要重新运行 Quality Gate");
  }
  const scheduleBlocker = getPublishScheduleBlocker(publishScheduleAt);
  if (scheduleBlocker) missing.push(`定时时间: ${scheduleBlocker}`);
  return missing.length ? `还缺: ${missing.join("、")}。` : "请先刷新质量检查，再进入人工发布确认。";
}

export function isPublishScheduleReady(scheduleAt: string): boolean {
  return !getPublishScheduleBlocker(scheduleAt);
}

export function getPublishScheduleBlocker(scheduleAt: string): string | null {
  const trimmed = scheduleAt.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return "时间格式无效";
  if (!hasExplicitScheduleTimezone(trimmed)) return "定时时间必须包含明确时区";
  if (parsed <= Date.now()) return "定时时间必须晚于当前时间";
  return null;
}

export function normalizePublishScheduleInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || hasExplicitScheduleTimezone(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return `${formatLocalDateTime(parsed)}${formatLocalTimezoneOffset(parsed)}`;
}

export function toDatetimeLocalInputValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || !hasExplicitScheduleTimezone(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return formatLocalDateTime(parsed).slice(0, 16);
}

function hasExplicitScheduleTimezone(value: string): boolean {
  return /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(value.trim());
}

function formatLocalDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hour = padDatePart(date.getHours());
  const minute = padDatePart(date.getMinutes());
  const second = padDatePart(date.getSeconds());
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function formatLocalTimezoneOffset(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = padDatePart(Math.floor(absolute / 60));
  const minutes = padDatePart(absolute % 60);
  return `${sign}${hours}:${minutes}`;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}
