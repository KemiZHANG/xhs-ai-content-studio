import type { ChatMessage } from "@/app/types";

export const DEFAULT_STUDIO_CHAT_WINDOW_SIZE = 6;

export function selectStudioChatWindow(
  messages: ChatMessage[],
  limit = DEFAULT_STUDIO_CHAT_WINDOW_SIZE
): ChatMessage[] {
  if (!Number.isFinite(limit) || limit <= 0) return [];
  return messages.slice(-Math.floor(limit));
}
