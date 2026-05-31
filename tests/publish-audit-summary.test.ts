import { describe, expect, it } from "vitest";
import { buildPublishAuditSafetySummary } from "@/app/components/publish-audit-summary";
import { defaultSettings } from "@/app/config/default-settings";
import type { PublishAuditRecord } from "@/app/types";

const baseAudit: PublishAuditRecord = {
  id: "audit-1",
  createdAt: "2026-05-31T12:00:00.000Z",
  event: "awaiting_approval",
  status: "awaiting_approval",
  requestedBy: "manual",
  title: "广州咖啡馆避坑指南",
  contentHash: "hash",
  tags: ["广州咖啡"],
  imageCount: 2,
  visibility: "仅自己可见",
  accountId: defaultSettings.activeAccountId,
  mcpUrl: defaultSettings.mcpUrl,
  publishIntentId: "intent-1",
  reasons: [],
  evidenceCitationSummary: {
    summary: "字段级证据可追溯",
    missingEvidenceIds: [],
    warnings: [],
    sourceCounts: { realtime: 2 },
    fieldCounts: { title: 1, content: 1, tags: 1, imagePrompt: 1 }
  }
};

describe("publish audit safety summary", () => {
  it("returns a quiet empty state when the current post has no audit record", () => {
    const summary = buildPublishAuditSafetySummary({
      audits: [],
      settings: defaultSettings,
      currentTitle: "广州咖啡馆避坑指南"
    });

    expect(summary.state).toBe("neutral");
    expect(summary.eventLabel).toBe("未记录");
    expect(summary.shouldReviewHistory).toBe(false);
    expect(summary.headline).toContain("还没有");
  });

  it("matches by publish intent id before title and shows approval state", () => {
    const summary = buildPublishAuditSafetySummary({
      audits: [{ ...baseAudit, title: "旧标题" }],
      settings: defaultSettings,
      currentTitle: "新标题",
      publishIntentId: "intent-1"
    });

    expect(summary.state).toBe("neutral");
    expect(summary.eventLabel).toBe("待人工确认");
    expect(summary.title).toBe("旧标题");
    expect(summary.evidenceLine).toContain("字段级证据可追溯");
  });

  it("surfaces blocked and failed audit reasons as warnings", () => {
    const summary = buildPublishAuditSafetySummary({
      audits: [{
        ...baseAudit,
        event: "failed",
        status: "failed",
        reasons: ["MCP tools/call timed out", "账号未确认"]
      }],
      settings: defaultSettings,
      currentTitle: "广州咖啡馆避坑指南"
    });

    expect(summary.state).toBe("warn");
    expect(summary.eventLabel).toBe("失败");
    expect(summary.reasonLine).toContain("MCP tools/call timed out");
    expect(summary.shouldReviewHistory).toBe(true);
  });

  it("ignores audit records from another active account unless intent id matches", () => {
    const summary = buildPublishAuditSafetySummary({
      audits: [{
        ...baseAudit,
        accountId: "other-account",
        mcpUrl: "http://localhost:18061/mcp"
      }],
      settings: defaultSettings,
      currentTitle: "广州咖啡馆避坑指南"
    });

    expect(summary.eventLabel).toBe("未记录");
  });
});
