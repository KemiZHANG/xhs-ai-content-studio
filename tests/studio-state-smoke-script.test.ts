import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readText = (path: string) => readFileSync(join(root, path), "utf8");

describe("Post Studio state smoke script", () => {
  it("is exposed as a read-only PostProject structure check", () => {
    const pkg = JSON.parse(readText("package.json")) as { scripts?: Record<string, string> };
    const script = readText("scripts/studio-state-smoke.mjs");

    expect(pkg.scripts?.["smoke:studio-state"]).toBe("node scripts/studio-state-smoke.mjs");
    expect(pkg.scripts?.["smoke:safe"]).toBe(
      "npm run smoke:local && npm run smoke:accounts && npm run smoke:studio-state && npm run smoke:chat-stream && npm run smoke:publish-dry-run"
    );
    expect(script).toContain("/api/post-project");
    expect(script).toContain("requiredProjectFields");
    expect(script).toContain("currentStage");
    expect(script).toContain("allowedActions");
    expect(script).toContain("evidencePack");
    expect(script).toContain("readiness");
    expect(script).toContain("no MCP search, image generation, publish, or schedule action was triggered");
    expect(script).not.toContain("/api/chat");
    expect(script).not.toContain("/api/publish");
    expect(script).not.toContain("/api/workflows/one-click");
  });
});
