import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readText = (path: string) => readFileSync(join(root, path), "utf8");

describe("acceptance evidence package validation script", () => {
  it("validates only the local manual evidence JSON", () => {
    const pkg = JSON.parse(readText("package.json")) as { scripts?: Record<string, string> };
    const script = readText("scripts/validate-acceptance-evidence-package.mjs");
    const readme = readText("README.md");

    expect(pkg.scripts?.["acceptance:validate-evidence"]).toBe("node scripts/validate-acceptance-evidence-package.mjs");
    expect(script).toContain("manual-acceptance-evidence-package.json");
    expect(script).toContain("XHS_ACCEPTANCE_EVIDENCE_PATH");
    expect(script).toContain("validatedAt");
    expect(script).toContain("operator");
    expect(script).toContain("evidenceFields");
    expect(script).toContain("No MCP, model, publish, or schedule action was triggered");
    expect(script).not.toContain("/api/publish");
    expect(script).not.toContain("/api/chat");
    expect(script).not.toContain("/api/workflows/one-click");
    expect(readme).toContain("npm run acceptance:validate-evidence");
    expect(readme).toContain("只校验本地 JSON");
    expect(readme).toContain("only validates the local JSON file");
  });
});
