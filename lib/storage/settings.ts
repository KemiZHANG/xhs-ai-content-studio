import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { modelProviderPresets } from "@/lib/models/presets";

export type PublishVisibility = "公开可见" | "仅自己可见" | "仅互关好友可见";
export type AgentPublishPolicy = "draft_only" | "review_required" | "auto_publish_allowed";
export type XhsAccountProfile = {
  id: string;
  displayName: string;
  mcpUrl: string;
  status: "unknown" | "logged_in" | "logged_out";
  createdAt: string;
  updatedAt: string;
};

export const publishVisibilityValues = ["公开可见", "仅自己可见", "仅互关好友可见"] as const;
export const agentPublishPolicyValues = ["draft_only", "review_required", "auto_publish_allowed"] as const;

export type AppSettings = {
  mcpUrl: string;
  textBaseUrl: string;
  textModel: string;
  textApiKey: string;
  imageBaseUrl: string;
  imageModel: string;
  imageApiKey: string;
  defaultVisibility: PublishVisibility;
  defaultAutoPublish: boolean;
  agentPublishPolicy: AgentPublishPolicy;
  dailyTextCallLimit: number;
  dailyImageCallLimit: number;
  maxResearchSamples: number;
  activeAccountId: string;
  accounts: XhsAccountProfile[];
};

export type RedactedSettings = Omit<AppSettings, "textApiKey" | "imageApiKey"> & {
  textApiKey: "configured" | "missing";
  imageApiKey: "configured" | "missing";
};

export const defaultSettings: AppSettings = {
  mcpUrl: "http://localhost:18060/mcp",
  textBaseUrl: modelProviderPresets.gemini.text.textBaseUrl,
  textModel: modelProviderPresets.gemini.text.textModel,
  textApiKey: "",
  imageBaseUrl: modelProviderPresets.gemini.image.imageBaseUrl,
  imageModel: modelProviderPresets.gemini.image.imageModel,
  imageApiKey: "",
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

const settingsPath = () => path.join(process.cwd(), "data", "settings.json");

export function redactSettings(settings: AppSettings): RedactedSettings {
  return {
    ...settings,
    textApiKey: settings.textApiKey.trim() ? "configured" : "missing",
    imageApiKey: settings.imageApiKey.trim() ? "configured" : "missing"
  };
}

export async function readSettings(): Promise<AppSettings> {
  try {
    const raw = await readFile(settingsPath(), "utf8");
    const parsed = parseSettingsJson(raw);

    const merged = {
      ...defaultSettings,
      ...parsed
    };
    return normalizeSettings(merged);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return defaultSettings;
    }

    throw error;
  }
}

export function parseSettingsJson(raw: string): Partial<AppSettings> {
  return JSON.parse(raw.replace(/^\uFEFF/, "")) as Partial<AppSettings>;
}

