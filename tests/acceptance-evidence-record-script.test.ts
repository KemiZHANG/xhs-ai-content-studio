import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("acceptance evidence record script", () => {
  it("exposes a safe command for importing manual validation records", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const script = readFileSync(join(root, "scripts/import-acceptance-validation-records.mjs"), "utf8");

    expect(pkg.scripts?.["acceptance:record-evidence"]).toBe("node scripts/import-acceptance-validation-records.mjs");
    expect(script).toContain("/api/acceptance/validation-records");
    expect(script).toContain("XHS_ACCEPTANCE_RECORD_DRY_RUN");
    expect(script).toContain("--dry-run");
    expect(script).toContain("validateRecord");
    expect(script).toContain("has incomplete manual evidence");
    expect(script).toContain("validated must be true");
    expect(script).toContain("No local record was written");
    expect(script).toContain("Dry-run would cover manual gate(s)");
    expect(script).toContain("Dry-run missing manual gate(s)");
    expect(script).toContain("evidenceRecordTemplate");
    expect(script).toContain("latestCompletionMatrix");
    expect(script).toContain("Completion after import");
    expect(script).toContain("Can mark complete");
    expect(script).toContain("Remaining manual gate(s)");
    expect(script).toContain("No MCP, model, publish, or schedule action was triggered.");
    expect(script).not.toContain("/api/publish");
    expect(script).not.toContain("/api/assets/generate");
  });

  it("documents the record command in both README languages", () => {
    const readme = readFileSync(join(root, "README.md"), "utf8");

    expect(readme).toContain("npm run acceptance:record-evidence");
    expect(readme).toContain("/api/acceptance/validation-records");
    expect(readme).toContain("只写入本地验收记录");
    expect(readme).toContain("only writes local acceptance records");
  });
});
