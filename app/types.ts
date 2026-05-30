export type Section =
  | "flow"
  | "dashboard"
  | "workflow"
  | "jobs"
  | "assets"
  | "imageStudio"
  | "chat"
  | "publish"
  | "audit"
  | "history"
  | "settings";
export type ImageStudioMode = "ai" | "card";
export type CardTheme = "sketch" | "default" | "professional" | "retro" | "terminal" | "botanical" | "neo-brutalism" | "playful-geometric";
export type CardPaginationMode = "separator" | "auto-split" | "auto-fit" | "dynamic";

export type RedactedSettings = {
  mcpUrl: string;
  textBaseUrl: string;
  textModel: string;
  textApiKey: "configured" | "missing";
  imageBaseUrl: string;
  imageModel: string;
  imageApiKey: "configured" | "missing";
  actionToken: string;
  defaultVisibility: "公开可见" | "仅自己可见" | "仅互关好友可见";
  defaultAutoPublish: boolean;
  agentPublishPolicy: "draft_only" | "review_required" | "auto_publish_allowed";
  dailyTextCallLimit: number;
  dailyImageCallLimit: number;
  maxResearchSamples: number;
  activeAccountId: string;
  accounts: XhsAccountProfile[];
};

export type XhsAccountProfile = {
  id: string;
  displayName: string;
  mcpUrl: string;
  status: "unknown" | "logged_in" | "logged_out";
  createdAt: string;
  updatedAt: string;
};

export type SettingsDraft = Omit<RedactedSettings, "textApiKey" | "imageApiKey" | "actionToken"> & {
  textApiKey: string;
  imageApiKey: string;
};

export type Health = {
  ok: boolean;
  reachable: boolean;
  loggedIn: boolean;
  message: string;
  mcpUrl?: string;
  activeAccount?: XhsAccountProfile & { loginName?: string };
};

export type WorkflowStep = {
  id: string;
  label: string;
  status: "done" | "skipped" | "failed";
  detail: string;
};

export type WorkflowResult = {
  status: string;
  steps: WorkflowStep[];
  samples: WorkflowSample[];
  evidence?: SampleEvidence[];
  researchSummary?: ResearchSummary | null;
  report: string;
  imageStyleReport?: string;
  draft: null | {
    title: string;
    content: string;
    tags: string[];
    structure: string[];
    imagePrompt: string;
  };
  images: Array<{ path?: string; url?: string }>;
  publishResult: unknown;
};

export type ResearchSummary = {
  contentStrengths: string[];
  imageStrengths: string[];
  learningsForContent: string[];
  learningsForImages: string[];
  nextQuestions: string[];
};

export type SampleEvidence = {
  id: string;
  title: string;
  author: string;
  likes: number;
  collects: number;
  comments: number;
  shares: number;
  score: number;
  url: string;
  imageUrls: string[];
  cachedImageUrls?: string[];
  detailText: string;
  commentSnippets: string[];
  reasonHighlights: string[];
};

export type WorkflowSample = {
  id: string;
  title: string;
  score: number;
  likes?: number;
  collects?: number;
  comments?: number;
  shares?: number;
  xsecToken?: string;
  author?: string;
  url?: string;
  raw?: unknown;
};

export type WorkflowRun = {
  id: string;
  createdAt: string;
  input: {
    topic: string;
    contentType: string;
    timeRange: string;
    sampleCount: number;
    visibility: string;
    autoPublish: boolean;
    workflowGoal?: "research" | "draft";
    publishMode?: "draft" | "material" | "publish" | "schedule";
    analyzeImages?: boolean;
    generateImages?: boolean;
    scheduleAt?: string;
    requirements?: string;
  };
  result: WorkflowResult;
};

export type JobRecord = {
  id: string;
  type: string;
  title: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  createdAt: string;
  updatedAt: string;
  input: unknown;
  steps: WorkflowStep[];
  publish?: {
    title?: string;
    content?: string;
    tags?: string[];
    images?: string[];
    visibility?: string;
    scheduleAt?: string;
    status?: string;
    result?: unknown;
    error?: string;
  };
  result?: WorkflowResult;
  error?: string;
};

