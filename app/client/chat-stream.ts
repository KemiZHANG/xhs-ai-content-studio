"use client";

import { clientApi, getClientActionToken } from "@/app/client/api";
import type { ChatConversation, ChatMessage, DraftRecord, JobRecord, PostProject, WorkflowResult } from "@/app/types";

export type ChatTurnResponse = {
  answer: string;
  cards?: ChatMessage["cards"];
  quickActions?: ChatMessage["quickActions"];
  toolTrace?: ChatMessage["toolTrace"];
  questions?: string[];
  intent?: string;
  intentConfidence?: number;
  needsUserInput?: boolean;
  stage?: PostProject["currentStage"];
  workflowResult?: WorkflowResult;
  currentDraft?: DraftRecord;
  job?: JobRecord;
  conversation?: ChatConversation;
};

export type ChatStreamStatus = {
  stage?: string;
  message?: string;
  intent?: string;
  intentConfidence?: number;
  toolCount?: number;
  cardCount?: number;
};

export async function requestChatTurn({
  content,
  conversationId,
  assetIds,
  onStreamStatus
}: {
  content: string;
  conversationId: string | null;
  assetIds: string[];
  onStreamStatus: (status: ChatStreamStatus) => void;
}): Promise<ChatTurnResponse> {
  const body = JSON.stringify({ message: content, conversationId, assetIds });
  try {
    const streamed = await requestChatTurnStream(body, onStreamStatus);
    if (streamed) return streamed;
  } catch {
    onStreamStatus({
      stage: "fallback",
      message: "流式连接不可用，已自动切回普通对话请求。"
    });
  }

  return clientApi<ChatTurnResponse>("/api/chat", {
    method: "POST",
    body
  });
}

export async function requestChatTurnStream(
  body: string,
  onStreamStatus: (status: ChatStreamStatus) => void
): Promise<ChatTurnResponse | null> {
  const headers = new Headers({
    Accept: "text/event-stream",
    "Content-Type": "application/json"
  });
  const token = getClientActionToken();
  if (token) {
    headers.set("X-XHS-Action-Token", token);
  }

  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers,
    body
  });
  if (!response.ok || !response.body) {
    return null;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ChatTurnResponse | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const eventText of events) {
        const event = parseSseEvent(eventText);
        if (!event) continue;
        if (event.event === "status") {
          onStreamStatus(event.data as ChatStreamStatus);
        } else if (event.event === "result") {
          result = event.data as ChatTurnResponse;
        } else if (event.event === "error") {
          const errorData = event.data as { error?: string };
          throw new Error(errorData.error || "流式对话执行失败");
        }
      }
    }
    if (done) break;
  }

  if (buffer.trim()) {
    const event = parseSseEvent(buffer);
    if (event?.event === "result") {
      result = event.data as ChatTurnResponse;
    }
  }

  return result;
}

export function parseSseEvent(text: string): { event: string; data: unknown } | null {
  const lines = text.split(/\r?\n/);
  const event = lines.find((line) => line.startsWith("event:"))?.replace(/^event:\s*/, "").trim();
  const dataLines = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace(/^data:\s*/, ""));
  if (!event || !dataLines.length) return null;
  try {
    return {
      event,
      data: JSON.parse(dataLines.join("\n"))
    };
  } catch {
    return null;
  }
}

export function buildStreamStatusDetail(status: ChatStreamStatus): string {
  const parts = [
    status.stage ? `阶段 ${status.stage}` : "",
    status.intent ? `意图 ${status.intent}` : "",
    status.intentConfidence !== undefined ? `置信度 ${Math.round(status.intentConfidence * 100)}%` : "",
    status.toolCount !== undefined ? `工具 ${status.toolCount}` : "",
    status.cardCount !== undefined ? `卡片 ${status.cardCount}` : ""
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : status.message ?? "Agent 正在执行。";
}

export function isPostStage(value: string): value is PostProject["currentStage"] {
  return [
    "empty",
    "briefing",
    "researching",
    "evidence_ready",
    "brief_ready",
    "copy_drafting",
    "copy_ready",
    "visual_planning",
    "image_prompt_ready",
    "image_generating",
    "image_ready",
    "assembling",
    "reviewing",
    "scheduled",
    "published",
    "failed"
  ].includes(value);
}
