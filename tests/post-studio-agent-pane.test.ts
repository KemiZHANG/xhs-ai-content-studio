import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PostStudioAgentPane } from "@/app/components/post-studio-agent-pane";
import type { ChatMessage, JobRecord } from "@/app/types";

const researchForm = {
  topic: "广州咖啡馆",
  contentType: "探店",
  timeRange: "一周内",
  sampleCount: 4,
  analyzeImages: true,
  requirements: "真实分享风格，目标人群是周末约会用户。"
};

const assistantMessage = {
  role: "assistant",
  content: "我会先判断阶段并总结证据，再进入文案创作。",
  intent: "generate_copy",
  intentConfidence: 0.82,
  needsUserInput: false,
  stage: "brief_ready",
  questions: ["补充目标人群？"],
  cards: [{
    id: "card-1",
    type: "creative_brief",
    title: "Brief 已就绪",
    summary: "可基于证据生成文案。",
    data: { basedOnEvidenceIds: ["evidence-1"] }
  }],
  quickActions: [{ id: "qa-1", label: "生成文案", action: "generate_copy" }],
  toolTrace: [{
    id: "trace-1",
    label: "读取 PostProject",
    detail: "已读取当前项目",
    status: "completed",
    createdAt: "2026-06-02T08:00:00.000Z"
  }]
} as unknown as ChatMessage;

const runningJob: JobRecord = {
  id: "job-1",
  type: "agent",
  title: "研究广州咖啡馆",
  status: "running",
  progress: 48,
  createdAt: "2026-06-02T08:00:00.000Z",
  updatedAt: "2026-06-02T08:01:00.000Z",
  input: { topic: "广州咖啡馆" },
  steps: [{
    id: "step-1",
    label: "搜索真实笔记",
    status: "done",
    detail: "已拿到候选样本"
  }]
};

describe("post studio agent pane", () => {
  it("renders readable research entry, running progress, assistant cards, and composer", () => {
    const html = renderToStaticMarkup(createElement(PostStudioAgentPane, {
      evidenceCount: 1,
      researchForm,
      messages: [
        { role: "user", content: "帮我找最近一周广州咖啡馆高收藏笔记" },
        assistantMessage
      ],
      runningJob,
      chatInput: "把标题再生活化一点",
      busy: false,
      onRunResearch: () => undefined,
      onResearchFormChange: () => undefined,
      onChatInput: () => undefined,
      onChatSubmit: () => undefined,
      onQuickAction: () => undefined
    }));

    expect(html).toContain("AI Agent");
    expect(html).toContain("继续输入");
    expect(html).toContain("真实笔记研究");
    expect(html).toContain("1 条证据已绑定");
    expect(html).toContain("搜索并提炼证据");
    expect(html).toContain("研究广州咖啡馆");
    expect(html).toContain("48%");
    expect(html).toContain("Brief 已就绪");
    expect(html).toContain("证据: evidence-1");
    expect(html).toContain("生成文案");
    expect(html).toContain("把标题再生活化一点");
    expect(html).not.toMatch(/[�]|鐖|鍥剧|鏂囨|鍙戝|缁х|璇佹|鎼滅/);
  });

  it("keeps the empty-state starter prompts visible before a conversation starts", () => {
    const html = renderToStaticMarkup(createElement(PostStudioAgentPane, {
      evidenceCount: 0,
      researchForm,
      messages: [],
      runningJob: null,
      chatInput: "",
      busy: false,
      onRunResearch: () => undefined,
      onResearchFormChange: () => undefined,
      onChatInput: () => undefined,
      onChatSubmit: () => undefined,
      onQuickAction: () => undefined
    }));

    expect(html).toContain("告诉 Agent 你要做什么");
    expect(html).toContain("先搜索证据");
    expect(html).toContain("帮我找最近一周高收藏笔记");
    expect(html).toContain("Post Studio 起步指令");
    expect(html).toContain("基于当前证据生成 CreativeBrief");
    expect(html).not.toMatch(/[�]|鐖|鍥剧|鏂囨|鍙戝|缁х|璇佹|鎼滅/);
  });
});
