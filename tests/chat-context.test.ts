import { describe, expect, it } from "vitest";
import {
  canShowCurrentDraftInConversation,
  getConversationContextWarning,
  getConversationProjectContext,
  getConversationSubmitGuard
} from "@/app/components/chat-context";
import type { ChatMessage } from "@/app/types";

describe("chat conversation project context", () => {
  it("reads the latest PostProject metadata from assistant messages", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "old", postProjectId: "post-old", postProjectStage: "evidence_ready" },
      { role: "assistant", content: "new", postProjectId: "post-new", postProjectStage: "copy_ready" },
    ];

    expect(getConversationProjectContext(messages)).toEqual({
      postProjectId: "post-new",
      postProjectStage: "copy_ready"
    });
  });

  it("shows the current draft only when the conversation belongs to the current project", () => {
    expect(canShowCurrentDraftInConversation({
      hasCurrentDraft: true,
      isLatestConversation: false,
      conversationPostProjectId: "post-1",
      currentPostProjectId: "post-1"
    })).toBe(true);

    expect(canShowCurrentDraftInConversation({
      hasCurrentDraft: true,
      isLatestConversation: false,
      conversationPostProjectId: "post-old",
      currentPostProjectId: "post-new"
    })).toBe(false);
  });

  it("allows unbound latest conversations but hides unbound old history", () => {
    expect(canShowCurrentDraftInConversation({
      hasCurrentDraft: true,
      isLatestConversation: true
    })).toBe(true);
    expect(canShowCurrentDraftInConversation({
      hasCurrentDraft: true,
      isLatestConversation: false
    })).toBe(false);
  });

  it("explains why a historical conversation cannot edit the current project", () => {
    expect(getConversationContextWarning({
      isLatestConversation: false,
      conversationPostProjectId: "post-old",
      currentPostProjectId: "post-new"
    })).toContain("另一个 PostProject");

    expect(getConversationContextWarning({
      isLatestConversation: false
    })).toContain("旧版历史对话");
  });

  it("blocks submitting from historical conversations that do not own the current project", () => {
    expect(getConversationSubmitGuard({
      isLatestConversation: false,
      conversationPostProjectId: "post-old",
      currentPostProjectId: "post-new"
    })).toMatchObject({
      blocked: true
    });

    expect(getConversationSubmitGuard({
      isLatestConversation: false,
      conversationPostProjectId: "post-new",
      currentPostProjectId: "post-new"
    })).toEqual({ blocked: false });
  });
});
