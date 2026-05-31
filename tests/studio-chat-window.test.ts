import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/app/types";
import { DEFAULT_STUDIO_CHAT_WINDOW_SIZE, selectStudioChatWindow } from "@/app/components/studio-chat-window";

function message(id: string): ChatMessage {
  return {
    content: id,
    createdAt: "2026-05-31T00:00:00.000Z",
    id,
    role: "user"
  };
}

describe("selectStudioChatWindow", () => {
  it("keeps the Post Studio agent conversation bounded to the latest messages", () => {
    const messages = Array.from({ length: 10 }, (_, index) => message(`m-${index + 1}`));

    expect(selectStudioChatWindow(messages).map((item) => item.id)).toEqual([
      "m-5",
      "m-6",
      "m-7",
      "m-8",
      "m-9",
      "m-10"
    ]);
  });

  it("supports explicit compact limits and ignores invalid limits", () => {
    const messages = Array.from({ length: 4 }, (_, index) => message(`m-${index + 1}`));

    expect(selectStudioChatWindow(messages, 2).map((item) => item.id)).toEqual(["m-3", "m-4"]);
    expect(selectStudioChatWindow(messages, 0)).toEqual([]);
    expect(DEFAULT_STUDIO_CHAT_WINDOW_SIZE).toBe(6);
  });
});
