import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildCreatorMemoryContext,
  buildCreatorMemoryDigest,
  readCreatorMemoryProfile,
  updateCreatorMemoryFromTurn
} from "@/lib/agent/memory";

let originalCwd: string;
let tempDir: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await mkdtemp(path.join(os.tmpdir(), "xhs-agent-memory-"));
  process.chdir(tempDir);
  await mkdir("data", { recursive: true });
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("creator memory", () => {
  it("initializes an empty profile per account", async () => {
    const profile = await readCreatorMemoryProfile("account-a");

    expect(profile.accountId).toBe("account-a");
    expect(profile.liked).toEqual([]);
    expect(profile.products).toEqual([]);
  });

  it("extracts explicit preferences and keeps accounts isolated", async () => {
    await updateCreatorMemoryFromTurn({
      accountId: "account-a",
      message: "我喜欢真实分享的语气，不要再写得太像广告。我的产品是低因咖啡豆。",
      assistantAnswer: "好的"
    });
    const accountA = await readCreatorMemoryProfile("account-a");
    const accountB = await readCreatorMemoryProfile("account-b");

    expect(accountA.liked.map((item) => item.text).join("\n")).toContain("我喜欢真实分享");
    expect(accountA.disliked.map((item) => item.text).join("\n")).toContain("不要再写得太像广告");
    expect(accountA.products.map((item) => item.description).join("\n")).toContain("低因咖啡豆");
    expect(accountB.liked).toEqual([]);
  });

  it("builds compact memory context for the chat agent", async () => {
    const profile = await updateCreatorMemoryFromTurn({
      accountId: "account-a",
      message: "风格要真实生活化，不要像广告。",
      currentDraft: {
        id: "draft-1",
        updatedAt: "2026-05-25T00:00:00.000Z",
        draft: {
          title: "通勤包推荐",
          content: "原创正文",
          tags: ["通勤包", "真实分享"],
          structure: ["痛点", "清单"],
          imagePrompt: "真实生活场景"
        },
        images: [],
        visibility: "仅自己可见"
      }
    });

    const context = buildCreatorMemoryContext(profile);

    expect(context).toContain("Creator memory");
    expect(context).toContain("真实生活化");
    expect(context).toContain("#通勤包");
  });

  it("builds a structured digest for Post Studio memory visibility", async () => {
    const profile = await updateCreatorMemoryFromTurn({
      accountId: "account-a",
      message: "我喜欢真实探店感，不要再写得太像广告。我的产品是低因咖啡豆，风格要生活化。",
      currentDraft: {
        id: "draft-1",
        updatedAt: "2026-06-01T00:00:00.000Z",
        draft: {
          title: "低因咖啡豆分享",
          content: "原创正文",
          tags: ["低因咖啡", "真实分享"],
          structure: ["痛点", "体验"],
          imagePrompt: "真实厨房场景"
        },
        images: [],
        visibility: "仅自己可见"
      }
    });

    const digest = buildCreatorMemoryDigest(profile, ["少一点营销感"]);

    expect(digest.active).toBe(true);
    expect(digest.projectHints).toEqual(["少一点营销感"]);
    expect(digest.willUse.join("\n")).toContain("少一点营销感");
    expect(digest.willAvoid.join("\n")).toContain("不要");
    expect(digest.productHints.join("\n")).toContain("低因咖啡豆");
    expect(digest.tagHints).toEqual(expect.arrayContaining(["#低因咖啡", "#真实分享"]));
    expect(digest.signalCount).toBeGreaterThan(0);
  });

  it("returns an empty digest when no stable memory exists yet", () => {
    const digest = buildCreatorMemoryDigest(null, []);

    expect(digest.active).toBe(false);
    expect(digest.signalCount).toBe(0);
    expect(digest.headline).toContain("等待");
  });
});
