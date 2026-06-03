import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const baseUrl = (process.env.XHS_STUDIO_URL || "http://localhost:3000").replace(/\/+$/, "");
const outputPath = resolve(process.env.XHS_ACCEPTANCE_MATRIX_PATH || "data/acceptance-completion-matrix.json");

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function fail(message) {
  console.error(`Acceptance completion matrix export failed: ${message}`);
  process.exit(1);
}

const result = await getJson("/api/acceptance/completion-matrix");
if (!result.response.ok) {
  fail(`/api/acceptance/completion-matrix returned HTTP ${result.response.status}`);
}

const matrix = result.data?.completionMatrix;
if (!matrix || typeof matrix !== "object") {
  fail("/api/acceptance/completion-matrix did not return completionMatrix");
}
if (!Array.isArray(matrix.automatedCoverage) || matrix.automatedCoverage.length < 6) {
  fail("completionMatrix is missing automated coverage");
}
if (!Array.isArray(matrix.manualExternalGates) || matrix.manualExternalGates.length < 4) {
  fail("completionMatrix is missing manual external gates");
}
if (!Array.isArray(matrix.remainingWork)) {
  fail("completionMatrix is missing remainingWork");
}
if (matrix.manualExternalGates.some((gate) => gate.canBeAutomated !== false)) {
  fail("completionMatrix manual external gates must remain non-automatable");
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(matrix, null, 2)}\n`, "utf8");

console.log(`Acceptance completion matrix exported to ${outputPath}`);
console.log("Read-only export complete. No MCP, model, publish, or schedule action was triggered.");
