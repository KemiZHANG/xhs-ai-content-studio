const baseUrl = (process.env.XHS_STUDIO_URL || "http://localhost:3000").replace(/\/+$/, "");

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
  console.error(`Acceptance status smoke failed: ${message}`);
  process.exitCode = 1;
}

try {
  line("XHS Studio", baseUrl);

  const result = await getJson("/api/acceptance/status");
  if (!result.response.ok) {
    fail(`/api/acceptance/status returned HTTP ${result.response.status}`);
    process.exit();
  }

  const validationResult = await getJson("/api/acceptance/validation-records");
  if (!validationResult.response.ok) {
    fail(`/api/acceptance/validation-records returned HTTP ${validationResult.response.status}`);
    process.exit();
  }
  if (!validationResult.data?.ok || !Array.isArray(validationResult.data.records)) {
    fail("/api/acceptance/validation-records did not return an ok records payload");
    process.exit();
  }

  const status = result.data?.status;
  const deliverySummary = result.data?.deliverySummary;
  const evidencePackage = result.data?.evidencePackage;
  if (!result.data?.ok || !status || typeof status !== "object") {
    fail("/api/acceptance/status did not return an ok status payload");
    process.exit();
  }
  if (!deliverySummary || typeof deliverySummary !== "object") {
    fail("/api/acceptance/status did not return deliverySummary");
    process.exit();
  }
  if (!evidencePackage || typeof evidencePackage !== "object") {
    fail("/api/acceptance/status did not return evidencePackage");
    process.exit();
  }

  const manualGateIds = Array.isArray(status.manualGates) ? status.manualGates.map((gate) => gate.id) : [];
  const verifiedIds = Array.isArray(status.verified) ? status.verified.map((item) => item.id) : [];

  line("Completion", `${status.completionPercent}%`);
  line("Can mark complete", String(Boolean(status.canMarkComplete)));
  line("Verified coverage", verifiedIds.join(", ") || "missing");
  line("Manual gates", manualGateIds.join(", ") || "missing");
  line("Delivery state", deliverySummary.stateLabel || "missing");
  line("Next safe command", deliverySummary.nextSafeCommand || "missing");
  line("Evidence package", `v${evidencePackage.schemaVersion || "missing"}`);
  line("Validation records", String(validationResult.data.records.length));
  line("Recommended commands", Array.isArray(status.recommendedCommands) ? status.recommendedCommands.join(", ") : "missing");

  if (status.completionPercent !== 99) fail("completionPercent should stay at 99 until real external validation is done");
  if (status.canMarkComplete !== false) fail("canMarkComplete must stay false while real publish/schedule/account gates remain manual");
  if (deliverySummary.safeToAutomateCompletion !== false) fail("deliverySummary must not allow automated completion while manual gates remain");
  if (deliverySummary.nextManualGateId !== "real_publish") fail("deliverySummary should keep real publish as the first manual gate");
  if (deliverySummary.nextSafeCommand !== "npm run smoke:safe") fail("deliverySummary should point to npm run smoke:safe as the next safe command");
  if (evidencePackage.schemaVersion !== 1) fail("evidencePackage should use schemaVersion 1");
  if (evidencePackage.canMarkComplete !== false) fail("evidencePackage must not mark completion while manual gates remain");
  if (!Array.isArray(evidencePackage.gates) || evidencePackage.gates.length < 4) fail("evidencePackage is missing manual gate templates");
  if (!validationResult.data.status || typeof validationResult.data.status !== "object") fail("validation records endpoint is missing status");
  if (!validationResult.data.deliverySummary || typeof validationResult.data.deliverySummary !== "object") {
    fail("validation records endpoint is missing deliverySummary");
  }
  if (validationResult.data.status.canMarkComplete !== status.canMarkComplete) {
    fail("validation records endpoint and status endpoint disagree on canMarkComplete");
  }

  for (const id of ["post_project", "post_studio", "agent_director", "creative_brief", "viral_rag", "publish_safety"]) {
    if (!verifiedIds.includes(id)) fail(`verified coverage is missing ${id}`);
  }
  for (const id of ["real_publish", "scheduled_publish", "multi_account_switching"]) {
    if (!manualGateIds.includes(id)) fail(`manual gates are missing ${id}`);
  }
  for (const gate of Array.isArray(status.manualGates) ? status.manualGates : []) {
    if (gate.canBeAutomated !== false) fail(`manual gate ${gate.id || "unknown"} must not be marked automatable`);
    if (!gate.proofRequired || typeof gate.proofRequired !== "string") fail(`manual gate ${gate.id || "unknown"} is missing proofRequired`);
    if (!Array.isArray(gate.checklist) || gate.checklist.length < 5) fail(`manual gate ${gate.id || "unknown"} is missing an executable checklist`);
    if (!Array.isArray(gate.evidenceFields) || gate.evidenceFields.length < 5) fail(`manual gate ${gate.id || "unknown"} is missing evidence field templates`);
    if (gate.evidenceFields.some((field) => !field?.key || !field?.label || !field?.example || field.required !== true)) {
      fail(`manual gate ${gate.id || "unknown"} has incomplete evidence field templates`);
    }
  }
  for (const gate of Array.isArray(evidencePackage.gates) ? evidencePackage.gates : []) {
    if (gate.manualOnly !== true) fail(`evidence package gate ${gate.id || "unknown"} must be manualOnly`);
    if (!gate.evidenceRecordTemplate || gate.evidenceRecordTemplate.validated !== false) {
      fail(`evidence package gate ${gate.id || "unknown"} is missing a validation record template`);
    }
  }
  for (const command of ["npm run verify", "npm run smoke:safe", "npm run smoke:accounts"]) {
    if (!status.recommendedCommands?.includes(command)) fail(`recommended commands are missing ${command}`);
  }

  if (!process.exitCode) {
    console.log("Acceptance status smoke passed. It only read completion status; no MCP, model, publish, or schedule action was triggered.");
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
