const baseUrl = (process.env.XHS_STUDIO_URL || "http://localhost:3000").replace(/\/+$/, "");

const postStages = new Set([
  "empty",
  "briefing",
  "researching",
  "evidence_ready",
  "brief_ready",
  "copy_drafting",
  "copy_ready",
  "visual_planning",
  "image_prompt_ready",
  "image_generating",
  "image_ready",
  "assembling",
  "reviewing",
  "scheduled",
  "published",
  "failed"
]);

const postActions = new Set([
  "start_brief",
  "update_brief_inputs",
  "search_research",
  "summarize_evidence",
  "retrieve_viral_knowledge",
  "create_creative_brief",
  "generate_copy",
  "revise_copy",
  "plan_visuals",
  "confirm_visual_direction",
  "generate_image_prompts",
  "generate_images",
  "generate_cards",
  "select_images",
  "assemble_post",
  "run_quality_gate",
  "request_publish_confirmation",
  "schedule_publish",
  "publish_now",
  "recover"
]);

const requiredProjectFields = [
  "id",
  "productInfo",
  "evidencePack",
  "focusedEvidenceIds",
  "selectedSamples",
  "copyVersions",
  "imagePrompts",
  "generatedImages",
  "selectedImages",
  "agentMemory",
  "currentStage",
  "allowedActions",
  "updatedAt"
];

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function line(label, value) {
  console.log(`${label}: ${value}`);
}

function fail(message) {
  console.error(`Post Studio state smoke failed: ${message}`);
  process.exitCode = 1;
}

function hasOwn(record, key) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

try {
  line("XHS Studio", baseUrl);

  const result = await getJson("/api/post-project");
  if (!result.response.ok) {
    fail(`/api/post-project returned HTTP ${result.response.status}`);
    process.exit();
  }

  const project = result.data?.project;
  const readiness = result.data?.readiness;
  if (!project || typeof project !== "object") {
    fail("/api/post-project did not return a project object");
    process.exit();
  }

  line("PostProject", project.id || "missing");
  line("Stage", project.currentStage || "missing");
  line("Allowed actions", Array.isArray(project.allowedActions) ? project.allowedActions.join(", ") : "missing");
  line("Evidence insights", Array.isArray(project.evidencePack?.insights) ? String(project.evidencePack.insights.length) : "missing");
  line("Copy versions", Array.isArray(project.copyVersions) ? String(project.copyVersions.length) : "missing");
  line("Image prompts", Array.isArray(project.imagePrompts) ? String(project.imagePrompts.length) : "missing");
  line("Selected images", Array.isArray(project.selectedImages) ? String(project.selectedImages.length) : "missing");
  line("Readiness progress", readiness?.progress !== undefined ? String(readiness.progress) : "missing");

  for (const field of requiredProjectFields) {
    if (!hasOwn(project, field)) fail(`project is missing required field: ${field}`);
  }

  if (!postStages.has(project.currentStage)) fail(`unknown PostStage: ${project.currentStage}`);
  if (!Array.isArray(project.allowedActions)) {
    fail("allowedActions must be an array");
  } else {
    const unknownActions = project.allowedActions.filter((action) => !postActions.has(action));
    if (unknownActions.length) fail(`unknown allowedActions: ${unknownActions.join(", ")}`);
  }

  if (!project.evidencePack || !Array.isArray(project.evidencePack.sampleIds) || !Array.isArray(project.evidencePack.insights)) {
    fail("evidencePack must include sampleIds and insights arrays");
  }
  if (!project.productInfo || !Array.isArray(project.productInfo.referenceAssetIds)) {
    fail("productInfo.referenceAssetIds must be an array");
  }
  if (!Array.isArray(project.copyVersions)) fail("copyVersions must be an array");
  if (!Array.isArray(project.imagePrompts)) fail("imagePrompts must be an array");
  if (!Array.isArray(project.generatedImages)) fail("generatedImages must be an array");
  if (!Array.isArray(project.selectedImages)) fail("selectedImages must be an array");
  if (!Array.isArray(project.agentMemory)) fail("agentMemory must be an array");
  if (!readiness || typeof readiness !== "object") fail("readiness report is missing");

  if (!process.exitCode) {
    console.log("Post Studio state smoke passed. It read project state only; no MCP search, image generation, publish, or schedule action was triggered.");
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
