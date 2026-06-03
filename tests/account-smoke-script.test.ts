import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readText = (path: string) => readFileSync(join(root, path), "utf8");

describe("account smoke script", () => {
  it("is exposed as a read-only account configuration check", () => {
    const pkg = JSON.parse(readText("package.json")) as { scripts?: Record<string, string> };
    const script = readText("scripts/account-smoke.mjs");

    expect(pkg.scripts?.["smoke:accounts"]).toBe("node scripts/account-smoke.mjs");
    expect(pkg.scripts?.["smoke:safe"]).toBe(
      "npm run smoke:local && npm run smoke:accounts && npm run smoke:studio-state && npm run smoke:chat-stream && npm run smoke:publish-dry-run"
    );
    expect(script).toContain("/api/settings");
    expect(script).toContain("/api/health/mcp");
    expect(script).toContain("activeAccountId");
    expect(script).toContain("Configured accounts");
    expect(script).toContain("No search, image generation, publish, or schedule action was triggered");
    expect(script).not.toContain("/api/chat");
    expect(script).not.toContain("/api/publish");
    expect(script).not.toContain("/api/workflows/one-click");
  });
});
