import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OneClickInput, OneClickResult } from "@/lib/workflows/one-click";

export type WorkflowRun = {
  id: string;
  createdAt: string;
  input: OneClickInput;
  result: OneClickResult;
};

const historyPath = () => path.join(process.cwd(), "data", "history.json");

export async function listHistory(): Promise<WorkflowRun[]> {
  try {
    const raw = await readFile(historyPath(), "utf8");
    const parsed = JSON.parse(raw) as WorkflowRun[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function appendHistory(input: OneClickInput, result: OneClickResult): Promise<WorkflowRun> {
  const runs = await listHistory();
  const run: WorkflowRun = {
    id: `run-${Date.now()}`,
    createdAt: new Date().toISOString(),
    input,
    result
  };
  const nextRuns = [run, ...runs].slice(0, 100);
  const filePath = historyPath();

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(nextRuns, null, 2)}\n`, "utf8");

  return run;
}
