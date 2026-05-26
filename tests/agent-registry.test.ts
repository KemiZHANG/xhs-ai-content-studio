import { describe, expect, it } from "vitest";
import { createAgentToolRegistry } from "@/lib/agent/tools/registry";

describe("agent tool registry", () => {
  it("registers existing XHS Studio capabilities as tools", () => {
    const registry = createAgentToolRegistry();

    expect(registry.list().map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "workflow.runOneClick",
        "workflow.searchRank",
        "workflow.loadEvidence",
        "workflow.summarizeEvidence",
        "workflow.generateDraft",
        "workflow.generateImages",
        "draft.reviseCurrent",
        "draft.createFromEvidence",
        "image.generate",
        "image.generateCards",
        "publish.prepare",
        "publish.execute",
        "history.lookup",
        "assets.list"
      ])
    );
    expect(registry.get("publish.execute")?.risk).toBe("external_write");
    expect(registry.get("publish.execute")?.requiresConfirmation).toBe(true);
    expect(registry.get("publish.execute")?.mcpTools).toEqual(["publish_content"]);
    expect(registry.get("workflow.runOneClick")?.requiresMcp).toBe(true);
    expect(registry.get("workflow.searchRank")?.requiresMcp).toBe(true);
    expect(registry.get("workflow.searchRank")?.mcpTools).toEqual(["search_feeds"]);
    expect(registry.get("workflow.loadEvidence")?.mcpTools).toEqual(["get_feed_detail"]);
    expect(registry.get("workflow.generateDraft")?.requiresModel).toBe(true);
    expect(registry.get("image.generateCards")?.requiresModel).toBe(false);
  });
});
