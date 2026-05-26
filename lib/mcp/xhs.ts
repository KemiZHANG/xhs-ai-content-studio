import { McpHttpClient, type McpCallResult, type McpTool } from "@/lib/mcp/client";
import type { AppSettings } from "@/lib/storage/settings";
import type { RankedFeed } from "@/lib/workflows/ranking";
import type { XhsMcpWorkflowClient } from "@/lib/workflows/one-click";

export function createXhsMcpClient(settings: AppSettings): XhsMcpWorkflowClient & {
  checkLoginStatus(): Promise<McpCallResult>;
  listTools(): Promise<McpTool[]>;
} {
  const client = new McpHttpClient(settings.mcpUrl);

  return {
    async checkLoginStatus() {
      return client.callTool("check_login_status");
    },

    async listTools() {
      return client.listTools();
    },

    async searchFeeds(keyword, options) {
      return client.callTool("search_feeds", buildSearchFeedsArguments(keyword, options));
    },

    async getFeedDetail(feed: RankedFeed) {
      if (!feed.xsecToken) {
        return { skipped: true, reason: "缺少 xsec_token", feed };
      }

      return client.callTool("get_feed_detail", {
        feed_id: feed.id,
        xsec_token: feed.xsecToken,
        load_all_comments: false
      });
    },

    async publishContent(args) {
      return client.callTool("publish_content", {
        title: args.title,
        content: args.content,
        images: args.images,
        tags: args.tags,
        visibility: args.visibility,
        ...(args.scheduleAt ? { schedule_at: args.scheduleAt } : {})
      });
    }
  };
}

export function buildSearchFeedsArguments(
  keyword: string,
  _options: { timeRange: string }
): { keyword: string } {
  // The MCP server's filtered search drives Xiaohongshu's UI filter panel.
  // In practice that browser flow can hang for minutes, while keyword-only
  // search returns reliably; ranking is handled locally after results arrive.
  return { keyword };
}

export function readMcpText(result: McpCallResult | unknown): string {
  if (typeof result === "string") {
    return result;
  }

  if (isRecord(result) && Array.isArray(result.content)) {
    return result.content
      .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n");
  }

  return JSON.stringify(result, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
