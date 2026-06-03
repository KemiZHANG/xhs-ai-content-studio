import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readText = (path: string) => readFileSync(join(root, path), "utf8");

describe("acceptance completion matrix export script", () => {
  it("exports only the read-only completion matrix", () => {
    const pkg = JSON.parse(readText("package.json")) as { scripts?: Record<string, string> };
    const script = readText("scripts/export-acceptance-completion-matrix.mjs");
    const readme = readText("README.md");

    expect(pkg.scripts?.["acceptance:completion-matrix"]).toBe("node scripts/export-acceptance-completion-matrix.mjs");
    expect(script).toContain("/api/acceptance/status");
    expect(script).toContain("completionMatrix");
    expect(script).toContain("acceptance-completion-matrix.json");
    expect(script).toContain("XHS_ACCEPTANCE_MATRIX_PATH");
    expect(script).toContain("manual external gates must remain non-automatable");
    expect(script).toContain("No MCP, model, publish, or schedule action was triggered");
    expect(script).not.toContain("/api/publish");
    expect(script).not.toContain("/api/chat");
    expect(script).not.toContain("/api/workflows/one-click");
    expect(script).not.toContain("/api/assets/generate");
    expect(readme).toContain("npm run acceptance:completion-matrix");
    expect(readme).toContain("data/acceptance-completion-matrix.json");
    expect(readme).toContain("XHS_ACCEPTANCE_MATRIX_PATH");
    expect(readme).toContain("machine-readable JSON");
  });
});
