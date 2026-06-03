import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readText = (path: string) => readFileSync(join(root, path), "utf8");

describe("publish dry-run smoke script", () => {
  it("is exposed as a preview-only npm script", () => {
    const pkg = JSON.parse(readText("package.json")) as { scripts?: Record<string, string> };
    const script = readText("scripts/publish-dry-run-smoke.mjs");

    expect(pkg.scripts?.["smoke:publish-dry-run"]).toBe("node scripts/publish-dry-run-smoke.mjs");
    expect(script).toContain("/api/assets");
    expect(script).toContain("/api/publish");
    expect(script).toContain("dryRun: true");
    expect(script).toContain("uploadTinyImage");
    expect(script).toContain('visibility: "仅自己可见"');
    expect(script).toContain("requiresConfirmation");
    expect(script).toContain("no external publishing action was triggered");
    expect(script).toContain("published");
    expect(script).toContain("scheduled");
    expect(script).not.toContain("confirmed: true");
    expect(script).not.toContain("publishIntentId");
  });
});
