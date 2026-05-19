type JsonRpcSuccess<T> = {
  jsonrpc: "2.0";
  id: number;
  result: T;
};

type JsonRpcFailure = {
  jsonrpc: "2.0";
  id: number;
  error: {
    code: number;
    message: string;
  };
};

type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcFailure;

export type McpTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

export type McpTextContent = {
  type: "text";
  text: string;
};

export type McpCallResult = {
  content?: McpTextContent[];
  [key: string]: unknown;
};

export class McpHttpClient {
  private sessionId: string | null = null;
  private nextId = 1;

  constructor(
    private readonly url: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly requestTimeoutMs = 120_000
  ) {}

  async initialize(): Promise<void> {
    if (this.sessionId) {
      return;
    }

    const response = await this.fetchWithTimeout("initialize", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "xhs-ai-content-studio",
            version: "0.1.0"
          }
        },
        id: this.nextId++
      })
    });

    if (!response.ok) {
      throw new Error(`MCP initialize failed with HTTP ${response.status}`);
    }

    const sessionId = response.headers.get("Mcp-Session-Id");
    if (!sessionId) {
      throw new Error("MCP server did not return Mcp-Session-Id");
    }

    await parseRpcResponse<unknown>(response);
    this.sessionId = sessionId;

    const initializedResponse = await this.fetchWithTimeout("initialized notification", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {}
      })
    });

    if (!initializedResponse.ok && initializedResponse.status !== 202) {
      throw new Error(`MCP initialized notification failed with HTTP ${initializedResponse.status}`);
    }
  }

  async listTools(): Promise<McpTool[]> {
    const result = await this.rpc<{ tools: McpTool[] }>("tools/list", {});
    return result.tools;
  }

  async callTool<T extends McpCallResult = McpCallResult>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    return this.rpc<T>("tools/call", {
      name,
      arguments: args
    });
  }

  private async rpc<T>(method: string, params: Record<string, unknown>): Promise<T> {
    await this.initialize();

    const response = await this.fetchWithTimeout(method, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        method,
        params,
        id: this.nextId++
      })
    });

    if (!response.ok) {
      throw new Error(`MCP ${method} failed with HTTP ${response.status}`);
    }

    return parseRpcResponse<T>(response);
  }

  private async fetchWithTimeout(label: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      return await this.fetcher(this.url, {
        ...init,
        signal: controller.signal
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`MCP ${label} timed out after ${this.requestTimeoutMs}ms`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private headers(): Headers {
    const headers = new Headers({
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream"
    });

    if (this.sessionId) {
      headers.set("Mcp-Session-Id", this.sessionId);
    }

    return headers;
  }
}

async function parseRpcResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    return undefined as T;
  }

  const payload = JSON.parse(text) as JsonRpcResponse<T>;
  if ("error" in payload) {
    throw new Error(payload.error.message);
  }

  return payload.result;
}
