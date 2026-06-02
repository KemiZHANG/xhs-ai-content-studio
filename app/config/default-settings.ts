import { modelProviderPresets } from "@/lib/models/presets";
import type { RedactedSettings } from "@/app/types";

export const publishVisibilityValues = ["公开可见", "仅自己可见", "仅互关好友可见"] as const;

export const defaultSettings: RedactedSettings = {
  mcpUrl: "http://localhost:18060/mcp",
  textBaseUrl: modelProviderPresets.gemini.text.textBaseUrl,
  textModel: modelProviderPresets.gemini.text.textModel,
  textApiKey: "missing",
  imageBaseUrl: modelProviderPresets.gemini.image.imageBaseUrl,
  imageModel: modelProviderPresets.gemini.image.imageModel,
  imageApiKey: "missing",
  actionToken: "",
  defaultVisibility: "仅自己可见",
  defaultAutoPublish: false,
  agentPublishPolicy: "review_required",
  dailyTextCallLimit: 80,
  dailyImageCallLimit: 20,
  maxResearchSamples: 12,
  activeAccountId: "local-default",
  accounts: [
    {
      id: "local-default",
      displayName: "默认小红书账号",
      mcpUrl: "http://localhost:18060/mcp",
      status: "unknown",
      createdAt: "2026-05-25T00:00:00.000Z",
      updatedAt: "2026-05-25T00:00:00.000Z"
    }
  ]
};
