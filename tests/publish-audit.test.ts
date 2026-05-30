import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendPublishAudit, listPublishAudit } from "@/lib/storage/publish-audit";

const originalCwd = process.cwd();

describe("publish audit storage", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "xhs-publish-audit-"));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it("records publish events without storing the full body content", async () => {
    await appendPublishAudit({
      event: "preview",
      status: "preview",
      requestedBy: "manual",
      title: "A launch note",
      content: "Sensitive draft body should not be stored in full",
      tags: ["tag"],
      imageCount: 2,
      visibility: "private",
      evidenceCitationSummary: {
        summary: "参考证据：实时研究 1 条。",
        missingEvidenceIds: [],
        warnings: [],
        sourceCounts: { realtime: 1 },
        fieldCounts: { title: 1, content: 1, tags: 1, imagePrompt: 1 }
      },
      reasons: []
    });

    const audit = await listPublishAudit();
    const serialized = JSON.stringify(audit);

    expect(audit).toHaveLength(1);
    expect(audit[0]).toEqual(
      expect.objectContaining({
        event: "preview",
        title: "A launch note",
        contentHash: expect.any(String),
        evidenceCitationSummary: expect.objectContaining({
          summary: "参考证据：实时研究 1 条。"
        })
      })
    );
    expect(serialized).not.toContain("Sensitive draft body should not be stored in full");
  });

  it("exposes audit records through the publish audit route", async () => {
    await appendPublishAudit({
      event: "blocked",
      status: "blocked",
      requestedBy: "workflow",
      title: "Blocked note",
      content: "body",
      tags: [],
      imageCount: 0,
      visibility: "private",
      reasons: ["missing image"]
    });

    const { GET } = await import("@/app/api/publish/audit/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.audit[0]).toEqual(
      expect.objectContaining({
        event: "blocked",
        title: "Blocked note",
        reasons: ["missing image"]
      })
    );
  });

  it("redacts legacy content fields when reading old audit files", async () => {
    const auditFile = path.join(tempDir, "data", "publish-audit.json");
    await mkdir(path.dirname(auditFile), { recursive: true });
    await writeFile(
      auditFile,
      JSON.stringify([
        {
          id: "audit-legacy",
          createdAt: "2026-05-25T00:00:00.000Z",
          event: "publishing",
          status: "publishing",
          requestedBy: "workflow",
          title: "Legacy note",
          content: "legacy full draft body",
          contentHash: "hash",
          tags: [],
          imageCount: 1,
          visibility: "private",
          reasons: []
        }
      ]),
      "utf8"
    );

    const audit = await listPublishAudit();

    expect(JSON.stringify(audit)).not.toContain("legacy full draft body");
    expect(audit[0]).toEqual(
      expect.not.objectContaining({
        content: expect.any(String)
      })
    );
  });
});
