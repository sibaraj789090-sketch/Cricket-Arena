import type { CashAdditionRequest, PlayerRestriction, PlayerProfileSummary, RestrictionType } from '../types/adminControl.ts';

export interface ServerAuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  timestamp: string;
}

// 1. In-memory Cash Addition Requests
export const serverCashRequests = new Map<string, CashAdditionRequest>();

// Seed initial demo requests
const seedReq1: CashAdditionRequest = {
  id: 'req-seed-1',
  userId: 'user-demo-1',
  userName: 'Rajesh_Sharma',
  requestedAmount: 500,
  reason: 'UPI transfer completed via GPay ref 90481239. Please credit match tokens.',
  status: 'pending',
  createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
};
const seedReq2: CashAdditionRequest = {
  id: 'req-seed-2',
  userId: 'user-player-2',
  userName: 'Vikram_Rathore',
  requestedAmount: 1000,
  approvedAmount: 1000,
  reason: 'Top-up for 4P High Roller Table entry.',
  adminNote: 'Verified bank transaction slip UTR 481920391. Approved.',
  status: 'approved',
  processedBy: 'admin-master',
  processedByName: 'Master Admin',
  processedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
};
serverCashRequests.set(seedReq1.id, seedReq1);
serverCashRequests.set(seedReq2.id, seedReq2);

// 2. In-memory Player Restrictions & Bans
export const serverPlayerRestrictions = new Map<string, PlayerRestriction>();

const seedBan1: PlayerRestriction = {
  id: 'res-seed-1',
  userId: 'usr-suspicious-99',
  userName: 'SpeedHacker_99',
  restrictionType: 'full_ban',
  status: 'active',
  reason: 'Automated turn timeout exploit & multi-accounting detection.',
  internalNote: 'Caught sending 40 consecutive moves within 200ms. Account permanently banned.',
  adminId: 'admin-master',
  adminName: 'Security Admin',
  createdAt: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
};
const seedBan2: PlayerRestriction = {
  id: 'res-seed-2',
  userId: 'usr-quitter-12',
  userName: 'RageQuitter_Pro',
  restrictionType: 'ludo_ban',
  status: 'active',
  reason: 'Frequent table stalling and intentional disconnects in 4P high cash tables.',
  internalNote: 'Temporarily restricted from Ludo tables for 7 days.',
  adminId: 'admin-master',
  adminName: 'FairPlay Team',
  expiresAt: new Date(Date.now() + 5 * 86400 * 1000).toISOString(),
  createdAt: new Date(Date.now() - 1 * 86400 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - 1 * 86400 * 1000).toISOString(),
};
serverPlayerRestrictions.set(seedBan1.id, seedBan1);
serverPlayerRestrictions.set(seedBan2.id, seedBan2);

// Check if user is currently banned or restricted
export function checkUserBanStatus(userId: string, context: 'all' | 'ludo' = 'all'): {
  banned: boolean;
  restriction?: PlayerRestriction;
  reason?: string;
} {
  if (!userId) return { banned: false };

  const now = new Date();
  for (const restriction of serverPlayerRestrictions.values()) {
    if (restriction.userId === userId && restriction.status === 'active') {
      if (restriction.expiresAt && new Date(restriction.expiresAt) <= now) {
        restriction.status = 'lifted';
        continue;
      }

      if (restriction.restrictionType === 'full_ban' || restriction.restrictionType === 'temp_suspend') {
        return { banned: true, restriction, reason: restriction.reason };
      }

      if (context === 'ludo' && restriction.restrictionType === 'ludo_ban') {
        return { banned: true, restriction, reason: restriction.reason };
      }
    }
  }

  return { banned: false };
}
