# XHS Content Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Next.js web app for Xiaohongshu MCP status, one-click AI content workflows, in-browser natural-language analysis, settings, and history.

**Architecture:** Use Next.js App Router for UI and API routes. Keep MCP, model, workflow, and storage logic in focused TypeScript service modules so both form workflows and chat can reuse the same capabilities.

**Tech Stack:** Next.js, React, TypeScript, Vitest, file-backed JSON storage, local `xiaohongshu-mcp` HTTP endpoint, OpenAI-compatible model API calls.

---

## File Map

- `package.json`: scripts and dependencies.
- `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`: project configuration.
- `app/layout.tsx`, `app/page.tsx`, `app/globals.css`: web UI shell and styling.
- `app/api/health/mcp/route.ts`: MCP status endpoint.
- `app/api/settings/route.ts`: settings read/write endpoint.
- `app/api/workflows/one-click/route.ts`: one-click workflow endpoint.
- `app/api/chat/route.ts`: in-browser AI chat endpoint.
- `app/api/history/route.ts`: workflow history endpoint.
- `lib/mcp/client.ts`: JSON-RPC MCP session client.
- `lib/models/provider.ts`: OpenAI-compatible text and image API adapter.
- `lib/storage/settings.ts`: local settings persistence and redaction.
- `lib/storage/history.ts`: workflow history persistence.
- `lib/workflows/ranking.ts`: engagement ranking helpers.
- `lib/workflows/one-click.ts`: topic-to-draft/publish orchestration.
- `lib/chat/agent.ts`: natural-language router for web chat.
- `tests/*.test.ts`: unit tests for service behavior.

## Tasks

### Task 1: Project Scaffold

- [ ] Create Next.js, TypeScript, Vitest, and styling files.
- [ ] Add scripts: `dev`, `build`, `typecheck`, `test`.
- [ ] Install dependencies with `npm install`.

### Task 2: Core Services With Tests

- [ ] Write failing tests for settings redaction, ranking, and model-missing workflow fallback.
- [ ] Implement settings storage, history storage, ranking, and model provider modules.
- [ ] Run tests and keep them passing.

### Task 3: MCP Client and API Routes

- [ ] Write tests for MCP request shape using a fake fetch function.
- [ ] Implement initialize, tools/list, and tools/call helpers.
- [ ] Add health, settings, history, workflow, and chat API routes.
- [ ] Verify `GET /api/health/mcp` against the running local MCP service.

### Task 4: Web UI

- [ ] Build a single-page operational dashboard with sidebar navigation.
- [ ] Add status, settings, one-click workflow, AI chat, and history panels.
- [ ] Wire panels to API routes with loading, success, and error states.

### Task 5: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Start the dev server.
- [ ] Open the app in the browser and verify the dashboard renders and health check works.
