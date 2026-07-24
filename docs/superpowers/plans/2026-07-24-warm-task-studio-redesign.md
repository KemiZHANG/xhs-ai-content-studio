# Warm Task Studio Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the crowded single-screen content studio with a warm, task-driven interface and start it with clean creative runtime data.

**Architecture:** Keep the current Next.js client state and API contracts, but make the shell and Post Studio present one page-level responsibility at a time. Add a small pure view-model module for labels and next-step guidance, keep operational tools secondary, and clear persisted runtime JSON through a repeatable script while preserving settings and connection data.

**Tech Stack:** Next.js 16, React 19, TypeScript, vanilla CSS, Lucide React, Vitest.

---

## File Map

- Create `app/components/studio-navigation.ts`: maps project stages to user-facing pages, titles, descriptions, and next actions.
- Create `app/components/studio-workspace-home.tsx`: composed empty/current-project workspace home.
- Create `tests/studio-navigation.test.ts`: verifies stage-to-page and next-action behavior.
- Create `tests/runtime-data-cleanup.test.ts`: verifies cleanup targets and preserved files.
- Create `scripts/clear-runtime-data.mjs`: resets runtime JSON without touching settings, tokens, or acceptance evidence.
- Modify `app/types.ts`: add the workspace and library navigation sections needed by the new shell.
- Modify `app/components/app-shell.tsx`: simplify primary navigation, demote management utilities, and expose mobile navigation.
- Modify `app/components/post-studio-panel.tsx`: make research, copy, images, publish, and Agent true page views with one primary task each.
- Modify `app/page.tsx`: render the new workspace home and route shell sections to focused existing panels.
- Modify `app/globals.css`: replace the current dark/red/gradient styling with the warm editorial token system and responsive layout.
- Modify `tests/app-shell.test.ts`: update expected labels and navigation hierarchy.

### Task 1: Add the focused navigation model

**Files:**
- Create: `app/components/studio-navigation.ts`
- Create: `tests/studio-navigation.test.ts`

- [ ] **Step 1: Write the failing stage mapping tests**

```ts
import { describe, expect, it } from "vitest";
import { getStudioDestination } from "@/app/components/studio-navigation";

describe("getStudioDestination", () => {
  it("starts an empty project in research", () => {
    expect(getStudioDestination("empty")).toMatchObject({
      page: "research",
      title: "先确定内容方向",
      actionLabel: "开始研究"
    });
  });

  it("moves a drafted project to images", () => {
    expect(getStudioDestination("copy_ready").page).toBe("visuals");
  });

  it("moves a checked project to publish", () => {
    expect(getStudioDestination("quality_checked").page).toBe("publish");
  });
});
```

- [ ] **Step 2: Run the test and verify the module is missing**

Run: `npm test -- --run tests/studio-navigation.test.ts`

Expected: FAIL because `studio-navigation.ts` does not exist.

- [ ] **Step 3: Implement typed page metadata**

```ts
import type { PostStage } from "@/lib/post-project/types";

export type StudioPage = "research" | "compose" | "visuals" | "publish";

export interface StudioDestination {
  page: StudioPage;
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
}

export function getStudioDestination(stage: PostStage): StudioDestination {
  if (stage === "empty") {
    return {
      page: "research",
      eyebrow: "第一步 · 研究",
      title: "先确定内容方向",
      description: "输入主题，整理受众、证据和可用角度。",
      actionLabel: "开始研究"
    };
  }
  if (stage === "copy_ready") {
    return {
      page: "visuals",
      eyebrow: "第三步 · 图片",
      title: "为文案选择画面",
      description: "整理参考图、生成图片，并确认最终图片版本。",
      actionLabel: "选择图片"
    };
  }
  if (stage === "quality_checked" || stage === "publish_ready") {
    return {
      page: "publish",
      eyebrow: "第四步 · 发布",
      title: "最后核对一次",
      description: "检查账号、可见范围、图片和发布时间。",
      actionLabel: "检查发布"
    };
  }
  return {
    page: stage === "brief_ready" || stage === "evidence_ready" ? "compose" : "research",
    eyebrow: "当前任务",
    title: stage === "brief_ready" || stage === "evidence_ready" ? "把研究变成文案" : "继续完善研究",
    description: "页面只展示完成当前阶段需要的内容。",
    actionLabel: stage === "brief_ready" || stage === "evidence_ready" ? "编辑文案" : "继续研究"
  };
}
```

- [ ] **Step 4: Run the focused test**

Run: `npm test -- --run tests/studio-navigation.test.ts`

Expected: PASS.

### Task 2: Add safe, repeatable runtime cleanup

**Files:**
- Create: `scripts/clear-runtime-data.mjs`
- Create: `tests/runtime-data-cleanup.test.ts`

- [ ] **Step 1: Test cleanup target classification**

```ts
import { describe, expect, it } from "vitest";
import { cleanupTargets, preservedDataFiles } from "../scripts/clear-runtime-data.mjs";

describe("runtime data cleanup", () => {
  it("clears creative runtime state", () => {
    expect(cleanupTargets).toContain("chat-history.json");
    expect(cleanupTargets).toContain("post-project.json");
    expect(cleanupTargets).toContain("publish-audit.json");
  });

  it("preserves connection configuration", () => {
    expect(preservedDataFiles).toContain("settings.json");
    expect(preservedDataFiles).toContain("local-action-token.json");
    expect(cleanupTargets).not.toContain("settings.json");
  });
});
```

- [ ] **Step 2: Implement cleanup constants and atomic JSON writes**