export type AssetRecord = {
  id: string;
  kind: "upload" | "generated";
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  prompt?: string;
  sourceAssetIds?: string[];
};

export type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  workflowResult?: WorkflowResult;
};

export type ChatConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

export type DraftRecord = {
  id: string;
  updatedAt: string;
  draft: NonNullable<WorkflowResult["draft"]>;
  images: Array<{ path?: string; url?: string }>;
  visibility: RedactedSettings["defaultVisibility"];
};

export type WorkspacePublishPlan = {
  id?: string;
  status?: string;
  title?: string;
  content?: string;
  tags?: string[];
  images?: string[];
  visibility?: string;
  scheduleAt?: string;
  requestedAt?: string;
  requestedBy?: string;
};

export type WorkspaceState = {
  topic?: string;
  researchRunId?: string;
  evidenceSummary?: ResearchSummary | unknown;
  selectedSamples: SampleEvidence[] | unknown[];
  currentDraftId?: string;
  currentDraft?: DraftRecord | null;
  selectedImageIds: string[];
  productImageIds: string[];
  publishPlan?: WorkspacePublishPlan | null;
  lastUserIntent?: string;
  recentJobIds: string[];
  recentRunIds: string[];
  recentConversationIds: string[];
};

export type PostStage =
  | "empty"
  | "briefing"
  | "researching"
  | "evidence_ready"
  | "brief_ready"
  | "copy_drafting"
  | "copy_ready"
  | "visual_planning"
  | "image_prompt_ready"
  | "image_generating"
  | "image_ready"
  | "assembling"
  | "reviewing"
  | "scheduled"
  | "published"
  | "failed";

export type PostProject = {
  id: string;
  topic?: string;
  targetAudience?: string;
  goal?: string;
  tone?: string;
  currentStage: PostStage;
  allowedActions: string[];
  evidencePack: {
    runId?: string;
    sampleIds: string[];
    insights: Array<{
      id: string;
      type: string;
      insight: string;
      sourceSampleIds: string[];
      confidence: number;
      createdAt: string;
    }>;
  };
  creativeBrief?: unknown;
  copyDraft?: DraftRecord | null;
  copyVersions: Array<{ id: string; label: string; createdAt: string; value: NonNullable<WorkflowResult["draft"]> }>;
  visualDirection?: unknown;
  imagePrompts: unknown[];
  generatedImages: Array<{ id: string; assetId?: string; path?: string; url?: string; selected?: boolean }>;
  selectedImages: string[];
  finalPost?: unknown;
  publishPlan?: WorkspacePublishPlan | null;
  qualityCheck?: unknown;
  updatedAt: string;
};

export type CreatorMemoryProfile = {
  liked: Array<{ text: string }>;
  disliked: Array<{ text: string }>;
  tone: Array<{ text: string }>;
  tags: Array<{ name: string }>;
  products: Array<{ description: string }>;
};

export type PublishDraftState = {
  title: string;
  content: string;
  tagsText: string;
  imagePrompt: string;
};

export type PublishPayload = {
  title: string;
  content: string;
  tags: string[];
  assetIds: string[];
  visibility: RedactedSettings["defaultVisibility"];
  scheduleAt?: string;
  imagePrompt: string;
};

export type PendingPublishConfirmation = {
  payload: PublishPayload;
  publishIntentId: string;
  mode: "now" | "schedule";
  createdAt: string;
  accountId: string;
  accountDisplayName: string;
  mcpUrl: string;
  loginName?: string;
};

export type PublishAuditRecord = {
  id: string;
  createdAt: string;
  event: string;
  status: string;
  requestedBy: string;
  title: string;
  contentHash: string;
  tags: string[];
  imageCount: number;
  visibility: string;
  scheduleAt?: string;
  accountId?: string;
  mcpUrl?: string;
  publishIntentId?: string;
  idempotencyKeySuffix?: string;
  reasons: string[];
  resultSummary?: string;
};
