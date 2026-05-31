import type { ChatConversation } from "@/app/types";

export function shouldAutoOpenLatestConversation({
  activeConversationId,
  conversations,
  allowHistoryAutoOpen = false
}: {
  activeConversationId: string | null;
  conversations: ChatConversation[];
  allowHistoryAutoOpen?: boolean;
}): boolean {
  if (activeConversationId) return false;
  if (!allowHistoryAutoOpen) return false;
  return Boolean(conversations[0]);
}
