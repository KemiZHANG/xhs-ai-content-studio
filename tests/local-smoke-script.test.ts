import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readText = (path: string) => readFileSync(join(root, path), "utf8");

describe("local smoke script", () => {
  it("is exposed as a read-only npm script", () => {
    const pkg = JSON.parse(readText("package.json")) as { scripts?: Record<string, string> };
    const script = readText("scripts/local-smoke.mjs");

    expect(pkg.scripts?.["smoke:local"]).toBe("node scripts/local-smoke.mjs");
    expect(pkg.scripts?.["smoke:safe"]).toBe(
      "npm run smoke:local && npm run smoke:accounts && npm run smoke:studio-state && npm run smoke:chat-stream && npm run smoke:publish-dry-run && npm run smoke:acceptance-status"
    );
    expect(script).toContain("/api/health/mcp");
    expect(script).toContain("/api/post-project");
    expect(script).toContain("No external publishing action was triggered");
    expect(script).not.toContain("/api/publish");
    expect(script).not.toContain("/api/workflows/one-click");
  });
});
