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
    expect(pkg.scripts?.["acceptance:status"]).toBe("node scripts/acceptance-status-smoke.mjs");
    expect(pkg.scripts?.["smoke:safe"]).toContain("npm run smoke:acceptance-status");
    expect(script).toContain("/api/acceptance/status");
    expect(script).toContain("/api/acceptance/validation-records");
    expect(script).toContain("/api/acceptance/completion-matrix");
    expect(script).toContain("Validation records");
    expect(script).toContain("ok completionMatrix payload");
    expect(script).toContain("records payload");
    expect(script).toContain("validation records endpoint is missing completionMatrix");
    expect(script).toContain("disagree on canMarkComplete");
    expect(script).toContain("validation records endpoint and status endpoint disagree on completionMatrix completionPercent");
    expect(script).toContain("deliverySummary");
    expect(script).toContain("evidencePackage");
    expect(script).toContain("completionMatrix");
    expect(script).toContain("Completion matrix");
    expect(script).toContain("dedicated completion matrix endpoint and status endpoint disagree on completionPercent");
    expect(script).toContain("dedicated completion matrix endpoint and status endpoint disagree on remainingWork");
    expect(script).toContain("remaining work does not match pending manual gates");
    expect(script).toContain("schemaVersion");
    expect(script).toContain("manualOnly");
    expect(script).toContain("evidenceRecordTemplate");
    expect(script).toContain("expectedCompletionPercent");
    expect(script).toContain("allManualGatesValidated");
    expect(script).toContain("completionPercent should be");
    expect(script).toContain("canMarkComplete must match whether every manual external gate has a valid record");
    expect(script).toContain("safeToAutomateCompletion must match whether every manual external gate has a valid record");
    expect(script).toContain("nextManualGateId should point to the first pending manual gate");
    expect(script).toContain("evidencePackage canMarkComplete must match whether every manual external gate has a valid record");
    expect(script).toContain("canBeAutomated");
    expect(script).toContain("proofRequired");
    expect(script).toContain("checklist");
    expect(script).toContain("executable checklist");
    expect(script).toContain("evidenceFields");
    expect(script).toContain("evidence field templates");
    expect(script).toContain("nextManualGateId");
    expect(script).toContain("nextSafeCommand");
    expect(script).toContain("npm run acceptance:record-evidence");
    expect(script).toContain("npm run acceptance:export-records");
    expect(script).toContain("real_publish");
    expect(script).toContain("scheduled_publish");
    expect(script).toContain("multi_account_switching");
    expect(script).toContain("no MCP, model, publish, or schedule action was triggered");
    expect(script).not.toContain("/api/publish");
    expect(script).not.toContain("/api/chat");
    expect(script).not.toContain("/api/workflows/one-click");
  });

  it("documents the friendlier acceptance status command", () => {
    const readme = readText("README.md");

    expect(readme).toContain("npm run acceptance:status");
    expect(readme).toContain("npm run smoke:acceptance-status");
    expect(readme).toContain("current completion and external manual gates");
  });
});
