import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readText = (path: string) => readFileSync(join(root, path), "utf8");

describe("acceptance evidence package export script", () => {
  it("exports only the read-only acceptance evidence package", () => {
    const pkg = JSON.parse(readText("package.json")) as { scripts?: Record<string, string> };
    const script = readText("scripts/export-acceptance-evidence-package.mjs");
    const readme = readText("README.md");

    expect(pkg.scripts?.["acceptance:evidence-package"]).toBe("node scripts/export-acceptance-evidence-package.mjs");
    expect(script).toContain("/api/acceptance/evidence-package");
    expect(script).not.toContain("/api/acceptance/status");
    expect(script).toContain("evidencePackage");
    expect(script).toContain("manual-acceptance-evidence-package.json");
    expect(script).toContain("XHS_ACCEPTANCE_EVIDENCE_PATH");
    expect(script).toContain("No MCP, model, publish, or schedule action was triggered");
    expect(script).not.toContain("/api/publish");
    expect(script).not.toContain("/api/chat");
    expect(script).not.toContain("/api/workflows/one-click");
    expect(readme).toContain("npm run acceptance:evidence-package");
    expect(readme).toContain("npm run acceptance:validate-evidence");
    expect(readme).toContain("data/manual-acceptance-evidence-package.json");
    expect(readme).toContain("XHS_ACCEPTANCE_EVIDENCE_PATH");
  });
});
