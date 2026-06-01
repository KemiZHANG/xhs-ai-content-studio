import { describe, expect, it } from "vitest";
import { defaultSettings } from "@/app/config/default-settings";

describe("default settings", () => {
  it("starts in review-required publish mode with conservative visibility", () => {
    expect(defaultSettings.agentPublishPolicy).toBe("review_required");
    expect(defaultSettings.defaultVisibility).toBe("仅自己可见");
    expect(defaultSettings.accounts[0]?.displayName).toBe("默认小红书账号");
    expect(defaultSettings.accounts[0]?.mcpUrl).toBe(defaultSettings.mcpUrl);
  });
});
