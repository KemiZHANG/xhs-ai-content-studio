import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const baseUrl = (process.env.XHS_STUDIO_URL || "http://localhost:3000").replace(/\/+$/, "");
const outputPath = resolve(process.env.XHS_ACCEPTANCE_EVIDENCE_PATH || "data/manual-acceptance-evidence-package.json");

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function fail(message) {
  console.error(`Acceptance evidence export failed: ${message}`);
  process.exit(1);
}

const result = await getJson("/api/acceptance/status");
if (!result.response.ok) {
  fail(`/api/acceptance/status returned HTTP ${result.response.status}`);
}

const evidencePackage = result.data?.evidencePackage;
if (!evidencePackage || evidencePackage.schemaVersion !== 1 || !Array.isArray(evidencePackage.gates)) {
  fail("/api/acceptance/status did not return evidencePackage v1");
}
if (evidencePackage.canMarkComplete !== false) {
  fail("evidencePackage must not mark completion while manual gates remain");
}
if (evidencePackage.gates.some((gate) => gate.manualOnly !== true || !gate.evidenceRecordTemplate)) {
  fail("evidencePackage gates must remain manualOnly and include evidenceRecordTemplate");
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidencePackage, null, 2)}\n`, "utf8");

console.log(`Acceptance evidence package exported to ${outputPath}`);
console.log("Read-only export complete. No MCP, model, publish, or schedule action was triggered.");
