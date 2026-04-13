import type Database from "better-sqlite3";

import type { CampaignMissionEntry } from "./campaign-contracts.js";
import { mapCampaignMissionRow } from "./campaign-store-workflow.js";

export function insertCampaignMissionRecord(
  db: Database.Database,
  campaignId: string,
  missionId: string,
  opts?: { priority?: number; dependsOn?: string[] },
  missionCount = 0,
): void {
  db.prepare(
    `INSERT INTO campaign_missions (campaign_id, mission_id, priority, depends_on, added_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    campaignId,
    missionId,
    opts?.priority ?? missionCount + 1,
    JSON.stringify(opts?.dependsOn ?? []),
    new Date().toISOString(),
  );
}

export function removeCampaignMissionRecord(
  db: Database.Database,
  campaignId: string,
  missionId: string,
): void {
  db.prepare(
    "DELETE FROM campaign_missions WHERE campaign_id = ? AND mission_id = ?",
  ).run(campaignId, missionId);
}

export function countCampaignMissions(
  db: Database.Database,
  campaignId: string,
): number {
  const row = db.prepare(
    "SELECT COUNT(*) as count FROM campaign_missions WHERE campaign_id = ?",
  ).get(campaignId) as { count: number };
  return row.count;
}

export function hasCampaignMission(
  db: Database.Database,
  campaignId: string,
  missionId: string,
): boolean {
  const row = db.prepare(
    "SELECT 1 FROM campaign_missions WHERE campaign_id = ? AND mission_id = ?",
  ).get(campaignId, missionId);
  return Boolean(row);
}

export function listCampaignMissionEntries(
  db: Database.Database,
  campaignId: string,
): CampaignMissionEntry[] {
  const rows = db.prepare(
    "SELECT * FROM campaign_missions WHERE campaign_id = ? ORDER BY priority ASC, added_at ASC",
  ).all(campaignId) as Array<Record<string, unknown>>;
  return rows.map((row) => mapCampaignMissionRow(row));
}
