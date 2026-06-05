import type { AgentToolDefinition } from "@/lib/agent/types";
import { retrieveViralKnowledge, type ViralKnowledgePack, type ViralRetrievalInput } from "@/lib/rag/viral";
import { addViralCasesToPostProjectWithSummary } from "@/lib/post-project/store";
import {
  createViralCaseFromEvidence,
  reviewViralSaveCandidate,
  upsertViralCases
} from "@/lib/viral-knowledge/store";
import type { ModelProvider } from "@/lib/models/provider";
import type { SampleEvidence } from "@/lib/workflows/one-click";

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
      name: "knowledge.retrieveViralPatterns",
      description: "Retrieve reusable Xiaohongshu creative patterns from the local viral knowledge base.",
      risk: "read",
      profile: "research",
      requiresConfirmation: false,
      requiresModel: false,
      requiresMcp: false,
      supportsDryRun: true,
      call: async (input) => {
        const request = parseViralRetrievalToolInput(input);
        const pack = await retrieveViralKnowledge(request);
        return {
          ok: true,
          data: pack,
          warnings: pack.sufficiency.isEnough ? [] : pack.sufficiency.missing,
          risk: "read",
          display: {
            title: "爆款库 RAG 检索",
            summary: `${formatViralPackSummary(pack)} ${pack.strategyReport.summary}`,
            items: pack.insights.slice(0, 5)
          }
        };
      }
    },
    {
      name: "knowledge.saveViralCase",
      description: "Save a high-quality research sample as structured reusable viral knowledge and attach its insights to the active PostProject.",
      risk: "local_write",
      profile: "research",
      requiresConfirmation: false,
      requiresModel: true,
      requiresMcp: false,
      supportsDryRun: true,
      call: async (input) => {
        const request = parseSaveViralCaseToolInput(input);
        const candidateReview = reviewViralSaveCandidate(request.sample);
        if (!candidateReview.shouldSave && !request.force) {
          return {
            ok: false,
            data: {
              candidateReview,
              skippedSampleIds: [request.sample.id]
            },
            warnings: candidateReview.warnings,
            risk: "local_write",
            display: {
              title: "样本暂未入库",
              summary: `质量分 ${candidateReview.score}/100，未达到爆款库入库门槛。`,
              items: [...candidateReview.warnings, ...candidateReview.reasons].slice(0, 5)
            }
          };
        }
        const viralCase = await createViralCaseFromEvidence(request);
        const [saved] = await upsertViralCases([viralCase]);
        const saveResult = await addViralCasesToPostProjectWithSummary([saved]);
        const extractionLabel = saved.extraction.method === "model" ? "AI 结构化提炼" : "启发式提炼";
        const forcedLowQuality = !candidateReview.shouldSave && request.force;
        const forcedLowQualityWarning = forcedLowQuality
          ? `已强制入库低质量样本：质量分 ${candidateReview.score}/100，${candidateReview.warnings.slice(0, 2).join("；") || "入库证据不足"}`
          : "";
        return {
          ok: true,
          data: {
            case: saved,
            project: saveResult.project,
            addedInsightIds: saveResult.addedInsightIds,
            addedInsights: saveResult.addedInsights,
            addedSampleIds: saveResult.addedSampleIds,
            candidateReview,
            forcedLowQuality,
            skippedSampleIds: []
          },
          warnings: [
            forcedLowQualityWarning,
            request.model ? "" : "未提供模型，已使用本地启发式提取爆款规律。",
            saved.extraction.fallbackReason ? `AI 提取失败后已回退：${saved.extraction.fallbackReason}` : ""
          ].filter(Boolean),
          risk: "local_write",
          display: {
            title: forcedLowQuality ? "已强制保存低质量爆款规律" : "已保存爆款规律",
            summary: forcedLowQuality
              ? `低质量样本强制入库 · 质量分 ${candidateReview.score}/100 · ${saved.topic} · ${extractionLabel}`
              : `${saved.topic} · ${extractionLabel} · ${saved.hookType} · ${saved.extractedInsights.reusableRules.slice(0, 2).join("；")}`,
            items: forcedLowQuality
              ? [...candidateReview.warnings, ...candidateReview.reasons, ...saved.extractedInsights.reusableRules].slice(0, 5)
              : saved.extractedInsights.reusableRules
          }
        };
      }
    },
    {
      name: "project.startProject",
      description: "Reset the active PostProject and workspace when the user starts a new post, topic, product, or audience.",
      risk: "local_write",
      profile: "system",
      requiresConfirmation: false,
      requiresModel: false,
      requiresMcp: false,
      supportsDryRun: true
    },
    {
      name: "project.updateBriefInputs",
      description: "Update topic, audience, goal, tone, product, and selling-point slots on the active PostProject.",
      risk: "local_write",
      profile: "system",
      requiresConfirmation: false,
      requiresModel: false,
      requiresMcp: false,
      supportsDryRun: true
    },
    {
      name: "project.createCreativeBrief",
      description: "Compress realtime evidence and viral-library patterns into the shared CreativeBrief that drives copy and visuals.",
      risk: "local_write",
      profile: "research",
      requiresConfirmation: false,
      requiresModel: true,
      requiresMcp: false,
      supportsDryRun: true
    },
    {
      name: "project.selectImages",
      description: "Bind selected generated, uploaded, or card-rendered assets to the active PostProject for publishing.",
      risk: "local_write",
      profile: "assets",
      requiresConfirmation: false,
      requiresModel: false,
      requiresMcp: false,
      supportsDryRun: true
    },
    {
      name: "project.assemblePost",
      description: "Combine the current draft and selected image assets into the active PostProject finalPost.",
      risk: "local_write",
      profile: "creator_publish",
      requiresConfirmation: false,
      requiresModel: false,
      requiresMcp: false,
      supportsDryRun: true
    },
    {
      name: "project.runQualityGate",
      description: "Run publish-readiness, traceability, compliance, and image-copy consistency checks before confirmation.",
      risk: "local_write",
      profile: "creator_publish",
      requiresConfirmation: false,
      requiresModel: false,
      requiresMcp: false,
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
      name: "workflow.planVisuals",
      description: "Plan image direction and image prompts from the same CreativeBrief and evidencePack used by the copy.",
      risk: "local_write",
      profile: "assets",
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

function parseViralRetrievalToolInput(input: unknown): ViralRetrievalInput {
  const record = isRecord(input) ? input : {};
  const query = stringValue(record.query) || stringValue(record.topic) || "";
  if (!query.trim()) {
    throw new Error("检索爆款库需要 query 或 topic");
  }
  return {
    query,
    topic: stringValue(record.topic),
    category: stringValue(record.category),
    audience: stringValue(record.audience),
    painPoint: stringValue(record.painPoint),
    tags: stringArray(record.tags),
    createdAfter: stringValue(record.createdAfter),
    createdBefore: stringValue(record.createdBefore),
    minLikes: numberValue(record.minLikes),
    minCollects: numberValue(record.minCollects),
    minComments: numberValue(record.minComments),
    minShares: numberValue(record.minShares),
    minScore: numberValue(record.minScore),
    sortBy: viralSortByValue(record.sortBy),
    sortOrder: sortOrderValue(record.sortOrder),
    limit: numberValue(record.limit),
    realtimeEvidenceCount: numberValue(record.realtimeEvidenceCount)
  };
}

function parseSaveViralCaseToolInput(input: unknown): {
  sample: SampleEvidence;
  topic: string;
  category: string;
  model?: ModelProvider;
  force?: boolean;
} {
  const record = isRecord(input) ? input : {};
  const sample = record.sample;
  if (!isSampleEvidence(sample)) {
    throw new Error("保存爆款库需要完整研究样本 sample");
  }
  return {
    sample,
    topic: stringValue(record.topic) || "未分类主题",
    category: stringValue(record.category) || "小红书图文",
    model: isModelProvider(record.model) ? record.model : undefined,
    force: record.force === true || record.allowLowQuality === true
  };
}

function formatViralPackSummary(pack: ViralKnowledgePack): string {
  const status = pack.sufficiency.isEnough ? "证据充足" : "证据不足";
  const filterSummary = pack.filterSummary ? `筛选：${pack.filterSummary}。` : "";
  return `${status}：${filterSummary}命中 ${pack.results.length} 条历史爆款规律，生成 ${pack.insights.length} 条可追溯 evidencePack 结论。`;
}

function isSampleEvidence(value: unknown): value is SampleEvidence {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.title === "string";
}

function isModelProvider(value: unknown): value is ModelProvider {
  if (!isRecord(value)) return false;
  return typeof value.generateStructuredText === "function";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function viralSortByValue(value: unknown): ViralRetrievalInput["sortBy"] {
  const parsed = stringValue(value);
  const allowed = ["createdAt", "likes", "collects", "comments", "shares", "score"] as const;
  return allowed.find((item) => item === parsed);
}

function sortOrderValue(value: unknown): ViralRetrievalInput["sortOrder"] {
  const parsed = stringValue(value);
  return parsed === "asc" || parsed === "desc" ? parsed : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map((item) => stringValue(item)).filter((item): item is string => Boolean(item));
  return items.length ? items : undefined;
}
