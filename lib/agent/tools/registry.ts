import type { AgentToolDefinition } from "@/lib/agent/types";

export type AgentToolRegistry = {
  list(): AgentToolDefinition[];
  get(name: string): AgentToolDefinition | undefined;
  call(name: string, input: unknown): Promise<unknown>;
};

export function createAgentToolRegistry(overrides: AgentToolDefinition[] = []): AgentToolRegistry {
  const tools = new Map<string, AgentToolDefinition>();
  for (const tool of [...defaultToolDefinitions(), ...overrides]) {
    tools.set(tool.name, tool);
  }

  return {
    list() {
      return [...tools.values()];
    },
    get(name) {
      return tools.get(name);
    },
    async call(name, input) {
      const tool = tools.get(name);
      if (!tool) {
        throw new Error(`Unknown agent tool: ${name}`);
      }
      if (!tool.call) {
        throw new Error(`Agent tool is not wired yet: ${name}`);
      }
      return tool.call(input);
    }
  };
}

function defaultToolDefinitions(): AgentToolDefinition[] {
  return [
    {
      name: "workflow.runOneClick",
      description: "Run the existing one-click Xiaohongshu research/draft/material/publish workflow as a macro tool.",
      risk: "local_write",
      profile: "research",
      requiresConfirmation: false,
      requiresModel: true,
      requiresMcp: true,
      mcpTools: ["search_feeds", "get_feed_detail", "publish_content"],
      supportsDryRun: true
    },
    {
      name: "workflow.searchRank",
      description: "Search Xiaohongshu notes and rank candidates by engagement signals before any drafting happens.",
      risk: "read",
      profile: "research",
      requiresConfirmation: false,
      requiresModel: false,
      requiresMcp: true,
      mcpTools: ["search_feeds"],
      supportsDryRun: true
    },
    {
      name: "workflow.loadEvidence",
      description: "Load note details, body text, comments, images, and evidence snippets for selected samples.",
      risk: "read",
      profile: "research",
      requiresConfirmation: false,
      requiresModel: false,
      requiresMcp: true,
      mcpTools: ["get_feed_detail"],
      supportsDryRun: true
    },
    {
      name: "workflow.summarizeEvidence",
      description: "Summarize title, body, tag, structure, and image-style learnings from collected evidence.",
      risk: "local_write",
      profile: "research",
      requiresConfirmation: false,
      requiresModel: true,
      requiresMcp: false,
      supportsDryRun: true
    },
    {
      name: "workflow.generateDraft",
      description: "Generate an original Xiaohongshu draft from summarized evidence and user requirements.",
      risk: "local_write",
      profile: "research",
      requiresConfirmation: false,
      requiresModel: true,
      requiresMcp: false,
      supportsDryRun: true
    },
    {
      name: "workflow.generateImages",
      description: "Generate post images from a prompt, product images, or selected reference assets.",
      risk: "local_write",
      profile: "assets",
      requiresConfirmation: false,
      requiresModel: true,
      requiresMcp: false,
      supportsDryRun: true
    },
    {
      name: "draft.reviseCurrent",
      description: "Revise the current draft in the active workspace.",
      risk: "local_write",
      profile: "research",
      requiresConfirmation: false,
      requiresModel: true,
      requiresMcp: false,
      supportsDryRun: true
    },
    {
      name: "draft.createFromEvidence",
      description: "Create a new draft from the most recent research evidence.",
      risk: "local_write",
      profile: "research",
      requiresConfirmation: false,
      requiresModel: true,
      requiresMcp: false,
      supportsDryRun: true
    },
    {
      name: "image.generate",
      description: "Generate new Xiaohongshu-ready images from text, product assets, or reference assets.",
      risk: "local_write",
      profile: "assets",
      requiresConfirmation: false,
      requiresModel: true,
      requiresMcp: false,
      supportsDryRun: true
    },
    {
      name: "image.generateCards",
      description: "Render structured Xiaohongshu cover and content cards from draft text without calling an image model.",
      risk: "local_write",
      profile: "assets",
      requiresConfirmation: false,
      requiresModel: false,
      requiresMcp: false,
      supportsDryRun: true
    },
    {
      name: "publish.prepare",
      description: "Create a guarded publish intent from the current draft and selected images.",
      risk: "local_write",
      profile: "creator_publish",
      requiresConfirmation: false,
      requiresModel: false,
      requiresMcp: false,
      supportsDryRun: true
    },
    {
      name: "publish.execute",
      description: "Execute a publish intent through Xiaohongshu MCP.",
      risk: "external_write",
      profile: "creator_publish",
      requiresConfirmation: true,
      requiresModel: false,
      requiresMcp: true,
      mcpTools: ["publish_content"],
      supportsDryRun: true
    },
    {
      name: "history.lookup",
      description: "Look up recent workflow and conversation history for workspace memory.",
      risk: "read",
      profile: "memory",
      requiresConfirmation: false,
      requiresModel: false,
      requiresMcp: false,
      supportsDryRun: true
    },
    {
      name: "assets.list",
      description: "List local product, reference, and generated assets.",
      risk: "read",
      profile: "assets",
      requiresConfirmation: false,
      requiresModel: false,
      requiresMcp: false,
      supportsDryRun: true
    }
  ];
}