The script writes `[]` to collection stores, `{ "currentDraft": null }` to drafts, an empty creator-memory profile map, and valid blank workspace/project objects matching the existing store constructors. It removes only `workspace-state.json.*.tmp` and `post-project.json.*.tmp` temporary files inside the project `data` directory.

- [ ] **Step 3: Run the cleanup tests**

Run: `npm test -- --run tests/runtime-data-cleanup.test.ts`

Expected: PASS.

- [ ] **Step 4: Execute cleanup and verify preservation**

Run: `node scripts/clear-runtime-data.mjs`

Expected output: cleared file count, removed temporary file count, and explicit confirmation that `settings.json` and `local-action-token.json` were preserved.

### Task 3: Build the understandable workspace home

**Files:**
- Create: `app/components/studio-workspace-home.tsx`
- Modify: `app/page.tsx`
- Modify: `app/types.ts`

- [ ] **Step 1: Create the workspace component**

The component accepts `project`, `health`, `onStart`, and `onOpenStage`. It renders:

```tsx
<main className="workspaceHome">
  <header className="workspaceWelcome">
    <span>你的创作任务中心</span>
    <h1>{project.currentStage === "empty" ? "今天想写什么？" : destination.title}</h1>
    <p>{destination.description}</p>
    <button className="primaryAction" onClick={onStart}>{destination.actionLabel}</button>
  </header>
  <ol className="creationSteps" aria-label="创作流程">
    {["研究", "文案", "图片", "发布"].map((label, index) => (
      <li key={label}><span>0{index + 1}</span><strong>{label}</strong></li>
    ))}
  </ol>
  <aside className="workspaceStatus">账号连接和当前项目状态</aside>
</main>
```

- [ ] **Step 2: Make Workspace the initial section**

Change the initial section from the current overloaded flow view to `workspace`. Keep existing API loading and callbacks. Opening a stage selects the focused Post Studio page instead of mounting all stage content.

- [ ] **Step 3: Keep management sections available but secondary**

Map existing dashboard/history/jobs/assets/audit/settings panels to management navigation without placing them in the primary creation path.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

### Task 4: Simplify shell and focused stage pages

**Files:**
- Modify: `app/components/app-shell.tsx`
- Modify: `app/components/post-studio-panel.tsx`
- Modify: `tests/app-shell.test.ts`

- [ ] **Step 1: Update shell tests for the new hierarchy**

Assert the source contains primary labels `工作台`, `研究`, `文案`, `图片`, `发布`, `资料库`, while management labels appear in a separate utility group.

- [ ] **Step 2: Replace the shell navigation**

Use a compact warm navigation surface. Remove dashboard-style counters from the top bar. Keep account status in the lower navigation area and add an accessible mobile menu button.

- [ ] **Step 3: Make Post Studio page selection externally controllable**

Add a `page` prop derived from the shell section. Render only the selected stage panel. Move Agent to an optional secondary tool and remove duplicate stage selectors from inside the content area.

- [ ] **Step 4: Reduce each page to one dominant action**

Research prioritizes topic/research, Copy prioritizes the writing canvas, Images prioritizes asset selection, and Publish prioritizes final review. Evidence details, versions, quality details, and advanced settings stay collapsed or in secondary tabs.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npm test -- --run tests/app-shell.test.ts tests/post-studio-side-pane.test.ts tests/post-studio-agent-pane.test.ts tests/post-canvas-panel.test.ts
```

Expected: PASS.

### Task 5: Apply the warm editorial visual system

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace global tokens**

```css
:root {
  --canvas: #faf7f2;
  --nav: #f0ebe3;
  --surface: #fffdf9;
  --ink: #24211d;
  --muted: #7d756d;
  --line: #ded8cf;
  --sage: #68776d;
  --sage-strong: #536158;
}
```

Remove red accents, gradients, decorative grid backgrounds, colored glows, and heavy shadows.

- [ ] **Step 2: Establish three depth levels**

Canvas, navigation, and working surface use distinct warm neutrals. Sections use whitespace and thin borders. Cards remain only for repeated items, previews, and framed tools.

- [ ] **Step 3: Enforce readable sizing**

Body text remains at least 14px, primary content is 15–16px, controls are at least 40px tall, mobile targets are at least 44px, and compact panel headings do not use hero sizing.

- [ ] **Step 4: Add responsive behavior**

At 960px, collapse the fixed navigation to a top bar/drawer. At 720px, force single-column stage content, horizontally scroll text tabs, and remove side-by-side tool panels.

- [ ] **Step 5: Run CSS and type validation**

Run: `npm run typecheck`

Expected: PASS with no missing class-driven component references.

### Task 6: Verify the complete experience

**Files:**
- Modify only if a verified defect is found in the files above.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm test -- --run tests/app-shell.test.ts tests/studio-navigation.test.ts tests/runtime-data-cleanup.test.ts tests/post-studio-side-pane.test.ts tests/post-studio-agent-pane.test.ts tests/post-canvas-panel.test.ts tests/post-studio-status.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run production checks**

Run:

```powershell
npm run typecheck
npm run build
```

Expected: both commands exit successfully.

- [ ] **Step 3: Start the application**

Run: `npm run dev`

Expected: Next.js reports `Ready` and `http://localhost:3000` returns status 200.

- [ ] **Step 4: Inspect desktop and mobile**

Use browser automation at 1440×900 and 390×844. Confirm:

- Workspace explains the first action without prior knowledge.
- Only one creation stage is visible at a time.
- No red UI remains.
- Text does not overlap or clip.
- Mobile navigation and all primary actions are reachable.
- Empty data produces a composed first-run state.

- [ ] **Step 5: Final diff review**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors; report only files changed for the redesign and intentional runtime data cleanup.

