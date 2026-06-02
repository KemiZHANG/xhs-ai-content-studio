import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientApi, ClientApiError, getClientActionToken, setClientActionToken } from "@/app/client/api";
import { toSettingsDraft } from "@/app/hooks/use-settings-health";
import { defaultSettings } from "@/lib/storage/settings";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn(async () => body)
  } as unknown as Response;
}

describe("client API helper", () => {
  beforeEach(() => {
    setClientActionToken("");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("attaches JSON headers and the local action token", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true })
    );
    vi.stubGlobal("fetch", fetcher);
    setClientActionToken("token-a");

    const result = await clientApi<{ ok: boolean }>("/api/example", {
      method: "POST",
      body: JSON.stringify({ title: "draft" })
    });

    const headers = fetcher.mock.calls[0][1]?.headers as Headers;
    expect(result.ok).toBe(true);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-XHS-Action-Token")).toBe("token-a");
  });

  it("refreshes the local action token once when a request is rejected", async () => {
    const fetcher = vi
      .fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(200, {}))
      .mockResolvedValueOnce(jsonResponse(403, { error: "本地操作令牌已失效" }))
      .mockResolvedValueOnce(jsonResponse(200, { actionToken: "token-b" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetcher);
    setClientActionToken("token-a");

    const result = await clientApi<{ ok: boolean }>("/api/protected", { method: "POST" });
    const retryHeaders = fetcher.mock.calls[2][1]?.headers as Headers;

    expect(result.ok).toBe(true);
    expect(getClientActionToken()).toBe("token-b");
    expect(retryHeaders.get("X-XHS-Action-Token")).toBe("token-b");
  });

  it("preserves structured error payloads for UI-specific recovery", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(422, {
        error: "没有达到爆款库入库质量门槛的样本",
        candidateReviews: [{
          sampleId: "weak-note",
          shouldSave: false,
          warnings: ["互动数据太低", "正文信息不足"]
        }],
        skippedSampleIds: ["weak-note"]
      })
    );
    vi.stubGlobal("fetch", fetcher);

    await expect(clientApi("/api/viral-knowledge", { method: "POST" })).rejects.toMatchObject({
      name: "ClientApiError",
      status: 422,
      data: expect.objectContaining({
        candidateReviews: expect.arrayContaining([
          expect.objectContaining({ sampleId: "weak-note", shouldSave: false })
        ])
      })
    });
    await expect(clientApi("/api/viral-knowledge", { method: "POST" })).rejects.toBeInstanceOf(ClientApiError);
  });
});

describe("settings draft helper", () => {
  it("keeps public settings but never echoes configured API key sentinels into inputs", () => {
    const draft = toSettingsDraft({
      ...defaultSettings,
      textApiKey: "configured",
      imageApiKey: "configured",
      actionToken: "token"
    });

    expect(draft.mcpUrl).toBe(defaultSettings.mcpUrl);
    expect(draft.textApiKey).toBe("");
    expect(draft.imageApiKey).toBe("");
  });
});
