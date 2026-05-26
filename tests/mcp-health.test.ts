import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "@/lib/storage/settings";

describe("MCP health route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("maps available MCP tools to agent tool readiness", async () => {
    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings
    }));
    vi.doMock("@/lib/mcp/xhs", () => ({
      readMcpText: () => "logged in",
      createXhsMcpClient: () => ({
        checkLoginStatus: vi.fn(async () => ({ ok: true })),
        listTools: vi.fn(async () => [{ name: "search_feeds" }, { name: "get_feed_detail" }])
      })
    }));

    const { GET } = await import("@/app/api/health/mcp/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.tools).toEqual(["search_feeds", "get_feed_detail"]);
    expect(payload.agentTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "workflow.searchRank",
          runnable: true,
          missingMcpTools: []
        }),
        expect.objectContaining({
          name: "publish.execute",
          runnable: false,
          missingMcpTools: ["publish_content"]
        })
      ])
    );
    expect(payload.activeAccount).toEqual(
      expect.objectContaining({
        id: "local-default",
        displayName: "默认小红书账号",
        status: "logged_in"
      })
    );
  });

  it("extracts the login name from MCP status text", async () => {
    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings
    }));
    vi.doMock("@/lib/mcp/xhs", () => ({
      readMcpText: () => "状态：已登录\n用户名： xiaohongshu-mcp",
      createXhsMcpClient: () => ({
        checkLoginStatus: vi.fn(async () => ({ ok: true })),
        listTools: vi.fn(async () => [])
      })
    }));

    const { GET } = await import("@/app/api/health/mcp/route");
    const response = await GET();
    const payload = await response.json();

    expect(payload.loggedIn).toBe(true);
    expect(payload.activeAccount.loginName).toBe("xiaohongshu-mcp");
  });
});
