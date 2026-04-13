/**
 * Campaign abstraction — coordinating multiple missions (AC-428).
 *
 * A Campaign is a higher-order objective layer above missions.
 * It models long-term goals that require multiple coordinated missions:
 * - formalize an area of mathematics
 * - ship a product initiative with dependent missions
 * - close a family of related incidents or migrations
 *
 * Campaigns have their own lifecycle, budget tracking, progress aggregation,
 * and mission dependency graphs. They do not replace missions — they
 * compose them.
 */

import type { MissionManager } from "./manager.js";
import type {
  Campaign,
  CampaignBudget,
  CampaignBudgetUsage,
  CampaignMissionEntry,
  CampaignProgress,
  CampaignStatus,
} from "./campaign-contracts.js";
import {
  buildCampaignBudgetUsageReport,
  buildCampaignProgressReport,
  getCampaignWithReconciledStatus,
  listCampaignsWithReconciledStatus,
  setCampaignLifecycleStatus,
} from "./campaign-manager-access-workflow.js";
import { requireCampaign, validateCampaignMissionAddition } from "./campaign-manager-workflow.js";
import { CampaignStore } from "./campaign-store.js";

export type {
  Campaign,
  CampaignBudget,
  CampaignBudgetUsage,
  CampaignMissionEntry,
  CampaignProgress,
  CampaignStatus,
} from "./campaign-contracts.js";

// ---------------------------------------------------------------------------
// CampaignManager
// ---------------------------------------------------------------------------

export class CampaignManager {
  #missionManager: MissionManager;
  #store: CampaignStore;

  constructor(missionManager: MissionManager) {
    this.#missionManager = missionManager;
    this.#store = new CampaignStore(missionManager.getDbPath());
  }

  /**
   * Create a new campaign.
   */
  create(opts: {
    name: string;
    goal: string;
    budget?: CampaignBudget;
    metadata?: Record<string, unknown>;
  }): string {
    return this.#store.createCampaign(opts);
  }

  /**
   * Get a campaign by ID.
   */
  get(id: string): Campaign | null {
    return getCampaignWithReconciledStatus(id, this.#store, this.#missionManager);
  }

  /**
   * List campaigns, optionally filtered by status.
   */
  list(status?: CampaignStatus): Campaign[] {
    return listCampaignsWithReconciledStatus(status, this.#store, this.#missionManager);
  }

  /**
   * Add a mission to a campaign.
   */
  addMission(
    campaignId: string,
    missionId: string,
    opts?: { priority?: number; dependsOn?: string[] },
  ): void {
    requireCampaign(this.#store.getCampaign(campaignId), campaignId);
    validateCampaignMissionAddition({
      campaignId,
      missionId,
      missionExists: Boolean(this.#missionManager.get(missionId)),
      missionAlreadyLinked: this.#store.hasMission(campaignId, missionId),
      dependsOn: opts?.dependsOn,
      hasMissionInCampaign: (dependencyId) => this.#store.hasMission(campaignId, dependencyId),
    });

    this.#store.addMission(campaignId, missionId, opts);
    getCampaignWithReconciledStatus(campaignId, this.#store, this.#missionManager);
  }

  /**
   * Remove a mission from a campaign.
   */
  removeMission(campaignId: string, missionId: string): void {
    requireCampaign(this.#store.getCampaign(campaignId), campaignId);
    this.#store.removeMission(campaignId, missionId);
    getCampaignWithReconciledStatus(campaignId, this.#store, this.#missionManager);
  }

  /**
   * Get missions in a campaign, ordered by priority.
   */
  missions(campaignId: string): CampaignMissionEntry[] {
    requireCampaign(this.#store.getCampaign(campaignId), campaignId);
    return this.#store.missions(campaignId);
  }

  /**
   * Get campaign progress aggregated from mission statuses.
   */
  progress(campaignId: string): CampaignProgress {
    return buildCampaignProgressReport(campaignId, this.#store, this.#missionManager);
  }

  /**
   * Get campaign budget usage aggregated from missions.
   */
  budgetUsage(campaignId: string): CampaignBudgetUsage {
    return buildCampaignBudgetUsageReport(campaignId, this.#store, this.#missionManager);
  }

  /**
   * Pause the campaign.
   */
  pause(campaignId: string): void {
    setCampaignLifecycleStatus(campaignId, "paused", this.#store);
  }

  /**
   * Resume the campaign.
   */
  resume(campaignId: string): void {
    setCampaignLifecycleStatus(campaignId, "active", this.#store);
  }

  /**
   * Cancel the campaign.
   */
  cancel(campaignId: string): void {
    setCampaignLifecycleStatus(campaignId, "canceled", this.#store);
  }

  close(): void {
    this.#store.close();
  }
}
