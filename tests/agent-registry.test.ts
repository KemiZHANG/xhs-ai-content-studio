import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAgentToolRegistry } from "@/lib/agent/tools/registry";
import type { SampleEvidence } from "@/lib/workflows/one-click";

let originalCwd: string;
let tempDir: string;

const sample: SampleEvidence = {
  id: "note-tool-viral",
  title: "广州咖啡馆高收藏拍照座位",
  author: "author",
  likes: 1000,
  collects: 1600,
  comments: 88,
  shares: 12,
  score: 2300,
  url: "https://www.xiaohongshu.com/explore/note-tool-viral",
  imageUrls: ["https://example.com/coffee.jpg"],
  cachedImageUrls: [],
  detailText: "先讲适合人群，再写窗边座位、光线、人均和周末排队，最后给避峰建议。",
  commentSnippets: ["想知道哪张桌子出片", "人均多少"],
  reasonHighlights: []
};

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await mkdtemp(path.join(os.tmpdir(), "xhs-agent-registry-"));
  process.chdir(tempDir);
  await mkdir("data", { recursive: true });
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

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

  it("executes the viral-knowledge save tool and attaches reusable patterns to the active PostProject", async () => {
    const registry = createAgentToolRegistry();
    const result = await registry.call("knowledge.saveViralCase", {
      sample,
      topic: "广州咖啡馆",
      category: "探店"
    }) as {
      ok: boolean;
      data: {
        case: { topic: string; extractedInsights: { reusableRules: string[] } };
        project: { evidencePack: { insights: { sourceType?: string }[] } };
      };
      warnings: string[];
    };

    expect(result.ok).toBe(true);
    expect(result.data.case.topic).toBe("广州咖啡馆");
    expect(result.data.case.extractedInsights.reusableRules.join(" ")).toContain("不复制");
    expect(result.data.project.evidencePack.insights.some((insight) => insight.sourceType === "viral_library")).toBe(true);
    expect(result.warnings.join(" ")).toContain("启发式");
  });

  it("executes the viral-knowledge retrieval tool as a traceable RAG pack", async () => {
    const registry = createAgentToolRegistry();
    await registry.call("knowledge.saveViralCase", {
      sample,
      topic: "广州咖啡馆",
      category: "探店"
    });

    const result = await registry.call("knowledge.retrieveViralPatterns", {
      query: "广州咖啡馆 探店账号 高收藏",
      topic: "广州咖啡馆",
      category: "探店",
      limit: 5,
      realtimeEvidenceCount: 4
    }) as {
      ok: boolean;
      data: {
        results: unknown[];
        insights: { sourceType?: string; sourceSampleIds: string[] }[];
        sufficiency: { realtimeCount: number; viralCount: number };
      };
      display?: { summary?: string };
    };

    expect(result.ok).toBe(true);
    expect(result.data.results.length).toBeGreaterThan(0);
    expect(result.data.insights.every((insight) => insight.sourceType === "viral_library")).toBe(true);
    expect(result.data.insights[0].sourceSampleIds[0]).toContain("viral-");
    expect(result.data.sufficiency.realtimeCount).toBe(4);
    expect(result.data.sufficiency.viralCount).toBeGreaterThan(0);
    expect(result.display?.summary).toContain("可追溯");
  });
});
