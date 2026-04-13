import type {
  Campaign,
  CampaignBudgetUsage,
  CampaignProgress,
  CampaignStatus,
} from "./campaign-contracts.js";
import {
  assertLifecycleTransitionAllowed,
  buildCampaignBudgetUsage,
  buildCampaignProgress,
} from "./campaign-lifecycle-workflow.js";
import {
  collectCampaignMissionSnapshots,
  reconcileCampaignRecord,
  requireCampaign,
  type CampaignMissionManagerLike,
  type CampaignStoreLike,
} from "./campaign-manager-workflow.js";

export interface CampaignCatalogStoreLike extends CampaignStoreLike {
  listCampaigns(): Campaign[];
}

export function getCampaignWithReconciledStatus(
  campaignId: string,
  store: CampaignStoreLike,
  missionManager: CampaignMissionManagerLike,
): Campaign | null {
  reconcileCampaignRecord(campaignId, store, missionManager);
  return store.getCampaign(campaignId);
}

export function listCampaignsWithReconciledStatus(
  status: CampaignStatus | undefined,
  store: CampaignCatalogStoreLike,
  missionManager: CampaignMissionManagerLike,
): Campaign[] {
  const campaigns = store.listCampaigns();
  for (const campaign of campaigns) {
    reconcileCampaignRecord(campaign.id, store, missionManager);
  }

  const refreshedCampaigns = store.listCampaigns();
  if (!status) {
    return refreshedCampaigns;
  }
  return refreshedCampaigns.filter((campaign) => campaign.status === status);
}

export function buildCampaignProgressReport(
  campaignId: string,
  store: CampaignStoreLike,
  missionManager: CampaignMissionManagerLike,
): CampaignProgress {
  requireCampaign(reconcileCampaignRecord(campaignId, store, missionManager), campaignId);
  const entries = store.missions(campaignId);
  return buildCampaignProgress(entries, collectCampaignMissionSnapshots(entries, missionManager));
}

export function buildCampaignBudgetUsageReport(
  campaignId: string,
  store: CampaignStoreLike,
  missionManager: CampaignMissionManagerLike,
): CampaignBudgetUsage {
  const campaign = requireCampaign(
    reconcileCampaignRecord(campaignId, store, missionManager),
    campaignId,
  );
  const entries = store.missions(campaignId);
  const snapshots = collectCampaignMissionSnapshots(entries, missionManager);
  const totalSteps = snapshots.reduce((sum, snapshot) => sum + snapshot.stepCount, 0);
  return buildCampaignBudgetUsage(campaign, entries, totalSteps);
}

export function setCampaignLifecycleStatus(
  campaignId: string,
  status: CampaignStatus,
  store: CampaignStoreLike,
): void {
  const campaign = requireCampaign(store.getCampaign(campaignId), campaignId);
  assertLifecycleTransitionAllowed(campaign.status, status);
  store.setStatus(campaignId, status);
}
