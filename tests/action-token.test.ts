import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalCwd = process.cwd();

describe("local action token", () => {
  let tempDir: string;

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "xhs-action-token-"));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it("creates a stable local token and verifies matching request headers", async () => {
    const { ACTION_TOKEN_HEADER, attachActionToken, getLocalActionToken, verifyLocalActionToken } = await import(
      "@/lib/security/action-token"
    );

    const token = await getLocalActionToken();
    const payload = await attachActionToken({ ok: true });
    const validRequest = new Request("http://localhost/api", {
      headers: {
        [ACTION_TOKEN_HEADER]: token
      }
    });
    const invalidRequest = new Request("http://localhost/api");

    expect(token).toHaveLength(43);
    expect(payload).toEqual({ ok: true, actionToken: token });
    expect(await getLocalActionToken()).toBe(token);
    expect(await verifyLocalActionToken(validRequest)).toBe(true);
    expect(await verifyLocalActionToken(invalidRequest)).toBe(false);
  });

  it("requires the token before mutating settings and does not persist it as a setting", async () => {
    const { GET, POST } = await import("@/app/api/settings/route");
    const denied = await POST(
      new Request("http://localhost/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ defaultAutoPublish: true })
      })
    );

    const settingsResponse = await GET();
    const settings = await settingsResponse.json();
    const accepted = await POST(
      new Request("http://localhost/api/settings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-xhs-action-token": settings.actionToken
        },
        body: JSON.stringify({ defaultAutoPublish: true, actionToken: "do-not-save-me" })
      })
    );
    const savedSettings = await readFile(path.join(tempDir, "data", "settings.json"), "utf8");

    expect(denied.status).toBe(403);
    expect(settings.actionToken).toEqual(expect.any(String));
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual(expect.objectContaining({ defaultAutoPublish: true }));
    expect(savedSettings).not.toContain("do-not-save-me");
    expect(savedSettings).not.toContain("actionToken");
  });
});
