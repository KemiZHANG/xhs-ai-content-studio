import { describe, expect, it } from "vitest";
import { hasActiveAccountConnectionChanged } from "@/app/hooks/use-settings-health";

describe("settings health helpers", () => {
  it("detects account switches that should invalidate health and publish confirmations", () => {
    expect(
      hasActiveAccountConnectionChanged(
        { activeAccountId: "account-a", mcpUrl: "http://localhost:18060/mcp" },
        { activeAccountId: "account-b", mcpUrl: "http://localhost:18060/mcp" }
      )
    ).toBe(true);
  });

  it("detects MCP endpoint changes while ignoring harmless trailing slashes and casing", () => {
    expect(
      hasActiveAccountConnectionChanged(
        { activeAccountId: "account-a", mcpUrl: "HTTP://LOCALHOST:18060/mcp/" },
        { activeAccountId: "account-a", mcpUrl: "http://localhost:18060/mcp" }
      )
    ).toBe(false);

    expect(
      hasActiveAccountConnectionChanged(
        { activeAccountId: "account-a", mcpUrl: "http://localhost:18060/mcp" },
        { activeAccountId: "account-a", mcpUrl: "http://localhost:18061/mcp" }
      )
    ).toBe(true);
  });
});
