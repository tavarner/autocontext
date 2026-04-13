import type Database from "better-sqlite3";

import type {
  Campaign,
  CampaignBudget,
  CampaignStatus,
} from "./campaign-contracts.js";
import {
  buildCampaignStatusTimestamps,
  mapCampaignRow,
} from "./campaign-store-workflow.js";

export function createCampaignRecord(
  db: Database.Database,
  id: string,
  opts: {
    name: string;
    goal: string;
    budget?: CampaignBudget;
    metadata?: Record<string, unknown>;
  },
): void {
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO campaigns (id, name, goal, status, budget, metadata, created_at)
     VALUES (?, ?, ?, 'active', ?, ?, ?)`,
  ).run(
    id,
    opts.name,
    opts.goal,
    opts.budget ? JSON.stringify(opts.budget) : null,
    JSON.stringify(opts.metadata ?? {}),
    createdAt,
  );
}

export function getCampaignRecord(
  db: Database.Database,
  id: string,
): Campaign | null {
  const row = db.prepare(
    "SELECT * FROM campaigns WHERE id = ?",
  ).get(id) as Record<string, unknown> | undefined;
  return row ? mapCampaignRow(row) : null;
}

export function listCampaignRecords(
  db: Database.Database,
): Campaign[] {
  const rows = db.prepare(
    "SELECT * FROM campaigns ORDER BY created_at DESC",
  ).all() as Array<Record<string, unknown>>;
  return rows.map((row) => mapCampaignRow(row));
}

export function updateCampaignStatusRecord(
  db: Database.Database,
  campaignId: string,
  status: CampaignStatus,
): void {
  const timestamps = buildCampaignStatusTimestamps(status);
  db.prepare(
    "UPDATE campaigns SET status = ?, updated_at = ?, completed_at = ? WHERE id = ?",
  ).run(status, timestamps.updatedAt, timestamps.completedAt, campaignId);
}

export function touchCampaignRecord(
  db: Database.Database,
  campaignId: string,
): void {
  db.prepare(
    "UPDATE campaigns SET updated_at = ? WHERE id = ?",
  ).run(new Date().toISOString(), campaignId);
}
