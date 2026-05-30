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
        "knowledge.retrieveViralPatterns",
        "knowledge.saveViralCase",
        "project.startProject",
        "project.updateBriefInputs",
        "project.selectImages",
        "project.assemblePost",
        "project.runQualityGate",
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
    expect(registry.get("project.startProject")?.risk).toBe("local_write");
    expect(registry.get("project.runQualityGate")?.requiresConfirmation).toBe(false);
    expect(registry.get("project.assemblePost")?.profile).toBe("creator_publish");
    expect(registry.get("knowledge.saveViralCase")?.requiresModel).toBe(true);
    expect(registry.get("knowledge.retrieveViralPatterns")?.requiresMcp).toBe(false);
  });
});
