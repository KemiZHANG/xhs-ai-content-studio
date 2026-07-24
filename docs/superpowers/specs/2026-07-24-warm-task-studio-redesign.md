# Warm Task Studio Redesign

## Goal

Turn the existing content studio into a calm, task-driven workspace that a first-time user can understand without instructions. Remove accumulated creative runtime data while preserving account, model, and connection settings.

## Product Structure

The application has one primary flow:

1. Research
2. Copy
3. Images
4. Publish

The home workspace shows only the current project, its next action, and connection status. Each flow stage has its own page-level view. History, jobs, assets, audit, settings, and Agent tools remain available as secondary management views and do not compete with the main creation flow.

## Navigation

The persistent navigation contains:

- Workspace
- Research
- Copy
- Images
- Publish
- Library

Secondary utilities appear in a compact lower section:

- Activity
- Settings

Every active page has a visible title, a one-sentence purpose, current stage context, and one visually dominant action. The user can always move backward or return to Workspace.

## Workspace Empty State

After data cleanup, Workspace opens in a composed empty state:

- Heading: "What do you want to create today?"
- A topic input or "New content" action
- A four-stage progress line
- Account connection status
- No fake metrics, demo projects, or placeholder activity

The empty state explains the workflow through layout and labels, not through an instructional feature list.

## Page Responsibilities

### Research

Collects the topic, requirements, evidence, and viral-library references. It does not show copy editing, image generation, or publish controls.

### Copy

Shows the selected brief and one focused writing canvas for title, body, and tags. Version history and quality details are progressive disclosures.

### Images

Shows references, generated images, and the active image prompt. Asset selection is the primary interaction.

### Publish

Shows a readable final preview, account, visibility, schedule, readiness checks, and confirmation. Publishing remains guarded by the existing safety flow.

### Library

Contains reusable assets and viral knowledge. Operational history, jobs, and audit are secondary tabs or filters within management views.

## Visual System

OpenDesign direction: `dashboard + warm-editorial`.

- Canvas: warm off-white `#FAF7F2`
- Navigation: slightly deeper warm neutral
- Working surface: soft white
- Primary text: warm near-black
- Secondary text: warm gray
- Status accent: muted sage
- Optional secondary accent: restrained terracotta for destructive or exceptional emphasis only
- No red brand treatment, gradients, glass effects, decorative grids, or heavy shadows

Chinese typography uses a readable system CJK stack. Body text is at least 14px, primary controls are at least 40px high, and page headings use a restrained editorial serif fallback where Chinese rendering remains reliable.

Depth comes from three background levels, thin warm borders, and spacing. Cards are reserved for actual repeated items or framed tools; page sections remain unframed.

## Interaction Rules

- One primary action per page.
- Advanced controls stay collapsed until needed.
- Tabs use text and an underline, not rows of pills.
- Status uses plain language: "Not started", "In progress", "Needs confirmation", "Ready".
- Empty, loading, and error states always state the next available action.
- Existing API behavior, account switching, generation, quality checks, and publish safeguards remain intact.

## Data Cleanup

Clear accumulated creative runtime content:

- Chat history
- Post project and workspace state
- Drafts
- Jobs
- Workflow history
- Assets metadata
- Publish intents and audit history
- Agent traces and creator memory
- Temporary project/workspace JSON files

Preserve:

- `data/settings.json`
- `data/local-action-token.json`
- Acceptance records and verification artifacts
- Account, model, MCP, and login configuration

Stores must return valid empty collections or a fresh default project after cleanup.

## Responsive Behavior

Desktop uses a fixed compact navigation rail and a constrained main workspace. Tablet collapses secondary details below the main task. Mobile uses a top bar plus a navigation drawer, single-column content, 44px minimum touch targets, and no horizontally compressed multi-panel layout.

## Verification

- Existing typecheck and focused component tests pass.
- Production build passes.
- Empty-data startup returns HTTP 200.
- Desktop and mobile screenshots show no overlap, clipped text, or accidental multi-column crowding.
- Core path remains usable: create topic, research, edit copy, select images, review publish.

