import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublishAuditPanel } from "@/app/components/xhs-panels";
import type { PublishAuditRecord } from "@/app/types";

describe("publish audit panel", () => {
  it("shows scheduled publish timezone evidence in Publish History", () => {
    const audit: PublishAuditRecord = {
      id: "audit-1",
      createdAt: "2026-06-02T10:00:00.000Z",
      event: "scheduled",
      status: "scheduled",
      requestedBy: "manual",
      title: "广州咖啡馆周末探店",
      contentHash: "abc123",
      tags: ["广州咖啡", "探店"],
      imageCount: 2,
      visibility: "仅自己可见",
      scheduleAt: "2026-06-02T20:00:00+08:00",
      scheduleTimezone: "+08:00",
      accountId: "account-a",
      mcpUrl: "http://localhost:18060/mcp",
      publishIntentId: "publish-1",
      reasons: [],
      evidenceCitationSummary: {
        summary: "字段级证据可追溯",
        missingEvidenceIds: [],
        warnings: [],
        sourceCounts: { realtime: 1, viral_library: 1, user_input: 0 },
        fieldCounts: { title: 1, content: 1, tags: 1, imagePrompt: 1 },
        viralEvidenceTrace: [{
          caseId: "viral-case-1",
          sourceSampleId: "source-note-1",
          sourceUrl: "https://example.com/source-note-1",
          score: 0.89,
          matchedQueries: ["咖啡馆 避坑"],
          reasons: ["semantic match"],
          evidenceInsightIds: ["viral-insight-1"]
        }]
      }
    };

    const html = renderToStaticMarkup(createElement(PublishAuditPanel, {
      audits: [audit],
      onReload: () => undefined
    }));

    expect(html).toContain("发布审计");
    expect(html).toContain("定时 2026-06-02T20:00:00+08:00");
    expect(html).toContain("+08:00");
    expect(html).toContain("确认单：publish-1");
    expect(html).toContain("爆款追溯 1 条：viral-case-1/source-note-1");
  });
});
