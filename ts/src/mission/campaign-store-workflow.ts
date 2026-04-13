import type Database from "better-sqlite3";
import type {
  Campaign,
  CampaignBudget,
  CampaignMissionEntry,
  CampaignStatus,
} from "./campaign-contracts.js";
import { isTerminalCampaignStatus } from "./campaign-lifecycle-workflow.js";

export function createCampaignTables(db: Database.Database): void {
  db.exec(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        goal TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        budget TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS campaign_missions (
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
        priority INTEGER NOT NULL,
        depends_on TEXT DEFAULT '[]',
        added_at TEXT NOT NULL,
        PRIMARY KEY (campaign_id, mission_id)
      );
    `);
}

export function mapCampaignRow(row: Record<string, unknown>): Campaign {
  return {
    id: row.id as string,
    name: row.name as string,
    goal: row.goal as string,
    status: row.status as CampaignStatus,
    budget: row.budget ? (JSON.parse(row.budget as string) as CampaignBudget) : undefined,
    metadata: JSON.parse((row.metadata as string) ?? "{}"),
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? undefined,
    completedAt: (row.completed_at as string) ?? undefined,
  };
}

export function mapCampaignMissionRow(
  row: Record<string, unknown>,
): CampaignMissionEntry {
  return {
    campaignId: row.campaign_id as string,
    missionId: row.mission_id as string,
    priority: row.priority as number,
    dependsOn: JSON.parse((row.depends_on as string) ?? "[]"),
    addedAt: row.added_at as string,
  };
}

export function buildCampaignStatusTimestamps(
  status: CampaignStatus,
): { updatedAt: string; completedAt: string | null } {
  return {
    updatedAt: new Date().toISOString(),
    completedAt: isTerminalCampaignStatus(status) ? new Date().toISOString() : null,
  };
}
