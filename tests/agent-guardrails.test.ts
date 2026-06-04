import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  authorizePublishIntent,
  confirmPublishIntentChecklist,
  createPublishIntent,
  isSafePublishImagePath,
  validatePublishIntent
} from "@/lib/agent/guardrails";
import { defaultSettings } from "@/lib/storage/settings";

const baseIntent = () =>
  createPublishIntent({
    title: "A useful title",
    content: "Body content",
    tags: ["tag"],
    images: [path.join(process.cwd(), "generated-assets", "generated", "image.png")],
    visibility: defaultSettings.defaultVisibility,
    requestedBy: "chat"
  });

const freshVersionSnapshot = () => ({
  copyVersionId: "copy-draft-1",
  imagePromptVersionIds: ["prompt-1"],
  selectedImageIds: ["image-1"],
  finalPostEvidenceIds: ["insight-1"],
  qualityGateFresh: true,
  qualityCanPublish: true,
  finalPostMatchesCanvas: true,
  summary: "版本已锁定",
  warnings: []
});

describe("agent publish guardrails", () => {
  it("blocks direct publishing in draft-only mode", () => {
    const decision = authorizePublishIntent(baseIntent(), { mode: "draft_only" });

    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("blocked");
    expect(decision.reasons.join(" ")).toContain("draft");
  });

  it("requires approval in review-required mode", () => {
    const intent = baseIntent();
    const decision = authorizePublishIntent(intent, { mode: "review_required" });

    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("awaiting_approval");
    expect((intent.confirmationChecklist ?? []).filter((item) => item.required).every((item) => item.confirmed === false)).toBe(true);
  });

  it("shows a readable account label in publish confirmations without changing idempotency", () => {
    const base = baseIntent();
    const labeled = createPublishIntent({
      title: base.title,
      content: base.content,
      tags: base.tags,
      images: base.images,
      visibility: base.visibility,
      accountId: "account-a",
      accountLabel: "探店账号",
      mcpUrl: "http://localhost:18060/mcp",
      requestedBy: "chat"
    });
    const unlabeled = createPublishIntent({
      title: base.title,
      content: base.content,
      tags: base.tags,
      images: base.images,
      visibility: base.visibility,
      accountId: "account-a",
      mcpUrl: "http://localhost:18060/mcp",
      requestedBy: "chat"
    });

    expect(labeled.confirmationChecklist?.find((item) => item.id === "account")?.detail).toContain("探店账号");
    expect(labeled.idempotencyKey).toBe(unlabeled.idempotencyKey);
  });

  it("still requires a one-time approval in auto-publish mode", () => {
    const decision = authorizePublishIntent(baseIntent(), { mode: "auto_publish_allowed" });

    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("awaiting_approval");
  });

  it("allows publish-ready content after explicit confirmation", () => {
    const intent = confirmPublishIntentChecklist(baseIntent());
    const decision = authorizePublishIntent(intent, { mode: "auto_publish_allowed", confirmed: true });

    expect(decision.allowed).toBe(true);
    expect(decision.status).toBe("approved");
    expect((intent.confirmationChecklist ?? []).map((item) => item.label)).toEqual(
      expect.arrayContaining(["最终文案版本", "最终图片版本", "图片方向 / Prompt", "发布账号", "可见范围", "Quality Gate"])
    );
  });

  it("blocks explicit confirmation when required checklist items are still unchecked", () => {
    const intent = baseIntent();
    const decision = authorizePublishIntent(intent, { mode: "auto_publish_allowed", confirmed: true });

    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("blocked");
    expect(decision.reasons.join(" ")).toContain("confirmation checklist");
  });

  it("requires confirming visual direction before real external publishing", () => {
    const intent = baseIntent();
    const visualItem = (intent.confirmationChecklist ?? []).find((item) => item.id === "visual");

    expect(visualItem).toMatchObject({
      label: "图片方向 / Prompt",
      required: true,
      confirmed: false
    });
    expect(visualItem?.detail).toContain("CreativeBrief");
  });

  it("stores final copy, image, and prompt version details in the confirmation checklist", () => {
    const intent = createPublishIntent({
      ...baseIntent(),
      versionSnapshot: freshVersionSnapshot()
    });

    expect(intent.confirmationChecklist?.find((item) => item.id === "copy")?.detail).toContain("copy-draft-1");
    expect(intent.confirmationChecklist?.find((item) => item.id === "images")?.detail).toContain("1 张图");
    expect(intent.confirmationChecklist?.find((item) => item.id === "visual")?.detail).toContain("Prompt 版本 1");
  });

  it("blocks publish intents when the version snapshot is stale or incomplete", () => {
    const staleIntent = createPublishIntent({
      ...baseIntent(),
      versionSnapshot: {
        ...freshVersionSnapshot(),
        finalPostMatchesCanvas: false,
        warnings: ["最终帖子快照已落后"]
      }
    });
    const noEvidenceIntent = createPublishIntent({
      ...baseIntent(),
      versionSnapshot: {
        ...freshVersionSnapshot(),
        finalPostEvidenceIds: []
      }
    });
    const noImagePromptIntent = createPublishIntent({
      ...baseIntent(),
      versionSnapshot: {
        ...freshVersionSnapshot(),
        imagePromptVersionIds: []
      }
    });

    expect(validatePublishIntent(staleIntent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("current PostProject canvas"),
        expect.stringContaining("unresolved warnings")
      ])
    );
    expect(authorizePublishIntent(staleIntent, { mode: "auto_publish_allowed", confirmed: true })).toMatchObject({
      allowed: false,
      status: "blocked"
    });
    expect(validatePublishIntent(noEvidenceIntent)).toEqual(
      expect.arrayContaining([expect.stringContaining("final post evidence ids")])
    );
    expect(validatePublishIntent(noImagePromptIntent)).toEqual(
      expect.arrayContaining([expect.stringContaining("image prompt version ids")])
    );
  });

  it("stores evidence citation summaries on publish intents", () => {
    const intent = createPublishIntent({
      ...baseIntent(),
      evidenceCitationSummary: {
        summary: "参考证据：实时研究 2 条、爆款库 1 条。",
        missingEvidenceIds: [],
        warnings: [],
        sourceCounts: { realtime: 2, viral_library: 1, user_input: 0 },
        fieldCounts: { title: 1, content: 2, tags: 1, imagePrompt: 1 }
      }
    });

    expect(intent.evidenceCitationSummary?.fieldCounts.imagePrompt).toBe(1);
    expect(intent.confirmationChecklist?.find((item) => item.id === "quality")?.detail).toContain("实时研究");
  });

  it("blocks publish intents with incomplete evidence citation coverage", () => {
    const missingIdIntent = createPublishIntent({
      ...baseIntent(),
      evidenceCitationSummary: {
        summary: "missing evidence",
        missingEvidenceIds: ["old-insight"],
        warnings: [],
        sourceCounts: { realtime: 1, viral_library: 0, user_input: 0 },
        fieldCounts: { title: 1, content: 1, tags: 1, imagePrompt: 1 }
      }
    });
    const missingFieldIntent = createPublishIntent({
      ...baseIntent(),
      evidenceCitationSummary: {
        summary: "missing image prompt evidence",
        missingEvidenceIds: [],
        warnings: [],
        sourceCounts: { realtime: 1, viral_library: 0, user_input: 0 },
        fieldCounts: { title: 1, content: 1, tags: 1, imagePrompt: 0 }
      }
    });

    expect(validatePublishIntent(missingIdIntent)).toEqual(
      expect.arrayContaining([expect.stringContaining("current evidencePack")])
    );
    expect(validatePublishIntent(missingFieldIntent)).toEqual(
      expect.arrayContaining([expect.stringContaining("imagePrompt")])
    );
    expect(authorizePublishIntent(missingFieldIntent, { mode: "auto_publish_allowed", confirmed: true })).toMatchObject({
      allowed: false,
      status: "blocked"
    });
  });

  it("marks schedule confirmation as required only for scheduled publish intents", () => {
    const manual = baseIntent();
    const scheduled = createPublishIntent({
      ...baseIntent(),
      mode: "scheduled",
      scheduleAt: "2099-05-21T12:00:00+08:00"
    });

    expect((manual.confirmationChecklist ?? []).find((item) => item.id === "schedule")?.required).toBe(false);
    expect((scheduled.confirmationChecklist ?? []).find((item) => item.id === "schedule")?.required).toBe(true);
    expect(scheduled.scheduleTimezone).toBe("+08:00");
    expect((scheduled.confirmationChecklist ?? []).find((item) => item.id === "schedule")?.detail).toContain("时区 +08:00");
  });

  it("rejects scheduled publishing without a future schedule time", () => {
    const intent = createPublishIntent({
      ...baseIntent(),
      mode: "scheduled",
      scheduleAt: "2020-01-01T00:00:00+08:00"
    });

    const errors = validatePublishIntent(intent, { now: new Date("2026-05-21T00:00:00+08:00") });

    expect(errors.some((error) => error.includes("future"))).toBe(true);
  });

  it("rejects scheduled publishing without a timezone", () => {
    const intent = createPublishIntent({
      ...baseIntent(),
      mode: "scheduled",
      scheduleAt: "2026-05-21T12:00:00"
    });

    const errors = validatePublishIntent(intent, { now: new Date("2026-05-21T00:00:00+08:00") });

    expect(errors.some((error) => error.includes("timezone"))).toBe(true);
  });

  it("rejects publish intents without images or tags", () => {
    const intent = createPublishIntent({
      title: "A useful title",
      content: "Body content",
      tags: [],
      images: [],
      visibility: defaultSettings.defaultVisibility,
      requestedBy: "chat"
    });

    expect(validatePublishIntent(intent)).toEqual(
      expect.arrayContaining([expect.stringContaining("tag"), expect.stringContaining("image")])
    );
  });

  it("rejects unsafe publish image paths", () => {
    expect(isSafePublishImagePath(path.join(process.cwd(), "generated-assets", "generated", "image.png"))).toBe(true);
    expect(isSafePublishImagePath(path.join(process.cwd(), "generated-assets", "uploads", "image.png"))).toBe(true);
    expect(isSafePublishImagePath(path.join(process.cwd(), "generated-assets", "generated", "..", "..", "secret.png"))).toBe(false);
    expect(isSafePublishImagePath(path.join(process.cwd(), "not-generated-assets", "generated", "image.png"))).toBe(false);
    expect(isSafePublishImagePath("https://example.com/image.png")).toBe(false);
  });

  it("denies invalid publish policy values", () => {
    const decision = authorizePublishIntent(baseIntent(), { mode: "not-real" as never });

    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("blocked");
  });
});
