import { describe, expect, it } from "vitest";
// @ts-expect-error The cleanup utility is an executable ESM maintenance script.
import { cleanupTargets, preservedDataFiles, runtimeCollectionFiles } from "../scripts/clear-runtime-data.mjs";

describe("runtime data cleanup", () => {
  it("clears creative runtime state", () => {
    expect(cleanupTargets).toContain("chat-history.json");
    expect(cleanupTargets).toContain("post-project.json");
    expect(cleanupTargets).toContain("publish-audit.json");
    expect(runtimeCollectionFiles).toContain("assets.json");
  });

  it("preserves connection configuration and acceptance evidence", () => {
    expect(preservedDataFiles).toContain("settings.json");
    expect(preservedDataFiles).toContain("local-action-token.json");
    expect(preservedDataFiles).toContain("acceptance-completion-matrix.json");
    expect(cleanupTargets).not.toContain("settings.json");
  });
});
