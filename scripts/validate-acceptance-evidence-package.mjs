import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const inputPath = resolve(process.env.XHS_ACCEPTANCE_EVIDENCE_PATH || "data/manual-acceptance-evidence-package.json");
const reportPath = resolve(process.env.XHS_ACCEPTANCE_REPORT_PATH || "data/manual-acceptance-validation-report.json");

async function writeReport(report) {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function fail(message, issues = []) {
  await writeReport({
    ok: false,
    validatedAt: new Date().toISOString(),
    inputPath,
    reportPath,
    message,
    issues
  });
  console.error(`Acceptance evidence validation failed: ${message}`);
  console.error(`Validation report written to ${reportPath}`);
  process.exit(1);
}

function isFilled(value) {
  return typeof value === "string" ? value.trim().length > 0 : value === true;
}

let evidencePackage;
try {
  evidencePackage = JSON.parse(await readFile(inputPath, "utf8"));
} catch (error) {
  await fail(`could not read ${inputPath}. Export it first with npm run acceptance:evidence-package`);
}

if (evidencePackage?.schemaVersion !== 1 || !Array.isArray(evidencePackage.gates)) {
  await fail("input is not an evidencePackage v1 file");
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
  await fail(`${issues.length} required evidence item(s) are missing`, issues);
}

await writeReport({
  ok: true,
  validatedAt: new Date().toISOString(),
  inputPath,
  reportPath,
  message: "All required manual external validation evidence fields are complete.",
  gates: evidencePackage.gates.map((gate) => gate.id)
});

console.log(`Acceptance evidence package is complete: ${inputPath}`);
console.log(`Validation report written to ${reportPath}`);
console.log("Local validation only. No MCP, model, publish, or schedule action was triggered.");
