import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readText = (path: string) => readFileSync(join(root, path), "utf8");

describe("acceptance validation records export script", () => {
  it("exports only the read-only validation records payload", () => {
    const pkg = JSON.parse(readText("package.json")) as { scripts?: Record<string, string> };
    const script = readText("scripts/export-acceptance-validation-records.mjs");
    const readme = readText("README.md");

    expect(pkg.scripts?.["acceptance:export-records"]).toBe("node scripts/export-acceptance-validation-records.mjs");
    expect(script).toContain("/api/acceptance/validation-records");
    expect(script).toContain("acceptance-validation-records-export.json");
    expect(script).toContain("XHS_ACCEPTANCE_RECORDS_PATH");
    expect(script).toContain("completionMatrix");
    expect(script).toContain("Completion at export");
    expect(script).toContain("No MCP, model, publish, or schedule action was triggered");
    expect(script).not.toContain("/api/publish");
    expect(script).not.toContain("/api/assets/generate");
    expect(script).not.toContain("/api/workflows/one-click");
    expect(readme).toContain("npm run acceptance:export-records");
    expect(readme).toContain("data/acceptance-validation-records-export.json");
    expect(readme).toContain("XHS_ACCEPTANCE_RECORDS_PATH");
    expect(readme).toContain("validation records");
  });
});
