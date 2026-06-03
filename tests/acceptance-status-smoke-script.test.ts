import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readText = (path: string) => readFileSync(join(root, path), "utf8");

describe("acceptance status smoke script", () => {
  it("is exposed as a read-only completion and manual-gate check", () => {
    const pkg = JSON.parse(readText("package.json")) as { scripts?: Record<string, string> };
    const script = readText("scripts/acceptance-status-smoke.mjs");

    expect(pkg.scripts?.["smoke:acceptance-status"]).toBe("node scripts/acceptance-status-smoke.mjs");
    expect(pkg.scripts?.["smoke:safe"]).toContain("npm run smoke:acceptance-status");
    expect(script).toContain("/api/acceptance/status");
    expect(script).toContain("/api/acceptance/validation-records");
    expect(script).toContain("Validation records");
    expect(script).toContain("records payload");
    expect(script).toContain("disagree on canMarkComplete");
    expect(script).toContain("deliverySummary");
    expect(script).toContain("evidencePackage");
    expect(script).toContain("schemaVersion");
    expect(script).toContain("manualOnly");
    expect(script).toContain("evidenceRecordTemplate");
    expect(script).toContain("completionPercent !== 99");
    expect(script).toContain("canMarkComplete must stay false");
    expect(script).toContain("safeToAutomateCompletion");
    expect(script).toContain("canBeAutomated");
    expect(script).toContain("proofRequired");
    expect(script).toContain("checklist");
    expect(script).toContain("executable checklist");
    expect(script).toContain("evidenceFields");
    expect(script).toContain("evidence field templates");
    expect(script).toContain("nextManualGateId");
    expect(script).toContain("nextSafeCommand");
    expect(script).toContain("real_publish");
    expect(script).toContain("scheduled_publish");
    expect(script).toContain("multi_account_switching");
    expect(script).toContain("no MCP, model, publish, or schedule action was triggered");
    expect(script).not.toContain("/api/publish");
    expect(script).not.toContain("/api/chat");
    expect(script).not.toContain("/api/workflows/one-click");
  });
});
