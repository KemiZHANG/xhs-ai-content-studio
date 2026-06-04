import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readText = (path: string) => readFileSync(join(root, path), "utf8");

describe("internal delivery smoke script", () => {
  it("checks the rough Post Studio delivery loop without external actions", () => {
    const pkg = JSON.parse(readText("package.json")) as { scripts?: Record<string, string> };
    const script = readText("scripts/internal-delivery-smoke.mjs");

    expect(pkg.scripts?.["smoke:internal-delivery"]).toBe("node scripts/internal-delivery-smoke.mjs");
    expect(pkg.scripts?.["smoke:safe"]).toContain("npm run smoke:internal-delivery");
    expect(script).toContain("/api/post-project");
    expect(script).toContain("/api/assets");
    expect(script).toContain("/api/publish");
    expect(script).toContain("/api/acceptance/status");
    expect(script).toContain('action: "run_quality_gate"');
    expect(script).toContain("dryRun: true");
    expect(script).toContain("selectedImageIds");
    expect(script).toContain("finalPost");
    expect(script).toContain("qualityCheck");
    expect(script).toContain("requiresConfirmation");
    expect(script).toContain("roughDeliveryReady");
    expect(script).toContain("内部闭环可交付");
    expect(script).toContain("canvas Quality Gate dry-run");
    expect(script).toContain("no MCP search, model generation, external publish, schedule action, or current project overwrite was triggered");
    expect(script).not.toContain("confirmed: true");
    expect(script).not.toContain("publishIntentId");
  });
});
