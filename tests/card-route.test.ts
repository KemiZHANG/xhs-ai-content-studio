import { describe, expect, it, vi } from "vitest";

const jsonRequest = (body: unknown) =>
  new Request("http://localhost/api/assets/cards", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" }
  });

describe("card generation route", () => {
  it("renders card files and saves them as generated assets", async () => {
    vi.resetModules();
    const saveAsset = vi.fn(async (asset) => asset);
    vi.doMock("@/lib/security/action-token", () => ({
      requireLocalActionToken: vi.fn(async () => null)
    }));
    vi.doMock("@/lib/cards/renderer", () => ({
      renderXhsCardSet: vi.fn(async () => ({
        theme: "sketch",
        mode: "separator",
        width: 1080,
        height: 1440,
        pages: [{ kind: "cover" }, { kind: "content" }],
        files: [
          { kind: "cover", title: "封面卡片", absolutePath: "C:\\tmp\\cover.png", mimeType: "image/png", size: 10, pageIndex: 0 },
          { kind: "content", title: "正文卡片 1", absolutePath: "C:\\tmp\\card-1.png", mimeType: "image/png", size: 10, pageIndex: 1 }
        ]
      }))
    }));
    vi.doMock("@/lib/storage/assets", () => ({
      createAssetRecord: vi.fn((input) => ({
        id: `asset-${input.originalName}`,
        name: input.originalName,
        ...input
      })),
      saveAsset,
      toPublicAssetRecord: vi.fn((asset) => ({
        id: asset.id,
        kind: asset.kind,
        name: asset.name,
        originalName: asset.originalName,
        mimeType: asset.mimeType,
        size: asset.size,
        createdAt: asset.createdAt,
        url: `/api/assets/file/${asset.id}`
      }))
    }));

    const { POST } = await import("@/app/api/assets/cards/route");
    const response = await POST(
      jsonRequest({
        title: "广州咖啡馆",
        subtitle: "一周收藏趋势",
        body: "第一张\n---\n第二张",
        tags: ["咖啡"],
        theme: "sketch",
        mode: "separator"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.assets).toHaveLength(2);
    expect(saveAsset).toHaveBeenCalledTimes(2);
    expect(payload.assets[0].id).toContain("xhs-card-cover");
  });
});
