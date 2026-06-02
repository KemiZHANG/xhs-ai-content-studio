import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatPanel } from "@/app/components/chat-workbench";

describe("chat workbench reset affordance", () => {
  it("makes it clear that starting a new conversation clears the active PostProject", () => {
    const html = renderToStaticMarkup(createElement(ChatPanel, {
      assets: [],
      attachedAssetIds: [],
      conversations: [],
      activeConversationId: null,
      messages: [],
      input: "",
      busy: false,
      currentDraft: null,
      workspace: null,
      postProject: null,
      creatorMemory: null,
      jobs: [],
      onInput: () => undefined,
      onSubmit: () => undefined,
      onAttachFiles: () => undefined,
      onToggleAsset: () => undefined,
      onRemoveAsset: () => undefined,
      onSelectConversation: () => undefined,
      onNewConversation: () => undefined,
      onDraftCommand: () => undefined,
      onOpenCopyWorkspace: () => undefined,
      onOpenImageStudio: () => undefined,
      onOpenPublish: () => undefined,
      onOpenPublishFromWorkspace: () => undefined
    }));

    expect(html).toContain("新对话 / 清空当前项目");
    expect(html).toContain("证据、草稿、选图和发布计划");
  });
});
