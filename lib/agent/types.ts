import type { AssetRecord } from "@/lib/storage/assets";
import type { DraftRecord } from "@/lib/storage/drafts";
import type { AppSettings } from "@/lib/storage/settings";
import type { WorkflowRun } from "@/lib/storage/history";
import type { JobRecord } from "@/lib/storage/jobs";
import type { StoredChatMessage } from "@/lib/storage/chat";
import type { OneClickResult } from "@/lib/workflows/one-click";
import type { CreatorMemoryProfile } from "@/lib/agent/memory";
import type { PostProject, PostStage } from "@/lib/post-project/types";
import type { ViralRetrievalInput } from "@/lib/rag/viral";

export type AgentAction =
  | "startProject"
  | "research"
  | "retrieveViralKnowledge"
  | "summarizeEvidence"
  | "generateDraft"
  | "reviseDraft"
  | "generateImages"
  | "generateCards"
  | "selectImages"
  | "assemblePost"
  | "runQualityGate"
  | "preparePublish"
  | "schedulePublish"
  | "askClarifyingQuestion"
  | "answer";

export type AgentIntent =
  | "start_project"
  | "research_to_draft"
  | "research_only"
  | "retrieve_viral_knowledge"
  | "revise_draft"
  | "generate_images"
  | "generate_cards"
  | "select_images"
  | "assemble_post"
  | "quality_check"
  | "prepare_publish"
  | "schedule_publish"
  | "ask"
  | "answer";

export type AgentPlanStep = {
  action: AgentAction;
  toolName?: string;
  reason: string;
};

export type AgentPlan = {
  id: string;
  intent: AgentIntent;
  topic?: string;
  timeRange?: string;
  selectedImageIndex?: number;
  scheduleText?: string;
  requiresAssets?: boolean;
  ragFilters?: Partial<Omit<ViralRetrievalInput, "query" | "topic" | "limit" | "realtimeEvidenceCount">>;
  steps: AgentPlanStep[];
};

export type AgentTraceEventType =
  | "run_started"
  | "plan_created"
  | "tool_called"
  | "tool_completed"
  | "legacy_chat_agent_called"
  | "workspace_updated"
  | "run_completed"
  | "run_failed";

export type AgentTraceEvent = {
  id: string;
  runId: string;
  type: AgentTraceEventType;
  label: string;
  detail: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type AgentTrace = {
  runId: string;
  events: AgentTraceEvent[];
};

export type AgentRunStatus = "running" | "completed" | "failed" | "awaiting_user";

export type AgentRun = {
  id: string;
  conversationId?: string | null;
  status: AgentRunStatus;
  message: string;
  plan: AgentPlan;
  createdAt: string;
  updatedAt: string;
};

export type PublishPolicyMode = "draft_only" | "review_required" | "auto_publish_allowed";

export type PublishPolicy = {
  mode: PublishPolicyMode;
  confirmed?: boolean;
};

export type PublishIntentStatus =
  | "draft"
  | "blocked"
  | "awaiting_approval"
  | "approved"
  | "publishing"
  | "published"
  | "scheduled"
  | "failed"
  | "cancelled";

export type PublishIntent = {
  id: string;
  mode: "manual" | "auto" | "scheduled";
  status: PublishIntentStatus;
  title: string;
  content: string;
  tags: string[];
  images: string[];
  visibility: AppSettings["defaultVisibility"];
  accountId?: string;
  mcpUrl?: string;
  requestedBy: "chat" | "workflow" | "manual" | "job";
  requestedAt: string;
  scheduleAt?: string;
  idempotencyKey: string;
  confirmationChecklist?: PublishConfirmationItem[];
  guardrailResults: string[];
  mcpResult?: unknown;
};

export type PublishConfirmationItem = {
  id: "copy" | "images" | "account" | "visibility" | "schedule" | "quality";
  label: string;
  required: boolean;
  confirmed: boolean;
  detail: string;
};

export type PublishDecision = {
  allowed: boolean;
  status: PublishIntentStatus;
  reasons: string[];
};

export type WorkspaceState = {
  schemaVersion: 1;
  workspaceId: string;
  updatedAt: string;
  topic?: string;
  researchRunId?: string;
  evidenceSummary?: unknown;
  selectedSamples: unknown[];
  currentDraftId?: string;
  currentDraft?: DraftRecord | null;
  selectedImageIds: string[];
  productImageIds: string[];
  publishPlan?: PublishIntent | null;
  lastUserIntent?: string;
  recentJobIds: string[];
  recentRunIds: string[];
  recentConversationIds: string[];
};

export type AgentRuntimeContext = {
  settings: AppSettings;
  history: WorkflowRun[];
  currentDraft?: DraftRecord | null;
  attachedAssets: AssetRecord[];
  conversationMessages?: StoredChatMessage[];
  creatorMemory?: CreatorMemoryProfile | null;
  jobs?: JobRecord[];
};

export type AgentToolRisk = "read" | "local_write" | "external_write";

export type AgentToolProfile = "research" | "creator_publish" | "assets" | "memory" | "system";

export type AgentToolResult<T = unknown> = {
  ok: boolean;
  data?: T;
  warnings: string[];
  risk: AgentToolRisk;
  traceId?: string;
  raw?: unknown;
  display?: {
    title?: string;
    summary?: string;
    items?: unknown[];
  };
};

export type AgentToolDefinition = {
  name: string;
  description: string;
  risk: AgentToolRisk;
  profile: AgentToolProfile;
  requiresConfirmation: boolean;
  requiresModel: boolean;
  requiresMcp: boolean;
  mcpTools?: string[];
  supportsDryRun: boolean;
  call?: (input: unknown) => Promise<unknown> | unknown;
};

export type AgentTurnResult = {
  answer: string;
  reply: string;
  stage: PostStage;
  intent: AgentIntent;
  intentConfidence: number;
  needsUserInput: boolean;
  questions: string[];
  workspacePatch: Partial<WorkspaceState>;
  cards: AgentResponseCard[];
  quickActions: AgentQuickAction[];
  toolTrace: AgentToolTraceItem[];
  workflowResult?: OneClickResult;
  currentDraft?: DraftRecord;
  agentRun: AgentRun;
  trace: AgentTrace;
  workspace: WorkspaceState;
  postProject?: PostProject;
};

export type AgentResponseCardType =
  | "evidence_summary"
  | "viral_knowledge"
  | "creative_brief"
  | "copy_draft"
  | "visual_direction"
  | "image_prompt"
  | "publish_check"
  | "quality_check";

export type AgentResponseCard = {
  id: string;
  type: AgentResponseCardType;
  title: string;
  summary: string;
  data?: unknown;
};

export type AgentQuickAction = {
  id: string;
  label: string;
  action: string;
  disabled?: boolean;
};

export type AgentToolTraceItem = {
  id: string;
  label: string;
  status: "planned" | "running" | "completed" | "failed";
  detail: string;
  createdAt: string;
};
