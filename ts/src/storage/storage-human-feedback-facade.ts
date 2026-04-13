import type Database from "better-sqlite3";

import type { HumanFeedbackRow } from "./storage-contracts.js";
import {
  getCalibrationExampleRecords,
  getHumanFeedbackRecords,
  insertHumanFeedbackRecord,
} from "./human-feedback-store.js";

export function insertStoreHumanFeedback(
  db: Database.Database,
  scenarioName: string,
  agentOutput: string,
  humanScore?: number | null,
  humanNotes = "",
  generationId?: string | null,
): number {
  return insertHumanFeedbackRecord(
    db,
    scenarioName,
    agentOutput,
    humanScore,
    humanNotes,
    generationId,
  );
}

export function getStoreHumanFeedback(
  db: Database.Database,
  scenarioName: string,
  limit = 10,
): HumanFeedbackRow[] {
  return getHumanFeedbackRecords<HumanFeedbackRow>(db, scenarioName, limit);
}

export function getStoreCalibrationExamples(
  db: Database.Database,
  scenarioName: string,
  limit = 5,
): HumanFeedbackRow[] {
  return getCalibrationExampleRecords<HumanFeedbackRow>(db, scenarioName, limit);
}
