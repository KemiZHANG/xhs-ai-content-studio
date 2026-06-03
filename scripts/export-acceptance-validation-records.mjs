import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const baseUrl = (process.env.XHS_STUDIO_URL || "http://localhost:3000").replace(/\/+$/, "");
const outputPath = resolve(process.env.XHS_ACCEPTANCE_RECORDS_PATH || "data/acceptance-validation-records-export.json");

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function fail(message) {
  console.error(`Acceptance validation records export failed: ${message}`);
  process.exit(1);
}

const result = await getJson("/api/acceptance/validation-records");
if (!result.response.ok) {
  fail(`/api/acceptance/validation-records returned HTTP ${result.response.status}`);
}

const payload = result.data;
if (!payload?.ok || !Array.isArray(payload.records)) {
  fail("/api/acceptance/validation-records did not return records");
}
if (!payload.status || typeof payload.status !== "object") {
  fail("/api/acceptance/validation-records did not return status");
}
if (!payload.deliverySummary || typeof payload.deliverySummary !== "object") {
  fail("/api/acceptance/validation-records did not return deliverySummary");
}
if (!payload.completionMatrix || typeof payload.completionMatrix !== "object") {
  fail("/api/acceptance/validation-records did not return completionMatrix");
}
if (payload.completionMatrix.completionPercent !== payload.status.completionPercent) {
  fail("validation records completionMatrix and status disagree on completionPercent");
}
if (payload.completionMatrix.canMarkComplete !== payload.status.canMarkComplete) {
  fail("validation records completionMatrix and status disagree on canMarkComplete");
}

const exportPayload = {
  exportedAt: new Date().toISOString(),
  source: `${baseUrl}/api/acceptance/validation-records`,
  records: payload.records,
  status: payload.status,
  deliverySummary: payload.deliverySummary,
  completionMatrix: payload.completionMatrix
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(exportPayload, null, 2)}\n`, "utf8");

console.log(`Acceptance validation records exported to ${outputPath}`);
console.log(`Recorded manual gate(s): ${payload.records.map((record) => record.gateId).join(", ") || "none"}`);
console.log(`Completion at export: ${payload.status.completionPercent}%`);
console.log("Read-only export complete. No MCP, model, publish, or schedule action was triggered.");
