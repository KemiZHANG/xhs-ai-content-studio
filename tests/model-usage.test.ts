import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { consumeModelUsage, readTodayModelUsage } from "@/lib/storage/model-usage";

const originalCwd = process.cwd();

describe("model usage limits", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "xhs-model-usage-"));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it("tracks daily text and image calls and blocks when the local limit is reached", async () => {
    await consumeModelUsage("text", 2);
    await consumeModelUsage("text", 2);
    await consumeModelUsage("image", 1);

    await expect(consumeModelUsage("text", 2)).rejects.toThrow("Daily text model call limit reached");
    await expect(consumeModelUsage("image", 1)).rejects.toThrow("Daily image model call limit reached");
    await expect(readTodayModelUsage()).resolves.toEqual(
      expect.objectContaining({
        text: 2,
        image: 1
      })
    );
  });
});
