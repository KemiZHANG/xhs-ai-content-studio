import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildCardPages,
  renderXhsCardSet,
  type CardRasterizer
} from "@/lib/cards/renderer";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "xhs-cards-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("card renderer", () => {
  it("creates a cover plus manually separated content cards", () => {
    const pages = buildCardPages({
      title: "广州咖啡馆",
      subtitle: "一周收藏趋势",
      body: "第一张内容\n---\n第二张内容",
      tags: ["咖啡", "探店"],
      mode: "separator"
    });

    expect(pages.map((page) => page.kind)).toEqual(["cover", "content", "content"]);
    expect(pages[0].title).toBe("广州咖啡馆");
    expect(pages[1].body).toContain("第一张内容");
    expect(pages[2].body).toContain("第二张内容");
  });

  it("renders card pages into publishable png files with stable names", async () => {
    const rasterizer: CardRasterizer = async ({ outputPath, html }) => {
      expect(html).toContain("广州咖啡馆");
      await writeFile(outputPath, "png-bytes");
    };

    const result = await renderXhsCardSet(
      {
        title: "广州咖啡馆",
        subtitle: "真实探店收藏版",
        body: "封面后的第一张卡片\n---\n第二张卡片",
        tags: ["广州咖啡", "周末探店"],
        theme: "sketch",
        mode: "separator",
        width: 1080,
        height: 1440
      },
      { outputDir: tempDir, rasterizer }
    );

    expect(result.files).toHaveLength(3);
    expect(result.files.map((file) => path.basename(file.absolutePath))).toEqual([
      expect.stringContaining("cover.png"),
      expect.stringContaining("card-1.png"),
      expect.stringContaining("card-2.png")
    ]);
    await expect(readFile(result.files[0].absolutePath, "utf8")).resolves.toBe("png-bytes");
  });
});
