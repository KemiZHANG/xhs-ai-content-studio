import { describe, expect, it } from "vitest";
import { rankFeeds } from "@/lib/workflows/ranking";

describe("rankFeeds", () => {
  it("sorts feeds by weighted public engagement", () => {
    const feeds = rankFeeds([
      { id: "low", title: "low", likes: 10, collects: 1, comments: 1 },
      { id: "collect-heavy", title: "collect", likes: 20, collects: 30, comments: 3 },
      { id: "comment-heavy", title: "comment", likes: 30, collects: 5, comments: 40 }
    ]);

    expect(feeds.map((feed) => feed.id)).toEqual(["comment-heavy", "collect-heavy", "low"]);
    expect(feeds[0].score).toBeGreaterThan(feeds[1].score);
  });
});
