# XHS AI Content Studio V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add background jobs with progress, asset upload/library, product-image generation, richer publishing records, and a more operational UI.

**Architecture:** Keep the existing workflow service as the execution core. Add file-backed job, asset, and publishing storage, then introduce API routes that start jobs and expose progress. The UI uses these routes instead of blocking on long workflow calls.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, local JSON storage, local file uploads, Xiaohongshu MCP, Gemini/Nano Banana image generation.

---

### Task 1: Job Queue and Progress

- [ ] Add `lib/storage/jobs.ts` for file-backed job records.
- [ ] Add `lib/jobs/runner.ts` for local background workflow jobs.
- [ ] Add `app/api/jobs/route.ts` and `app/api/jobs/[id]/route.ts`.
- [ ] Change the workflow form to create a job and poll progress.

### Task 2: Publishing Records

- [ ] Add pre/post publish fields to job records.
- [ ] Add a publishing record view in History.
- [ ] Record title, content, tags, images, visibility, schedule, result, and error.

### Task 3: Asset Upload and Library

- [ ] Add `lib/storage/assets.ts` for uploaded/generated asset metadata.
- [ ] Add `app/api/assets/route.ts` for list/upload.
- [ ] Add `app/api/assets/[id]/route.ts` for delete.
- [ ] Add `app/api/assets/file/[id]/route.ts` for local image preview.

### Task 4: Product Image Generation

- [ ] Add model provider method for reference-image generation.
- [ ] Add `app/api/assets/generate/route.ts` to create product scene images.
- [ ] Let workflow choose image source: topic AI, product asset, or manual existing asset.

### Task 5: UI Redesign

- [ ] Add Assets and Jobs sections to the sidebar.
- [ ] Add progress timeline and publish record cards.
- [ ] Improve dashboard density and layout.
- [ ] Keep all existing modes and switches visible.

### Task 6: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Browser smoke test dashboard, workflow, jobs, and assets pages.
