import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const baseUrl = (process.env.XHS_STUDIO_URL || "http://localhost:3000").replace(/\/+$/, "");
const inputPath = resolve(process.env.XHS_ACCEPTANCE_EVIDENCE_PATH || "data/manual-acceptance-evidence-package.json");

function fail(message) {
  console.error(`Acceptance validation record import failed: ${message}`);
  process.exit(1);
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
  const result = await postJson("/api/acceptance/validation-records", record);
  if (!result.response.ok || result.data?.ok !== true) {
    const details = Array.isArray(result.data?.errors) ? `: ${result.data.errors.join("; ")}` : "";
    fail(`${gate.id} import returned HTTP ${result.response.status}${details}`);
  }
  importedGateIds.push(gate.id);
}

console.log(`Imported ${importedGateIds.length} manual acceptance validation record(s): ${importedGateIds.join(", ")}`);
console.log("Local record import complete. No MCP, model, publish, or schedule action was triggered.");
