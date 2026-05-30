import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  executeGuardedPublish,
  getPublishIntent,
  isPublishIntentConfirmable,
  publishIntentMatchesArgs
} from "@/lib/agent/publishing";
import { readWorkspaceState } from "@/lib/agent/state";
import { defaultSettings } from "@/lib/storage/settings";

const originalCwd = process.cwd();
const citationSummary = {
  summary: "参考证据：实时研究 1 条。",
  missingEvidenceIds: [],
  warnings: [],
  sourceCounts: { realtime: 1, viral_library: 0, user_input: 0 },
  fieldCounts: { title: 1, content: 1, tags: 1, imagePrompt: 1 }
};
const versionSnapshot = {
  copyVersionId: "copy-draft-1",
  imagePromptVersionIds: ["prompt-1"],
  selectedImageIds: ["asset-1"],
  qualityGateFresh: true,
  qualityCanPublish: true,
  finalPostMatchesCanvas: true,
  summary: "当前最终帖子和 Quality Gate 与画布一致",
  warnings: []
};

describe("agent guarded publishing", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "xhs-agent-publishing-"));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  function publishArgs() {
    return {
      title: "A useful title",
      content: "Original body content",
      tags: ["tag"],
      images: [path.join(tempDir, "generated-assets", "generated", "image.png")],
      visibility: defaultSettings.defaultVisibility
    };
  }

  it("keeps review-required publishing as an approval intent without calling MCP", async () => {
    let calls = 0;
    const result = await executeGuardedPublish({
      args: publishArgs(),
      requestedBy: "chat",
      policy: { mode: "review_required" },
      publishContext: {
        evidenceCitationSummary: citationSummary,
        versionSnapshot
      },
      publish: async () => {
        calls += 1;
        return { ok: true };
      }
    });

    const workspace = await readWorkspaceState();

    expect(calls).toBe(0);
    expect(result.status).toBe("awaiting_approval");
    expect(result.publishIntent.status).toBe("awaiting_approval");
    expect(result.publishIntent.evidenceCitationSummary?.fieldCounts.title).toBe(1);
    expect(result.publishIntent.versionSnapshot).toMatchObject({
      copyVersionId: "copy-draft-1",
      qualityGateFresh: true
    });
    expect((result.publishIntent.confirmationChecklist ?? []).filter((item) => item.required).every((item) => item.confirmed === false)).toBe(true);
    expect(await getPublishIntent(result.publishIntent.id)).toEqual(result.publishIntent);
    expect(publishIntentMatchesArgs(result.publishIntent, publishArgs())).toBe(true);
    expect(workspace.publishPlan?.status).toBe("awaiting_approval");
  });

  it("publishes after confirmation and blocks duplicate successful publish intents", async () => {
    let calls = 0;
    const args = publishArgs();

    const first = await executeGuardedPublish({
      args,
      requestedBy: "manual",
      policy: { mode: "review_required", confirmed: true },
      publish: async () => {
        calls += 1;
        return { ok: true };
      }
    });
    const duplicate = await executeGuardedPublish({
      args,
      requestedBy: "manual",
      policy: { mode: "review_required", confirmed: true },
      publish: async () => {
        calls += 1;
        return { ok: true };
      }
    });

    expect(first.status).toBe("published");
    expect(first.publishResult).toEqual({ ok: true });
    expect((first.publishIntent.confirmationChecklist ?? []).filter((item) => item.required).every((item) => item.confirmed === true)).toBe(true);
    expect(duplicate.status).toBe("blocked");
    expect(duplicate.reasons.join(" ")).toContain("duplicate");
    expect(calls).toBe(1);
  });

  it("expires old publish confirmations before they can authorize external publishing", async () => {
    const result = await executeGuardedPublish({
      args: publishArgs(),
      requestedBy: "manual",
      policy: { mode: "review_required" },
      publish: async () => ({ ok: true })
    });

    expect(isPublishIntentConfirmable(result.publishIntent, publishArgs(), {
      now: new Date(Date.parse(result.publishIntent.requestedAt) + 31 * 60 * 1000),
      maxAgeMinutes: 30
    })).toBe(false);
  });

  it("allows fresh matching manual confirmations", async () => {
    const result = await executeGuardedPublish({
      args: publishArgs(),
      requestedBy: "manual",
      policy: { mode: "review_required" },
      publish: async () => ({ ok: true })
    });

    expect(isPublishIntentConfirmable(result.publishIntent, publishArgs(), {
      now: new Date(Date.parse(result.publishIntent.requestedAt) + 3 * 60 * 1000),
      maxAgeMinutes: 30
    })).toBe(true);
  });

  it("expires publish confirmations when evidence citations change", async () => {
    const args = publishArgs();
    const result = await executeGuardedPublish({
      args,
      requestedBy: "manual",
      policy: { mode: "review_required" },
      publishContext: {
        evidenceCitationSummary: citationSummary
      },
      publish: async () => ({ ok: true })
    });

    expect(isPublishIntentConfirmable(result.publishIntent, args, {
      evidenceCitationSummary: citationSummary
    })).toBe(true);
    expect(isPublishIntentConfirmable(result.publishIntent, args)).toBe(false);
    expect(isPublishIntentConfirmable(result.publishIntent, args, {
      evidenceCitationSummary: {
        ...citationSummary,
        fieldCounts: { ...citationSummary.fieldCounts, imagePrompt: 0 }
      }
    })).toBe(false);
  });

  it("binds publish confirmations to the active Xiaohongshu account", async () => {
    const args = publishArgs();
    const result = await executeGuardedPublish({
      args,
      requestedBy: "manual",
      policy: { mode: "review_required" },
      auditContext: {
        accountId: "account-a",
        mcpUrl: "http://localhost:18060/mcp"
      },
      publish: async () => ({ ok: true })
    });

    expect(result.publishIntent.accountId).toBe("account-a");
    expect(
      isPublishIntentConfirmable(result.publishIntent, args, {
        accountContext: {
          accountId: "account-a",
          mcpUrl: "http://localhost:18060/mcp"
        }
      })
    ).toBe(true);
    expect(
      isPublishIntentConfirmable(result.publishIntent, args, {
        accountContext: {
          accountId: "account-b",
          mcpUrl: "http://localhost:18061/mcp"
        }
      })
    ).toBe(false);
  });

  it("does not treat the same content on different accounts as duplicate publishing", async () => {
    let calls = 0;
    const args = publishArgs();

    const first = await executeGuardedPublish({
      args,
      requestedBy: "manual",
      policy: { mode: "review_required", confirmed: true },
      auditContext: {
        accountId: "account-a",
        mcpUrl: "http://localhost:18060/mcp"
      },
      publish: async () => {
        calls += 1;
        return { ok: true };
      }
    });
    const second = await executeGuardedPublish({
      args,
      requestedBy: "manual",
      policy: { mode: "review_required", confirmed: true },
      auditContext: {
        accountId: "account-b",
        mcpUrl: "http://localhost:18061/mcp"
      },
      publish: async () => {
        calls += 1;
        return { ok: true };
      }
    });

    expect(first.status).toBe("published");
    expect(second.status).toBe("published");
    expect(calls).toBe(2);
  });

  it("blocks concurrent identical publish calls before both can reach MCP", async () => {
    let calls = 0;
    let releasePublish: (() => void) | undefined;
    const publishStarted = new Promise<void>((resolve) => {
      releasePublish = resolve;
    });
    const slowPublish = async () => {
      calls += 1;
      await publishStarted;
      return { ok: true };
    };

    const args = publishArgs();
    const first = executeGuardedPublish({
      args,
      requestedBy: "manual",
      policy: { mode: "review_required", confirmed: true },
      publish: slowPublish
    });
    const second = executeGuardedPublish({
      args,
      requestedBy: "manual",
      policy: { mode: "review_required", confirmed: true },
      publish: slowPublish
    });

    await new Promise((resolve) => setTimeout(resolve, 25));
    releasePublish?.();
    const results = await Promise.all([first, second]);

    expect(results.map((item) => item.status).sort()).toEqual(["blocked", "published"]);
    expect(calls).toBe(1);
  });
});
