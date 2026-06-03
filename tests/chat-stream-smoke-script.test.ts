import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readText = (path: string) => readFileSync(join(root, path), "utf8");

describe("chat stream smoke script", () => {
  it("is exposed as a transport-only SSE smoke check", () => {
    const pkg = JSON.parse(readText("package.json")) as { scripts?: Record<string, string> };
    const script = readText("scripts/chat-stream-smoke.mjs");

    expect(pkg.scripts?.["smoke:chat-stream"]).toBe("node scripts/chat-stream-smoke.mjs");
    expect(pkg.scripts?.["smoke:safe"]).toBe(
      "npm run smoke:local && npm run smoke:accounts && npm run smoke:studio-state && npm run smoke:chat-stream && npm run smoke:publish-dry-run"
    );
    expect(script).toContain("/api/chat/stream");
    expect(script).toContain("text/event-stream");
    expect(script).toContain('message: ""');
    expect(script).toContain("请输入问题");
    expect(script).toContain("SSE transport only");
    expect(script).not.toContain("/api/workflows/one-click");
    expect(script).not.toContain("/api/publish");
    expect(script).not.toContain("confirmed: true");
  });
});
