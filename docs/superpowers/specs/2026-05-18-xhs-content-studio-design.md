# XHS Content Studio Design

## Goal

Build a local web app that becomes the daily operating surface for Xiaohongshu content work: status checks, one-click topic-to-post workflows, natural-language analysis, and publishing through the existing local `xiaohongshu-mcp` service.

## Scope

Version 1 focuses on a working local loop:

- Detect whether `http://localhost:18060/mcp` is reachable and logged in.
- Store local model settings for OpenAI-compatible text and image providers.
- Run a one-click workflow from topic input to search, analysis, draft generation, image prompt generation, optional image generation, and publishing.
- Provide a web chat surface that can answer Xiaohongshu-oriented requests and call the same workflow services.
- Save workflow runs and chat outputs locally for review.

Version 1 does not scrape creator-center private analytics, schedule posts, or automate bulk engagement. Those can be added after the local workflow is stable.

## Architecture

The app is a Next.js local web application. The browser talks only to Next.js API routes. API routes call service modules for MCP, model providers, workflow orchestration, and file-backed storage.

```text
Browser UI
  -> Next.js API routes
    -> Workflow service
      -> MCP client -> http://localhost:18060/mcp
      -> Model provider -> OpenAI-compatible API
      -> Storage -> data/*.json and generated-assets/
```

The web UI is the primary user entry point. Cursor and VSCode remain development tools only.

## User Surfaces

- Dashboard: MCP login status, configured model status, latest runs.
- One-click workflow: topic, content type, time range, sample count, visibility, and auto-publish toggle.
- AI chat: a natural-language interface inside the web app for analysis, drafting, and workflow execution.
- History: saved workflow runs, drafts, reports, generated assets, and publish responses.
- Settings: MCP URL and OpenAI-compatible model settings.

## Data Flow

The one-click workflow receives a topic and options. It calls `search_feeds`, pulls details where available, ranks samples by public engagement signals, analyzes patterns with the text model, generates an original draft and image prompts, optionally calls an image generation API, then publishes through `publish_content` if auto-publish is enabled and required assets exist.

If a model API key is missing, the workflow still runs MCP search/status steps and returns a clear setup-required result instead of failing silently.

## Safety Defaults

The system analyzes public patterns but does not reuse competitor images or copy text verbatim. Generated posts should be original. The UI exposes both auto-publish and draft-only modes, with draft-only as the default until the user changes it.

## Testing

Unit tests cover MCP session handling, settings redaction, workflow fallbacks, and ranking logic. Build/type checks verify the app compiles. A browser smoke test verifies the local UI renders and can call the health endpoint.
