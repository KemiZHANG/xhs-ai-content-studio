import { describe, expect, it } from "vitest";
import { defaultSettings, mergeSettingsUpdate, parseSettingsJson, redactSettings } from "@/lib/storage/settings";

describe("settings redaction", () => {
  it("keeps routing fields but hides configured API keys", () => {
    const redacted = redactSettings({
      ...defaultSettings,
      textApiKey: "sk-test-text",
      imageApiKey: "sk-test-image"
    });

    expect(redacted.mcpUrl).toBe("http://localhost:18060/mcp");
    expect(redacted.textModel).toBe(defaultSettings.textModel);
    expect(redacted.textApiKey).toBe("configured");
    expect(redacted.imageApiKey).toBe("configured");
  });

  it("marks empty API keys as missing", () => {
    const redacted = redactSettings(defaultSettings);

    expect(redacted.textApiKey).toBe("missing");
    expect(redacted.imageApiKey).toBe("missing");
  });

  it("uses Nano Banana Gemini 2.5 Flash Image as the default image model", () => {
    expect(defaultSettings.imageModel).toBe("gemini-2.5-flash-image");
  });

  it("parses settings files that include a UTF-8 BOM", () => {
    const parsed = parseSettingsJson(`\uFEFF{"textModel":"gemini-3-flash-preview"}`);

    expect(parsed.textModel).toBe("gemini-3-flash-preview");
  });

  it("keeps account profiles and points mcpUrl at the active account", () => {
    const next = mergeSettingsUpdate(defaultSettings, {
      accounts: [
        {
          id: "account-a",
          displayName: "账号 A",
          mcpUrl: "http://localhost:18060/mcp",
          status: "unknown",
          createdAt: "2026-05-25T00:00:00.000Z",
          updatedAt: "2026-05-25T00:00:00.000Z"
        },
        {
          id: "account-b",
          displayName: "账号 B",
          mcpUrl: "http://localhost:18061/mcp",
          status: "unknown",
          createdAt: "2026-05-25T00:00:00.000Z",
          updatedAt: "2026-05-25T00:00:00.000Z"
        }
      ],
      activeAccountId: "account-b"
    });

    expect(next.activeAccountId).toBe("account-b");
    expect(next.mcpUrl).toBe("http://localhost:18061/mcp");
    expect(redactSettings(next).accounts).toHaveLength(2);
  });
});
