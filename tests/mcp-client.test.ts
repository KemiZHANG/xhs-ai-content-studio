import { describe, expect, it } from "vitest";
import { McpHttpClient } from "@/lib/mcp/client";

describe("McpHttpClient", () => {
  it("initializes a session before listing tools", async () => {
    const calls: Array<{ body: string; session?: string }> = [];
    const fetcher: typeof fetch = async (_input, init) => {
      calls.push({
        body: String(init?.body),
        session: init?.headers instanceof Headers ? init.headers.get("Mcp-Session-Id") ?? undefined : undefined
      });

      if (calls.length === 1) {
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", id: 1, result: { serverInfo: { name: "xhs" } } }),
          { status: 200, headers: { "Mcp-Session-Id": "session-1", "Content-Type": "application/json" } }
        );
      }

      if (calls.length === 2) {
        return new Response("", { status: 202 });
      }

      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "check_login_status" }] } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const client = new McpHttpClient("http://localhost:18060/mcp", fetcher);
    const tools = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(["check_login_status"]);
    expect(calls[0].body).toContain('"method":"initialize"');
    expect(calls[1].body).toContain('"notifications/initialized"');
    expect(calls[2].session).toBe("session-1");
  });

  it("aborts MCP requests that exceed the configured timeout", async () => {
    let requestSignal: AbortSignal | undefined;
    const fetcher: typeof fetch = async (_input, init) => {
      requestSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    };

    const client = new McpHttpClient("http://localhost:18060/mcp", fetcher, 5);

    await expect(client.listTools()).rejects.toThrow("MCP initialize timed out after 5ms");
    expect(requestSignal?.aborted).toBe(true);
  });
});
