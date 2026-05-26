# Agent Tool Manual

This document turns the internal XHS AI Content Studio capabilities into a stable Agent contract. It borrows the useful pattern from `cv-cat/All-IN-ONE`: a thin Agent-facing manual, a unified execution layer, profile-aware auth, dry-run thinking, and structured JSON results. We are not copying its multi-platform CLI into this product.

## Principles

1. The Web UI is the user entry point. The Agent should call registered tools, not hidden workflow internals.
2. Research and publishing are separate profiles. Research tools can read public Xiaohongshu data; publishing tools can create real external actions and must pass guardrails.
3. Every high-risk action must support a dry-run or preview. A dry-run shows planned parameters, required model/MCP access, selected account profile, risk level, and expected output.
4. Tool output should be structured enough for the right-side canvas, tests, traces, and history to read without parsing free text.
5. Raw cookies and API keys must never be shown in UI summaries, traces, logs, or docs.

## Profiles

| Profile | Purpose | Examples |
| --- | --- | --- |
| `research` | Search, rank, load note details, summarize evidence, create/revise drafts. | `workflow.searchRank`, `workflow.loadEvidence`, `draft.createFromEvidence` |
| `assets` | Upload, select, generate, and render images/cards. | `image.generate`, `image.generateCards`, `assets.list` |
| `creator_publish` | Prepare or execute Xiaohongshu publishing. | `publish.prepare`, `publish.execute` |
| `memory` | Read local conversation/workspace/creator memory. | `history.lookup` |
| `system` | Health checks, settings, diagnostics. | Future MCP health mapping |

## Tool Result Envelope

Agent tools should gradually converge to this shape:

```ts
type AgentToolResult<T> = {
  ok: boolean;
  data?: T;
  warnings: string[];
  risk: "read" | "local_write" | "external_write";
  traceId?: string;
  raw?: unknown;
  display?: {
    title?: string;
    summary?: string;
    items?: unknown[];
  };
};
```

The Agent uses `data`; the UI uses `display`; debugging can inspect `raw`. External writes must also create trace events and publish intents.

## Current Tool Registry

| Tool | Profile | Risk | Model | MCP | Confirmation | Dry-run Meaning |
| --- | --- | --- | --- | --- | --- | --- |
| `workflow.runOneClick` | `research` | `local_write` | yes | yes | no | Show planned research/draft/material mode without platform calls. |
| `workflow.searchRank` | `research` | `read` | no | yes | no | Show search query, time range, sample count, scoring rule. |
| `workflow.loadEvidence` | `research` | `read` | no | yes | no | Show note IDs/URLs to load and fields expected. |
| `workflow.summarizeEvidence` | `research` | `local_write` | yes | no | no | Show summary sections to produce. |
| `workflow.generateDraft` | `research` | `local_write` | yes | no | no | Show creative brief, constraints, and originality checks. |
| `workflow.generateImages` | `assets` | `local_write` | yes | no | no | Show prompt, references, expected image count. |
| `draft.reviseCurrent` | `research` | `local_write` | yes | no | no | Show current draft id and requested edits. |
| `draft.createFromEvidence` | `research` | `local_write` | yes | no | no | Show latest evidence summary and user requirements. |
| `image.generate` | `assets` | `local_write` | yes | no | no | Show image model, prompt, reference assets. |
| `image.generateCards` | `assets` | `local_write` | no | no | no | Show card theme, page count estimate, size. |
| `publish.prepare` | `creator_publish` | `local_write` | no | no | no | Show title/content/tags/images and guardrail checklist. |
| `publish.execute` | `creator_publish` | `external_write` | no | yes | yes | Never directly publishes in preview; shows account, visibility, schedule, and idempotency key. |
| `history.lookup` | `memory` | `read` | no | no | no | Show which local records will be read. |
| `assets.list` | `assets` | `read` | no | no | no | Show asset filters and counts. |

## UI Translation

The user should not see a long tool list. The Web UI should translate tools into a few simple flows:

1. `主题研究台`: calls research tools only. It never publishes and never generates images.
2. `AI 工作台`: plans and invokes research, draft, revise, image, card, and publish-preparation tools from a conversation.
3. `图片创作台`: focuses on `image.generate` and `image.generateCards`, using the latest research summary when available.
4. `发布装配台`: combines current draft and selected images, then calls `publish.prepare` and only later `publish.execute`.

## Next Implementation Targets

1. Add a visible "执行预演" panel before external writes and bulk generation.
2. Add MCP tool health mapping: list real MCP tools and show whether each internal Agent tool can run.
3. Extend account settings from one active account into purpose-aware research/publish profiles.
4. Convert tool `call()` returns to `AgentToolResult<T>` step by step.
