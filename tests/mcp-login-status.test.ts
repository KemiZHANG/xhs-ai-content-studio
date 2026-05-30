import { describe, expect, it } from "vitest";
import { isExplicitXhsLoggedInStatus, isExplicitXhsLoggedOutStatus } from "@/lib/mcp/login-status";

describe("XHS MCP login status parser", () => {
  it("does not treat negative English login text as logged in", () => {
    expect(isExplicitXhsLoggedInStatus("not logged in")).toBe(false);
    expect(isExplicitXhsLoggedOutStatus("not logged in")).toBe(true);
    expect(isExplicitXhsLoggedInStatus("login required")).toBe(false);
  });

  it("accepts explicit Chinese and English logged-in status text", () => {
    expect(isExplicitXhsLoggedInStatus("状态：已登录 用户名：xiaohongshu-mcp")).toBe(true);
    expect(isExplicitXhsLoggedInStatus("logged in as xhs-user")).toBe(true);
  });
});