export async function writeSettings(nextSettings: AppSettings): Promise<AppSettings> {
  const filePath = settingsPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(nextSettings, null, 2)}\n`, "utf8");

  return nextSettings;
}

export function mergeSettingsUpdate(current: AppSettings, update: Partial<AppSettings>): AppSettings {
  const nextVisibility = isPublishVisibility(update.defaultVisibility) ? update.defaultVisibility : current.defaultVisibility;
  const nextPolicy = isAgentPublishPolicy(update.agentPublishPolicy)
    ? update.agentPublishPolicy
    : current.agentPublishPolicy;
  const mergedAccounts = normalizeAccounts(update.accounts ?? current.accounts, update.mcpUrl ?? current.mcpUrl);
  const activeAccountId = mergedAccounts.some((account) => account.id === update.activeAccountId)
    ? String(update.activeAccountId)
    : current.activeAccountId;
  const accounts = mergedAccounts.map((account) =>
    account.id === activeAccountId && typeof update.mcpUrl === "string"
      ? { ...account, mcpUrl: update.mcpUrl.trim() || account.mcpUrl, updatedAt: new Date().toISOString() }
      : account
  );
  const activeAccount = accounts.find((account) => account.id === activeAccountId) ?? accounts[0];

  return normalizeSettings({
    ...current,
    ...update,
    activeAccountId: activeAccount.id,
    accounts,
    mcpUrl: activeAccount.mcpUrl,
    defaultVisibility: nextVisibility,
    agentPublishPolicy: nextPolicy,
    dailyTextCallLimit: normalizePositiveInteger(update.dailyTextCallLimit, current.dailyTextCallLimit, 500),
    dailyImageCallLimit: normalizePositiveInteger(update.dailyImageCallLimit, current.dailyImageCallLimit, 100),
    maxResearchSamples: normalizePositiveInteger(update.maxResearchSamples, current.maxResearchSamples, 30),
    textApiKey:
      update.textApiKey === undefined || update.textApiKey === "configured" || update.textApiKey === "missing"
        ? current.textApiKey
        : update.textApiKey,
    imageApiKey:
      update.imageApiKey === undefined || update.imageApiKey === "configured" || update.imageApiKey === "missing"
        ? current.imageApiKey
        : update.imageApiKey
  });
}

export function isPublishVisibility(value: unknown): value is PublishVisibility {
  return typeof value === "string" && publishVisibilityValues.includes(value as PublishVisibility);
}

export function isAgentPublishPolicy(value: unknown): value is AgentPublishPolicy {
  return typeof value === "string" && agentPublishPolicyValues.includes(value as AgentPublishPolicy);
}

function normalizeSettings(settings: AppSettings): AppSettings {
  const accounts = normalizeAccounts(settings.accounts, settings.mcpUrl);
  const activeAccount =
    accounts.find((account) => account.id === settings.activeAccountId) ??
    accounts.find((account) => account.id === defaultSettings.activeAccountId) ??
    accounts[0];

  return {
    ...settings,
    accounts,
    activeAccountId: activeAccount.id,
    mcpUrl: activeAccount.mcpUrl,
    defaultVisibility: isPublishVisibility(settings.defaultVisibility)
      ? settings.defaultVisibility
      : defaultSettings.defaultVisibility,
    agentPublishPolicy: isAgentPublishPolicy(settings.agentPublishPolicy)
      ? settings.agentPublishPolicy
      : defaultSettings.agentPublishPolicy,
    dailyTextCallLimit: normalizePositiveInteger(settings.dailyTextCallLimit, defaultSettings.dailyTextCallLimit, 500),
    dailyImageCallLimit: normalizePositiveInteger(settings.dailyImageCallLimit, defaultSettings.dailyImageCallLimit, 100),
    maxResearchSamples: normalizePositiveInteger(settings.maxResearchSamples, defaultSettings.maxResearchSamples, 30)
  };
}

function normalizePositiveInteger(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(max, Math.max(1, Math.round(parsed)));
}

function normalizeAccounts(value: unknown, fallbackMcpUrl: string): XhsAccountProfile[] {
  const now = new Date().toISOString();
  const accounts = Array.isArray(value)
    ? value
        .map((item, index) => normalizeAccount(item, index, fallbackMcpUrl, now))
        .filter((item): item is XhsAccountProfile => Boolean(item))
    : [];

  if (accounts.length) {
    return accounts;
  }

  return [
    {
      id: "local-default",
      displayName: "默认小红书账号",
      mcpUrl: fallbackMcpUrl || defaultSettings.mcpUrl,
      status: "unknown",
      createdAt: now,
      updatedAt: now
    }
  ];
}

function normalizeAccount(
  value: unknown,
  index: number,
  fallbackMcpUrl: string,
  now: string
): XhsAccountProfile | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<XhsAccountProfile>;
  const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : `xhs-account-${index + 1}`;
  const mcpUrl =
    typeof record.mcpUrl === "string" && record.mcpUrl.trim() ? record.mcpUrl.trim() : fallbackMcpUrl;
  if (!mcpUrl) {
    return null;
  }

  return {
    id,
    displayName:
      typeof record.displayName === "string" && record.displayName.trim()
        ? record.displayName.trim()
        : `小红书账号 ${index + 1}`,
    mcpUrl,
    status:
      record.status === "logged_in" || record.status === "logged_out" || record.status === "unknown"
        ? record.status
        : "unknown",
    createdAt: typeof record.createdAt === "string" ? record.createdAt : now,
    updatedAt: now
  };
}
