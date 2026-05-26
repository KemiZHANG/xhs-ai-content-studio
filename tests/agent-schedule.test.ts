import { describe, expect, it } from "vitest";
import { inferAgentScheduleAt } from "@/lib/agent/schedule";

describe("agent schedule parsing", () => {
  it("parses tonight at 8 into a timezone-aware future timestamp", () => {
    const scheduleAt = inferAgentScheduleAt("就用第二张图，今晚 8 点发", {
      now: new Date("2026-05-21T12:00:00+08:00")
    });

    expect(scheduleAt).toBe("2026-05-21T20:00:00+08:00");
  });

  it("moves tonight to tomorrow when the requested time has already passed", () => {
    const scheduleAt = inferAgentScheduleAt("今晚 8 点发", {
      now: new Date("2026-05-21T22:00:00+08:00")
    });

    expect(scheduleAt).toBe("2026-05-22T20:00:00+08:00");
  });

  it("keeps explicit ISO schedule timestamps and adds the local timezone when missing", () => {
    expect(inferAgentScheduleAt("schedule at 2026-05-22T20:00")).toBe("2026-05-22T20:00+08:00");
    expect(inferAgentScheduleAt("schedule at 2026-05-22T20:00:00+08:00")).toBe(
      "2026-05-22T20:00:00+08:00"
    );
  });
});
