import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const baseUrl = (process.env.XHS_STUDIO_URL || "http://localhost:3000").replace(/\/+$/, "");
const inputPath = resolve(process.env.XHS_ACCEPTANCE_EVIDENCE_PATH || "data/manual-acceptance-evidence-package.json");
const dryRun = process.env.XHS_ACCEPTANCE_RECORD_DRY_RUN === "1" || process.argv.includes("--dry-run");

function fail(message) {
  console.error(`Acceptance validation record import failed: ${message}`);
  process.exit(1);
}

function isFilled(value) {
  return typeof value === "string" ? value.trim().length > 0 : value === true;
}

function validateRecord(gate, record, template) {
  const issues = [];
  if (record.validated !== true) issues.push("validated must be true");
  for (const key of ["validatedAt", "operator", "notes"]) {
    if (!isFilled(template[key])) issues.push(`fill ${key}`);
  }
  for (const field of Array.isArray(gate.evidenceFields) ? gate.evidenceFields : []) {
    if (field.required && !isFilled(record.evidence[field.key])) {
      issues.push(`fill ${field.key} (${field.label})`);
    }
  }
  return issues;
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

let evidencePackage;
try {
  evidencePackage = JSON.parse(await readFile(inputPath, "utf8"));
} catch (error) {
  fail(`could not read ${inputPath}. Export it first with npm run acceptance:evidence-package`);
}

if (evidencePackage?.schemaVersion !== 1 || !Array.isArray(evidencePackage.gates)) {
  fail("input is not an evidencePackage v1 file");
}

const importedGateIds = [];
const previewRecords = [];
let latestCompletionMatrix = null;
for (const gate of evidencePackage.gates) {
  const template = gate?.evidenceRecordTemplate;
  if (!gate?.id || !template || typeof template !== "object") {
    fail(`gate ${gate?.id || "unknown"} is missing evidenceRecordTemplate`);
  }

  const record = {
    gateId: gate.id,
    validated: template.validated,
    validatedAt: template.validatedAt,
    operator: template.operator,
    notes: template.notes,
    evidence: Object.fromEntries(
      (Array.isArray(gate.evidenceFields) ? gate.evidenceFields : []).map((field) => [
        field.key,
        template[field.key] ?? ""
      ])
    )
  };
  const issues = validateRecord(gate, record, template);
  if (issues.length) {
    fail(`${gate.id} has incomplete manual evidence: ${issues.join("; ")}`);
  }
  if (dryRun) {
    previewRecords.push(record);
    continue;
  }
  const result = await postJson("/api/acceptance/validation-records", record);
  if (!result.response.ok || result.data?.ok !== true) {
    const details = Array.isArray(result.data?.errors) ? `: ${result.data.errors.join("; ")}` : "";
    fail(`${gate.id} import returned HTTP ${result.response.status}${details}`);
  }
  latestCompletionMatrix = result.data?.completionMatrix ?? latestCompletionMatrix;
  importedGateIds.push(gate.id);
}

if (dryRun) {
  const packageGateIds = evidencePackage.gates.map((gate) => gate.id).filter(Boolean);
  const previewGateIds = previewRecords.map((record) => record.gateId);
  const missingGateIds = packageGateIds.filter((gateId) => !previewGateIds.includes(gateId));
  console.log(`Dry-run checked ${previewRecords.length} manual acceptance validation record(s): ${previewRecords.map((record) => record.gateId).join(", ")}`);
  console.log(`Dry-run would cover manual gate(s): ${previewGateIds.join(", ") || "none"}`);
  console.log(`Dry-run missing manual gate(s): ${missingGateIds.join(", ") || "none"}`);
  console.log("Dry-run complete. No local record was written and no MCP, model, publish, or schedule action was triggered.");
} else {
  console.log(`Imported ${importedGateIds.length} manual acceptance validation record(s): ${importedGateIds.join(", ")}`);
  if (latestCompletionMatrix) {
    const remaining = Array.isArray(latestCompletionMatrix.remainingWork)
      ? latestCompletionMatrix.remainingWork.map((item) => item.id).join(", ")
      : "unknown";
    console.log(`Completion after import: ${latestCompletionMatrix.completionPercent}%`);
    console.log(`Can mark complete: ${String(Boolean(latestCompletionMatrix.canMarkComplete))}`);
    console.log(`Remaining manual gate(s): ${remaining || "none"}`);
  }
  console.log("Local record import complete. No MCP, model, publish, or schedule action was triggered.");
}
