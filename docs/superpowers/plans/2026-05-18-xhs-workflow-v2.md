# XHS Workflow V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add controlled draft/material/publish/scheduled-publish modes, richer viral sample analysis, image-style analysis, and chat draft context publishing.

**Architecture:** Extend the existing workflow service with explicit run modes and draft records. Keep one-click forms and chat on the same workflow path, then add focused UI panels for sample tables, draft actions, and scheduling.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, local JSON storage, Xiaohongshu MCP, Gemini OpenAI-compatible models.

---

### Task 1: Workflow Modes

**Files:**
- Modify: `lib/workflows/one-click.ts`
- Modify: `lib/mcp/xhs.ts`
- Modify: `app/api/workflows/one-click/route.ts`
- Test: `tests/workflow.test.ts`

- [ ] Add `publishMode: draft | material | publish | schedule`, `analyzeImages`, `generateImages`, and `scheduleAt` to workflow input.
- [ ] Make image generation conditional.
- [ ] Pass `schedule_at` through to MCP for scheduled publish.
- [ ] Add tests for draft mode skipping images and schedule mode passing schedule time.

### Task 2: Viral Sample Table

**Files:**
- Modify: `lib/workflows/ranking.ts`
- Modify: `lib/workflows/one-click.ts`
- Modify: `app/page.tsx`
- Test: `tests/ranking.test.ts`

- [ ] Normalize author, URL, likes, collects, comments, shares, and score.
- [ ] Render a table with title, author, engagement, link, and score.
- [ ] Include the table in workflow history.

### Task 3: Image Style Analysis

**Files:**
- Modify: `lib/models/provider.ts`
- Modify: `lib/workflows/one-click.ts`
- Test: `tests/workflow.test.ts`

- [ ] Add a multimodal analysis method that can receive image URLs.
- [ ] Extract image URLs from MCP detail payloads.
- [ ] Include image style analysis in the content generation prompt.
- [ ] Skip cleanly when image analysis is disabled or no images exist.

### Task 4: Chat Draft Context

**Files:**
- Create: `lib/storage/drafts.ts`
- Modify: `lib/chat/agent.ts`
- Modify: `app/api/chat/route.ts`
- Modify: `app/page.tsx`
- Test: `tests/chat-agent.test.ts`

- [ ] Save generated workflow drafts as draft records.
- [ ] Let chat revise current draft text.
- [ ] Let chat publish current draft immediately or with a schedule.
- [ ] Return clear messages when no current draft exists.

### Task 5: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Browser-check the one-click page and chat page.
