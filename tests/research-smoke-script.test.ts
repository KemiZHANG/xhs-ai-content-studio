import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readText = (path: string) => readFileSync(join(root, path), "utf8");

describe("research smoke script", () => {
  it("is exposed as a safe research-only npm script", () => {
    const pkg = JSON.parse(readText("package.json")) as { scripts?: Record<string, string> };
    const script = readText("scripts/research-smoke.mjs");

    expect(pkg.scripts?.["smoke:research"]).toBe("node scripts/research-smoke.mjs");
    expect(script).toContain("/api/workflows/one-click");
    expect(script).toContain('workflowGoal: "research"');
    expect(script).toContain('publishMode: "draft"');
    expect(script).toContain("autoPublish: false");
    expect(script).toContain("generateImages: false");
    expect(script).toContain("useViralKnowledge: false");
    expect(script).toContain('publishResult.reason !== "research mode"');
    expect(script).toContain("no draft, image generation, or external publishing action was triggered");
    expect(script).not.toContain("/api/publish");
    expect(script).not.toContain("confirm_publish");
  });
});
