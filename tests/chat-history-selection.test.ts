import { describe, expect, it } from "vitest";
import { shouldAutoOpenLatestConversation } from "@/app/state/chat-history-selection";
import type { ChatConversation } from "@/app/types";

const conversations: ChatConversation[] = [
  {
    id: "chat-latest",
    title: "latest",
    createdAt: "2026-05-31T10:00:00.000Z",
    updatedAt: "2026-05-31T10:00:00.000Z",
    messages: []
  }
];

describe("chat history selection", () => {
  it("does not reopen old history by default when the workbench starts clean", () => {
    expect(shouldAutoOpenLatestConversation({ activeConversationId: null, conversations })).toBe(false);
  });

  it("can still opt into restoring the latest conversation explicitly", () => {
    expect(
      shouldAutoOpenLatestConversation({
        activeConversationId: null,
        conversations,
        allowHistoryAutoOpen: true
      })
    ).toBe(true);
  });

  it("does not override an active conversation", () => {
    expect(
      shouldAutoOpenLatestConversation({
        activeConversationId: "chat-current",
        conversations,
        allowHistoryAutoOpen: true
      })
    ).toBe(false);
  });
});
