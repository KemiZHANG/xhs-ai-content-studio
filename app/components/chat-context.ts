import type { ChatMessage } from "@/app/types";

export type ConversationProjectContext = {
  postProjectId?: string;
  postProjectStage?: string;
};

export function getConversationProjectContext(messages: ChatMessage[]): ConversationProjectContext {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.postProjectId) {
      return {
        postProjectId: message.postProjectId,
        postProjectStage: message.postProjectStage
      };
    }
  }

  return {};
}

export function canShowCurrentDraftInConversation({
  hasCurrentDraft,
  isLatestConversation,
  conversationPostProjectId,
  currentPostProjectId
}: {
  hasCurrentDraft: boolean;
  isLatestConversation: boolean;
  conversationPostProjectId?: string;
  currentPostProjectId?: string;
}): boolean {
  if (!hasCurrentDraft) {
    return false;
  }

  if (conversationPostProjectId && currentPostProjectId) {
    return conversationPostProjectId === currentPostProjectId;
  }

  return isLatestConversation;
}

export function getConversationContextWarning({
  isLatestConversation,
  conversationPostProjectId,
  currentPostProjectId
}: {
  isLatestConversation: boolean;
  conversationPostProjectId?: string;
  currentPostProjectId?: string;
}): string | null {
  if (conversationPostProjectId && currentPostProjectId && conversationPostProjectId !== currentPostProjectId) {
    return "当前打开的是另一个 PostProject 的历史对话。为了避免误改，当前项目草稿已隐藏；如需继续使用这段研究，请先从任务历史恢复对应项目。";
  }

  if (!isLatestConversation && !conversationPostProjectId) {
    return "当前打开的是旧版历史对话，未绑定 PostProject。你可以回到最新对话继续当前项目，或从任务历史显式恢复研究结果。";
  }

  return null;
}

export function getConversationSubmitGuard({
  isLatestConversation,
  conversationPostProjectId,
  currentPostProjectId
}: {
  isLatestConversation: boolean;
  conversationPostProjectId?: string;
  currentPostProjectId?: string;
}): { blocked: boolean; reason?: string } {
  const warning = getConversationContextWarning({
    isLatestConversation,
    conversationPostProjectId,
    currentPostProjectId
  });

  if (!warning) {
    return { blocked: false };
  }

  return {
    blocked: true,
    reason: "这段历史对话当前为只读，避免把旧项目内容误写入正在编辑的 PostProject。请新建对话继续，或从任务/项目历史恢复对应项目。"
  };
}
