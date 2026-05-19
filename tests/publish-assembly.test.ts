import { describe, expect, it } from "vitest";
import { buildPublishContentArgs, validatePublishAssembly } from "@/lib/publishing/assembly";
import type { AssetRecord } from "@/lib/storage/assets";

const imageAsset: AssetRecord = {
  id: "asset-1",
  kind: "generated",
  name: "coffee-cover",
  originalName: "coffee-cover.png",
  absolutePath: "C:\\tmp\\coffee-cover.png",
  mimeType: "image/png",
  size: 100,
  createdAt: "2026-05-18T00:00:00.000Z"
};

describe("publish assembly", () => {
  it("validates the final post before publishing", () => {
    expect(
      validatePublishAssembly({
        title: "",
        content: "正文",
        tags: ["咖啡"],
        visibility: "仅自己可见",
        assets: [imageAsset]
      })
    ).toEqual(["请填写标题"]);

    expect(
      validatePublishAssembly({
        title: "广州咖啡馆",
        content: "正文",
        tags: ["咖啡"],
        visibility: "仅自己可见",
        assets: []
      })
    ).toEqual(["请至少选择一张要发布的图片"]);
  });

  it("builds xiaohongshu publish args from selected copy and images", () => {
    const args = buildPublishContentArgs({
      title: "广州咖啡馆",
      content: "原创正文",
      tags: ["广州咖啡", "探店"],
      visibility: "仅自己可见",
      scheduleAt: "2026-05-19T20:00",
      assets: [imageAsset]
    });

    expect(args).toEqual({
      title: "广州咖啡馆",
      content: "原创正文",
      tags: ["广州咖啡", "探店"],
      images: ["C:\\tmp\\coffee-cover.png"],
      visibility: "仅自己可见",
      scheduleAt: "2026-05-19T20:00:00+08:00"
    });
  });
});
