import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const inputPath = resolve(process.env.XHS_ACCEPTANCE_EVIDENCE_PATH || "data/manual-acceptance-evidence-package.json");

function fail(message) {
  console.error(`Acceptance evidence validation failed: ${message}`);
  process.exit(1);
}

function isFilled(value) {
  return typeof value === "string" ? value.trim().length > 0 : value === true;
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

const issues = [];
for (const gate of evidencePackage.gates) {
  const gateId = gate?.id || "unknown";
  const record = gate?.evidenceRecordTemplate;
  if (gate?.manualOnly !== true) {
    issues.push(`${gateId}: gate must remain manualOnly`);
  }
  if (!record || typeof record !== "object") {
    issues.push(`${gateId}: missing evidenceRecordTemplate`);
    continue;
  }
  if (record.validated !== true) {
    issues.push(`${gateId}: set validated to true after manual external validation`);
  }
  for (const key of ["validatedAt", "operator", "notes"]) {
    if (!isFilled(record[key])) {
      issues.push(`${gateId}: fill ${key}`);
    }
  }
  for (const field of Array.isArray(gate.evidenceFields) ? gate.evidenceFields : []) {
    if (field.required && !isFilled(record[field.key])) {
      issues.push(`${gateId}: fill ${field.key} (${field.label})`);
    }
  }
}

if (issues.length > 0) {
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  fail(`${issues.length} required evidence item(s) are missing`);
}

console.log(`Acceptance evidence package is complete: ${inputPath}`);
console.log("Local validation only. No MCP, model, publish, or schedule action was triggered.");
