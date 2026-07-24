import { randomUUID } from "node:crypto";
import { readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const runtimeCollectionFiles = [
  "history.json",
  "jobs.json",
  "assets.json",
  "publish-intents.json",
  "publish-audit.json",
  "chat-history.json",
  "agent-traces.json",
  "viral-knowledge.json"
];

export const cleanupTargets = [
  ...runtimeCollectionFiles,
  "drafts.json",
  "creator-memory.json",
  "workspace-state.json",
  "post-project.json"
];

export const preservedDataFiles = [
  "settings.json",
  "local-action-token.json",
  "acceptance-completion-matrix.json",
  "manual-acceptance-evidence-package.json"
];

function blankWorkspace(now) {
  return {
    schemaVersion: 1,
    workspaceId: "local-default",
    updatedAt: now,
    selectedSamples: [],
    currentDraft: null,
    selectedImageIds: [],
    productImageIds: [],
    publishPlan: null,
    recentJobIds: [],
    recentRunIds: [],
    recentConversationIds: []
  };
}

function blankProject(now) {
  return {
    schemaVersion: 1,
    id: "post-local-default",
    productInfo: { referenceAssetIds: [] },
    evidencePack: { sampleIds: [], insights: [] },
    focusedEvidenceIds: [],
    selectedSamples: [],
    copyDraft: null,
    copyVersions: [],
    imagePrompts: [],
    generatedImages: [],
    generatedImageVersions: [],
    selectedImages: [],
    publishPlan: null,
    agentMemory: [],
    auditStatus: "unchecked",
    currentStage: "empty",
    allowedActions: [],
    updatedAt: now
  };
}

async function writeJsonAtomic(filePath, value) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

export async function clearRuntimeData(projectRoot = process.cwd()) {
  const dataDir = path.resolve(projectRoot, "data");
  const expectedDataDir = path.join(path.resolve(projectRoot), "data");
  if (dataDir !== expectedDataDir) {
    throw new Error(`Refusing to clean unexpected data directory: ${dataDir}`);
  }

  const now = new Date().toISOString();
  await Promise.all(
    runtimeCollectionFiles.map((file) => writeJsonAtomic(path.join(dataDir, file), []))
  );
  await Promise.all([
    writeJsonAtomic(path.join(dataDir, "drafts.json"), { currentDraft: null }),
    writeJsonAtomic(path.join(dataDir, "creator-memory.json"), { schemaVersion: 1, profiles: {} }),
    writeJsonAtomic(path.join(dataDir, "workspace-state.json"), blankWorkspace(now)),
    writeJsonAtomic(path.join(dataDir, "post-project.json"), blankProject(now))
  ]);

  const entries = await readdir(dataDir);
  const temporaryFiles = entries.filter(
    (name) =>
      (name.startsWith("workspace-state.json.") || name.startsWith("post-project.json.")) &&
      name.endsWith(".tmp")
  );
  await Promise.all(temporaryFiles.map((name) => rm(path.join(dataDir, name), { force: true })));

  return {
    clearedFiles: cleanupTargets.length,
    removedTemporaryFiles: temporaryFiles.length,
    preservedFiles: preservedDataFiles
  };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const result = await clearRuntimeData();
  console.log(
    `Cleared ${result.clearedFiles} runtime files and removed ${result.removedTemporaryFiles} temporary files.`
  );
  console.log(`Preserved: ${result.preservedFiles.join(", ")}`);
}
