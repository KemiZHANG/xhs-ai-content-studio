import type { DraftRecord } from "@/lib/storage/drafts";
import type { PublishIntent } from "@/lib/agent/types";
import type { SampleEvidence } from "@/lib/workflows/one-click";

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

export type PostAction =
  | "start_brief"
  | "update_brief_inputs"
  | "search_research"
  | "summarize_evidence"
  | "retrieve_viral_knowledge"
  | "create_creative_brief"
  | "generate_copy"
  | "revise_copy"
  | "plan_visuals"
  | "confirm_visual_direction"
  | "generate_image_prompts"
  | "generate_images"
  | "generate_cards"
  | "select_images"
  | "assemble_post"
  | "run_quality_gate"
  | "request_publish_confirmation"
  | "schedule_publish"
  | "publish_now"
  | "recover";

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

export type EvidenceSourceType = "realtime" | "viral_library" | "user_input";

export type EvidenceInsight = {
  id: string;
  sourceType?: EvidenceSourceType;
  type: EvidenceInsightType;
  insight: string;
  sourceSampleIds: string[];
  confidence: number;
  createdAt: string;
};

export type EvidencePack = {
  runId?: string;
  sampleIds: string[];
  insights: EvidenceInsight[];
  summary?: unknown;
  updatedAt?: string;
};

export type CreativeBrief = {
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

export type VersionedText<T> = {
  id: string;
  createdAt: string;
  label: string;
  value: T;
  basedOnEvidenceIds: string[];
};

export type VisualDirection = {
  mood: string;
  composition: string;
  colorPalette: string;
  mustHave: string[];
  mustAvoid: string[];
  basedOnEvidenceIds: string[];
  confirmationStatus?: "pending" | "confirmed";
  confirmedAt?: string;
  confirmedBy?: "user" | "agent";
};

export type ImagePromptVersion = VersionedText<{
  prompt: string;
  negativePrompt?: string;
}>;

export type GeneratedProjectImage = {
  id: string;
  assetId?: string;
  path?: string;
  url?: string;
  promptId?: string;
  promptVersionId?: string;
  generationBatchId?: string;
  basedOnEvidenceIds?: string[];
  sourceAssetIds?: string[];
  createdAt: string;
  selected?: boolean;
};

export type GeneratedImageVersion = {
  id: string;
  createdAt: string;
  label: string;
  imageIds: string[];
  selectedImageIds: string[];
  promptVersionId?: string;
  generationBatchId?: string;
  basedOnEvidenceIds: string[];
  sourceAssetIds: string[];
};

export type FinalPost = {
  title: string;
  content: string;
  tags: string[];
  imageIds: string[];
  coverImageId?: string;
  copyVersionId?: string;
  imagePromptVersionIds: string[];
  generatedImageVersionId?: string;
  basedOnEvidenceIds?: string[];
};

export type QualityCheck = {
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
  viralCoverage?: {
    fields: Array<{
      field: "title" | "content" | "tags" | "imagePrompt";
      viralEvidenceIds: string[];
      weakViralEvidenceIds?: string[];
      realtimeEvidenceIds: string[];
      status: "covered" | "missing";
    }>;
    missingFields: string[];
    summary: string;
  };
  checkedAt: string;
};

export type ProductInfo = {
  name?: string;
  sellingPoints?: string;
  scene?: string;
  referenceAssetIds: string[];
};

export type PostProject = {
  schemaVersion: 1;
  id: string;
  topic?: string;
  productInfo: ProductInfo;
  targetAudience?: string;
  goal?: string;
  tone?: string;
  evidencePack: EvidencePack;
  focusedEvidenceIds: string[];
  selectedSamples: SampleEvidence[] | unknown[];
  creativeBrief?: CreativeBrief;
  copyDraft?: DraftRecord | null;
  copyVersions: VersionedText<DraftRecord["draft"]>[];
  visualDirection?: VisualDirection;
  imagePrompts: ImagePromptVersion[];
  generatedImages: GeneratedProjectImage[];
  generatedImageVersions?: GeneratedImageVersion[];
  selectedImages: string[];
  finalPost?: FinalPost;
  publishPlan?: PublishIntent | null;
  agentMemory: string[];
  auditStatus?: "unchecked" | "passed" | "blocked";
  qualityCheck?: QualityCheck;
  currentStage: PostStage;
  allowedActions: PostAction[];
  updatedAt: string;
};
