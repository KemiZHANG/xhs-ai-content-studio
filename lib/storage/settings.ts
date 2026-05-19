import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type PublishVisibility = "公开可见" | "仅自己可见" | "仅互关好友可见";

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
};

export type RedactedSettings = Omit<AppSettings, "textApiKey" | "imageApiKey"> & {
  textApiKey: "configured" | "missing";
  imageApiKey: "configured" | "missing";
};

export const defaultSettings: AppSettings = {
  mcpUrl: "http://localhost:18060/mcp",
  textBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  textModel: "gemini-3-flash-preview",
  textApiKey: "",
  imageBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  imageModel: "gemini-2.5-flash-image",
  imageApiKey: "",
  defaultVisibility: "仅自己可见",
  defaultAutoPublish: false
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

    return {
      ...defaultSettings,
      ...parsed
    };
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
  return {
    ...current,
    ...update,
    textApiKey:
      update.textApiKey === undefined || update.textApiKey === "configured" || update.textApiKey === "missing"
        ? current.textApiKey
        : update.textApiKey,
    imageApiKey:
      update.imageApiKey === undefined || update.imageApiKey === "configured" || update.imageApiKey === "missing"
        ? current.imageApiKey
        : update.imageApiKey
  };
}
