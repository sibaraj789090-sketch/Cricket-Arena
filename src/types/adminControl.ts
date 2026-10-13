import { LudoCashTable, LudoCashMatch, LudoCashMatchRecord } from './ludoCash';
import { UserWallet } from './wallet';

export type CashRequestStatus = 'pending' | 'approved' | 'rejected';

export interface CashAdditionRequest {
  id: string;
  userId: string;
  userName: string;
  requestedAmount: number;
  approvedAmount?: number;
  reason: string;
  adminNote?: string;
  status: CashRequestStatus;
  processedBy?: string;
  processedByName?: string;
  processedAt?: string;
  createdAt: string;
}

export type RestrictionType = 'full_ban' | 'ludo_ban' | 'temp_suspend';
export type RestrictionStatus = 'active' | 'lifted';

export interface PlayerRestriction {
  id: string;
  userId: string;
  userName: string;
  restrictionType: RestrictionType;
  status: RestrictionStatus;
  reason: string;
  internalNote?: string;
  adminId: string;
  adminName: string;
  expiresAt?: string;
  liftedAt?: string;
  liftedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerProfileSummary {
  userId: string;
  userName: string;
  email?: string;
  avatar?: string;
  registeredAt: string;
  balance: number;
  lockedBalance: number;
  totalMatchesPlayed: number;
  wins: number;
  losses: number;
  recentMatches: LudoCashMatchRecord[];
  pendingCashRequestsCount: number;
  activeMatchId?: string;
  restriction?: PlayerRestriction;
}

export interface AdminMetrics {
  totalRegisteredPlayers: number;
  onlinePlayers: number;
  activeLudoMatches: number;
  waitingTables: number;
  pendingCashRequests: number;
  bannedPlayersCount: number;
  totalGameCreditsDistributed: number;
}
