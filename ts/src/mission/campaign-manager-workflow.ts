import type {
  Campaign,
  CampaignMissionEntry,
} from "./campaign-contracts.js";
import {
  deriveReconciledCampaignStatus,
  type CampaignMissionSnapshot,
} from "./campaign-lifecycle-workflow.js";

export interface CampaignStoreLike {
  getCampaign(campaignId: string): Campaign | null;
  missions(campaignId: string): CampaignMissionEntry[];
  hasMission(campaignId: string, missionId: string): boolean;
  setStatus(campaignId: string, status: Campaign["status"]): void;
}

export interface CampaignMissionManagerLike {
  get(missionId: string): { status: string } | null;
  steps(missionId: string): unknown[];
}

export function requireCampaign(
  campaign: Campaign | null,
  campaignId: string,
): Campaign {
  if (!campaign) {
    throw new Error(`Campaign not found: ${campaignId}`);
  }
  return campaign;
}

export function validateCampaignMissionAddition(opts: {
  campaignId: string;
  missionId: string;
  missionExists: boolean;
  missionAlreadyLinked: boolean;
  dependsOn?: string[];
  hasMissionInCampaign: (missionId: string) => boolean;
}): void {
  if (!opts.missionExists) {
    throw new Error(`Mission not found: ${opts.missionId}`);
  }
  if (opts.missionAlreadyLinked) {
    throw new Error(`Mission already in campaign: ${opts.missionId}`);
  }

  for (const dependencyId of opts.dependsOn ?? []) {
    if (dependencyId === opts.missionId) {
      throw new Error(`Mission cannot depend on itself: ${opts.missionId}`);
    }
    if (!opts.hasMissionInCampaign(dependencyId)) {
      throw new Error(`Dependency mission not in campaign: ${dependencyId}`);
    }
  }
}

export function collectCampaignMissionSnapshots(
  entries: CampaignMissionEntry[],
  missionManager: CampaignMissionManagerLike,
): CampaignMissionSnapshot[] {
  const snapshots: CampaignMissionSnapshot[] = [];
  for (const entry of entries) {
    const mission = missionManager.get(entry.missionId);
    if (!mission) {
      continue;
    }
    snapshots.push({
      status: mission.status as CampaignMissionSnapshot["status"],
      stepCount: missionManager.steps(entry.missionId).length,
    });
  }
  return snapshots;
}

export function reconcileCampaignRecord(
  campaignId: string,
  store: CampaignStoreLike,
  missionManager: CampaignMissionManagerLike,
): Campaign | null {
  const campaign = store.getCampaign(campaignId);
  if (!campaign) {
    return null;
  }

  const entries = store.missions(campaignId);
  const nextStatus = deriveReconciledCampaignStatus(
    campaign,
    entries,
    collectCampaignMissionSnapshots(entries, missionManager),
  );

  if (nextStatus !== campaign.status) {
    store.setStatus(campaignId, nextStatus);
    return store.getCampaign(campaignId);
  }

  return campaign;
}
