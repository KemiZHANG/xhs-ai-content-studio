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

export type EvidenceInsightType =
  | "title"
  | "copy"
  | "tag"
  | "visual"
  | "comment"
  | "audience"
  | "pain_point"
  | "structure"
  | "hook";

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
    basedOnEvidenceIds?: string[];
    evidenceReferences?: {
      title?: string[];
      content?: string[];
      tags?: string[];
      imagePrompt?: string[];
    };
  };
  images: Array<{ path?: string; url?: string }>;
  publishResult: unknown;
  viralKnowledge?: {
    query: string;
    rewrittenQueries: string[];
    filters?: {
      createdAfter?: string;
      createdBefore?: string;
      minLikes?: number;
      minCollects?: number;
      minComments?: number;
      minShares?: number;
      minScore?: number;
      tags?: string[];
      sortBy?: "createdAt" | "likes" | "collects" | "comments" | "shares" | "score";
      sortOrder?: "asc" | "desc";
    };
    filterSummary?: string;
    sufficiency: {
      isEnough: boolean;
      realtimeCount: number;
      viralCount: number;
      missing: string[];
      recommendation: string;
    };
    strategyReport: {
      summary: string;
      titleMoves: string[];
      structureMoves: string[];
      visualMoves: string[];
      audiencePainPoints: string[];
      originalityRules: string[];
      recommendedAngles: string[];
      evidenceIds: string[];
    };
    insights: Array<{
      id: string;
      sourceType?: "realtime" | "viral_library" | "user_input";
      type: EvidenceInsightType;
      insight: string;
      sourceSampleIds: string[];
      confidence: number;
      createdAt: string;
    }>;
    results: Array<{
      score: number;
      reasons: string[];
      matchedQueries?: string[];
      case: ViralCase;
    }>;
  } | null;
};

export type ResearchSummary = {
  contentStrengths: string[];
  imageStrengths: string[];
  learningsForContent: string[];
  learningsForImages: string[];
  nextQuestions: string[];
  structureInsights?: string[];
  hookInsights?: string[];
  viralKnowledge?: WorkflowResult["viralKnowledge"];
};

export type ViralCase = {
  id: string;
  platform: "xiaohongshu";
  sourceSampleId: string;
  topic: string;
  category: string;
  title: string;
  bodyExcerpt: string;
  tags: string[];
  imageStyle: string;
  hookType: string;
  contentStructure: string[];
  painPoint: string;
  audience: string;
  emotionalTrigger: string;
  metrics: {
    likes: number;
    collects: number;
    comments: number;
    shares: number;
    score: number;
  };
  sourceUrl: string;
  createdAt: string;
  embedding: number[];
  extractedInsights: {
    titleHooks: string[];
    copyStructures: string[];
    tagPatterns: string[];
    visualPatterns: string[];
    audienceSignals: string[];
    painPoints: string[];
    emotionalTriggers: string[];
    commentConcerns: string[];
    reusableRules: string[];
    avoidCopying: string[];
  };
  creativeSafety?: {
    summary: string;
    reusablePatterns: string[];
    doNotCopy: string[];
    transformationGuidance: string[];
  };
  extraction: {
    sourceSampleId: string;
    method: "model" | "heuristic";
    extractedAt: string;
    fallbackReason?: string;
  };
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
  cards?: AgentResponseCard[];
  quickActions?: AgentQuickAction[];
  toolTrace?: AgentToolTraceItem[];
  questions?: string[];
  intent?: string;
  stage?: PostStage;
};

export type AgentResponseCardType =
  | "stage_guidance"
  | "evidence_summary"
  | "viral_knowledge"
  | "evidence_citations"
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
  confirmationChecklist?: Array<{
    id: string;
    label: string;
    required: boolean;
    confirmed: boolean;
    detail: string;
  }>;
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
      sourceType?: "realtime" | "viral_library" | "user_input";
      type: EvidenceInsightType;
      insight: string;
      sourceSampleIds: string[];
      confidence: number;
      createdAt: string;
    }>;
  };
  selectedSamples: SampleEvidence[] | unknown[];
  creativeBrief?: {
    audience: string;
    painPoint: string;
    contentAngle: string;
    emotionalHook: string;
    proofPoints: string[];
    tone: string;
    visualMood: string;
    imageMustHave: string[];
    imageMustAvoid: string[];
    platformStyle: string;
    tabooWords: string[];
    complianceNotes: string[];
    basedOnEvidenceIds: string[];
  };
  copyDraft?: DraftRecord | null;
  copyVersions: Array<{
    id: string;
    label: string;
    createdAt: string;
    value: NonNullable<WorkflowResult["draft"]>;
    basedOnEvidenceIds: string[];
  }>;
  visualDirection?: {
    mood: string;
    composition: string;
    colorPalette: string;
    mustHave: string[];
    mustAvoid: string[];
    basedOnEvidenceIds: string[];
  };
  imagePrompts: Array<{
    id: string;
    label: string;
    createdAt: string;
    value: {
      prompt: string;
      negativePrompt?: string;
    };
    basedOnEvidenceIds: string[];
  }>;
  generatedImages: Array<{ id: string; assetId?: string; path?: string; url?: string; selected?: boolean }>;
  selectedImages: string[];
  finalPost?: {
    title: string;
    content: string;
    tags: string[];
    imageIds: string[];
    coverImageId?: string;
    copyVersionId?: string;
    imagePromptVersionIds: string[];
  };
  publishPlan?: WorkspacePublishPlan | null;
  agentMemory: string[];
  qualityCheck?: {
    titleScore: number;
    copyScore: number;
    visualConsistencyScore: number;
    platformFitScore: number;
    complianceScore: number;
    canPublish: boolean;
    issues: string[];
    suggestions: string[];
    evidenceReview?: {
      referencedEvidenceIds: string[];
      realtimeEvidenceIds: string[];
      viralEvidenceIds: string[];
      missingEvidenceIds: string[];
      summary: string;
    };
    evidenceAlignment?: {
      copyEvidenceIds: string[];
      visualEvidenceIds: string[];
      sharedEvidenceIds: string[];
      isAligned: boolean;
      summary: string;
    };
    originalityReview?: {
      rules: string[];
      sourceSampleIds: string[];
      riskSamples: string[];
      isSafe: boolean;
      summary: string;
    };
    checkedAt: string;
  };
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
  evidenceCitationSummary?: {
    summary: string;
    missingEvidenceIds: string[];
    warnings: string[];
    sourceCounts: Record<string, number>;
    fieldCounts: Record<"title" | "content" | "tags" | "imagePrompt", number>;
  };
  resultSummary?: string;
};
