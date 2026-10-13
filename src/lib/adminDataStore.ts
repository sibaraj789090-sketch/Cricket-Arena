import {
  CashAdditionRequest,
  PlayerRestriction,
  PlayerProfileSummary,
  RestrictionType,
} from '../types/adminControl';
import { supabase, isSupabaseConfigured } from './supabase';
import { WalletDataStore } from './walletStorage';
import { CricketDataStore } from './storage';
import { DEMO_USER_PROFILE, DEMO_ADMIN_PROFILE } from './initialData';

const STORAGE_KEYS = {
  CASH_REQUESTS: 'cricket_arena_cash_addition_requests',
  PLAYER_RESTRICTIONS: 'cricket_arena_player_restrictions',
  PLAYERS_DIRECTORY: 'cricket_arena_players_directory',
};

// Initial Seed Cash Requests for demo/preview
const INITIAL_CASH_REQUESTS: CashAdditionRequest[] = [
  {
    id: 'req-seed-1',
    userId: 'user-demo-1',
    userName: 'Rajesh_Sharma',
    requestedAmount: 500,
    reason: 'UPI transfer completed via GPay ref 90481239. Please credit match tokens.',
    status: 'pending',
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
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
  },
  {
    id: 'req-seed-3',
    userId: 'user-player-3',
    userName: 'Aman_DiceKing',
    requestedAmount: 250,
    reason: 'Deposit failed in automatic gateway. Sent screenshot.',
    adminNote: 'UTR was already redeemed previously. Rejected as duplicate.',
    status: 'rejected',
    processedBy: 'admin-master',
    processedByName: 'Master Admin',
    processedAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 9 * 3600 * 1000).toISOString(),
  },
];

// Initial Seed Restrictions
const INITIAL_RESTRICTIONS: PlayerRestriction[] = [
  {
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
  },
  {
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
  },
];

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`Failed to save ${key}:`, err);
  }
}

export class AdminDataStore {
  // ==========================================
  // 1. CASH ADDITION REQUESTS
  // ==========================================
  static getCashRequests(): CashAdditionRequest[] {
    return loadJson<CashAdditionRequest[]>(STORAGE_KEYS.CASH_REQUESTS, INITIAL_CASH_REQUESTS);
  }

  static createCashRequest(params: {
    userId: string;
    userName: string;
    requestedAmount: number;
    reason: string;
  }): CashAdditionRequest {
    const requests = this.getCashRequests();
    const newRequest: CashAdditionRequest = {
      id: `req-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      userId: params.userId,
      userName: params.userName,
      requestedAmount: Math.max(10, Math.floor(params.requestedAmount)),
      reason: params.reason.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    requests.unshift(newRequest);
    saveJson(STORAGE_KEYS.CASH_REQUESTS, requests);

    // Sync to Supabase if available
    if (isSupabaseConfigured && supabase) {
      supabase.from('cash_addition_requests').insert({
        id: newRequest.id,
        user_id: newRequest.userId,
        user_name: newRequest.userName,
        requested_amount: newRequest.requestedAmount,
        reason: newRequest.reason,
        status: 'pending',
      }).then(({ error }) => {
        if (error) console.warn('Supabase cash request sync warning:', error.message);
      });
    }

    return newRequest;
  }

  static async approveCashRequest(params: {
    requestId: string;
    approvedAmount: number;
    adminNote?: string;
    adminId: string;
    adminName: string;
  }): Promise<{ success: boolean; error?: string; request?: CashAdditionRequest }> {
    const requests = this.getCashRequests();
    const req = requests.find((r) => r.id === params.requestId);

    if (!req) {
      return { success: false, error: 'Request not found.' };
    }

    // Idempotency: exact-once check
    if (req.status !== 'pending') {
      return {
        success: false,
        error: `Request has already been processed with status: ${req.status}. Duplicate processing prevented.`,
      };
    }

    // Prevent admin from approving their own request
    if (req.userId === params.adminId) {
      return {
        success: false,
        error: 'Violation: Administrators cannot approve their own cash requests.',
      };
    }

    const amount = Number(params.approvedAmount) || req.requestedAmount;
    if (amount <= 0) {
      return { success: false, error: 'Approved amount must be greater than zero.' };
    }

    // 1. Credit wallet through authoritative WalletDataStore
    const creditResult = WalletDataStore.adjustBalance(
      req.userId,
      amount,
      `Manual Cash Addition Approved: ₹${amount} coins (${params.adminNote || 'Admin approval'})`,
      params.adminName
    );

    if (!creditResult.success) {
      return { success: false, error: creditResult.error || 'Failed to credit user wallet.' };
    }

    // 2. Mark request approved
    req.status = 'approved';
    req.approvedAmount = amount;
    req.adminNote = params.adminNote?.trim();
    req.processedBy = params.adminId;
    req.processedByName = params.adminName;
    req.processedAt = new Date().toISOString();

    saveJson(STORAGE_KEYS.CASH_REQUESTS, requests);

    // 3. Add immutable audit log
    CricketDataStore.addAuditLog({
      adminId: params.adminId,
      adminName: params.adminName,
      action: 'CASH_REQUEST_APPROVED',
      targetType: 'cash_request',
      targetId: req.id,
      details: `Approved ${amount} coins for ${req.userName} (UID: ${req.userId}). Note: ${params.adminNote || 'N/A'}.`,
    });

    // 4. Remote Supabase RPC attempt if configured
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.rpc('rpc_admin_approve_cash_request', {
          p_request_id: req.id,
          p_approved_amount: amount,
          p_admin_note: params.adminNote || '',
          p_admin_id: params.adminId,
          p_admin_name: params.adminName,
        });
      } catch (err) {
        console.warn('Supabase remote cash approve sync warning:', err);
      }
    }

    return { success: true, request: req };
  }

  static async rejectCashRequest(params: {
    requestId: string;
    adminNote?: string;
    adminId: string;
    adminName: string;
  }): Promise<{ success: boolean; error?: string; request?: CashAdditionRequest }> {
    const requests = this.getCashRequests();
    const req = requests.find((r) => r.id === params.requestId);

    if (!req) {
      return { success: false, error: 'Request not found.' };
    }

    if (req.status !== 'pending') {
      return {
        success: false,
        error: `Request already processed with status: ${req.status}.`,
      };
    }

    req.status = 'rejected';
    req.adminNote = params.adminNote?.trim() || 'Request rejected by administration.';
    req.processedBy = params.adminId;
    req.processedByName = params.adminName;
    req.processedAt = new Date().toISOString();

    saveJson(STORAGE_KEYS.CASH_REQUESTS, requests);

    // Add immutable audit log (No wallet balance modified!)
    CricketDataStore.addAuditLog({
      adminId: params.adminId,
      adminName: params.adminName,
      action: 'CASH_REQUEST_REJECTED',
      targetType: 'cash_request',
      targetId: req.id,
      details: `Rejected cash request for ${req.userName} (UID: ${req.userId}). Reason: ${req.adminNote}`,
    });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.rpc('rpc_admin_reject_cash_request', {
          p_request_id: req.id,
          p_admin_note: req.adminNote,
          p_admin_id: params.adminId,
          p_admin_name: params.adminName,
        });
      } catch (err) {
        console.warn('Supabase remote cash reject sync warning:', err);
      }
    }

    return { success: true, request: req };
  }

  // ==========================================
  // 2. PLAYER RESTRICTIONS & BANS
  // ==========================================
  static getRestrictions(): PlayerRestriction[] {
    return loadJson<PlayerRestriction[]>(STORAGE_KEYS.PLAYER_RESTRICTIONS, INITIAL_RESTRICTIONS);
  }

  static getActiveRestriction(userId: string): PlayerRestriction | null {
    const list = this.getRestrictions();
    const now = new Date();

    const active = list.find((r) => {
      if (r.userId !== userId || r.status !== 'active') return false;
      if (r.expiresAt && new Date(r.expiresAt) <= now) return false;
      return true;
    });

    return active || null;
  }

  static isUserBanned(userId: string, context: 'all' | 'ludo' = 'all'): {
    banned: boolean;
    restriction?: PlayerRestriction;
    reason?: string;
  } {
    const active = this.getActiveRestriction(userId);
    if (!active) return { banned: false };

    if (active.restrictionType === 'full_ban' || active.restrictionType === 'temp_suspend') {
      return { banned: true, restriction: active, reason: active.reason };
    }

    if (context === 'ludo' && active.restrictionType === 'ludo_ban') {
      return { banned: true, restriction: active, reason: active.reason };
    }

    return { banned: false };
  }

  static applyRestriction(params: {
    userId: string;
    userName?: string;
    restrictionType: RestrictionType;
    reason: string;
    internalNote?: string;
    adminId: string;
    adminName: string;
    durationHours?: number; // for temporary suspension
  }): PlayerRestriction {
    const list = this.getRestrictions();

    // Lift any previous active restrictions for clean state
    list.forEach((r) => {
      if (r.userId === params.userId && r.status === 'active') {
        r.status = 'lifted';
        r.liftedAt = new Date().toISOString();
        r.liftedBy = params.adminId;
      }
    });

    let expiresAt: string | undefined = undefined;
    if (params.restrictionType === 'temp_suspend' && params.durationHours) {
      expiresAt = new Date(Date.now() + params.durationHours * 3600 * 1000).toISOString();
    }

    const newRestriction: PlayerRestriction = {
      id: `res-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      userId: params.userId,
      userName: params.userName || `Player_${params.userId.slice(-4)}`,
      restrictionType: params.restrictionType,
      status: 'active',
      reason: params.reason.trim(),
      internalNote: params.internalNote?.trim(),
      adminId: params.adminId,
      adminName: params.adminName,
      expiresAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    list.unshift(newRestriction);
    saveJson(STORAGE_KEYS.PLAYER_RESTRICTIONS, list);

    CricketDataStore.addAuditLog({
      adminId: params.adminId,
      adminName: params.adminName,
      action: `PLAYER_${params.restrictionType.toUpperCase()}`,
      targetType: 'user',
      targetId: params.userId,
      details: `Applied ${params.restrictionType} to user ${newRestriction.userName}. Reason: ${params.reason}. ${expiresAt ? `Expires: ${expiresAt}` : ''}`,
    });

    return newRestriction;
  }

  static liftRestriction(params: {
    userId: string;
    adminId: string;
    adminName: string;
    reason?: string;
  }): { success: boolean; liftedCount: number } {
    const list = this.getRestrictions();
    let count = 0;

    list.forEach((r) => {
      if (r.userId === params.userId && r.status === 'active') {
        r.status = 'lifted';
        r.liftedAt = new Date().toISOString();
        r.liftedBy = params.adminId;
        r.updatedAt = new Date().toISOString();
        count++;
      }
    });

    saveJson(STORAGE_KEYS.PLAYER_RESTRICTIONS, list);

    if (count > 0) {
      CricketDataStore.addAuditLog({
        adminId: params.adminId,
        adminName: params.adminName,
        action: 'PLAYER_RESTRICTION_LIFTED',
        targetType: 'user',
        targetId: params.userId,
        details: `Lifted active ban/restrictions for user UID ${params.userId}. Notes: ${params.reason || 'Pardoned'}`,
      });
    }

    return { success: true, liftedCount: count };
  }

  // ==========================================
  // 3. KNOWN PLAYERS DIRECTORY
  // ==========================================
  static getPlayerProfiles(): PlayerProfileSummary[] {
    // Collect users from initial users, wallet balances, match history, and requests
    const knownUserMap = new Map<string, PlayerProfileSummary>();

    // 1. Initial demo users
    knownUserMap.set(DEMO_USER_PROFILE.id, {
      userId: DEMO_USER_PROFILE.id,
      userName: DEMO_USER_PROFILE.name,
      email: DEMO_USER_PROFILE.email,
      avatar: DEMO_USER_PROFILE.avatarUrl,
      registeredAt: '2026-08-15T00:00:00.000Z',
      balance: 100,
      lockedBalance: 0,
      totalMatchesPlayed: 14,
      wins: 9,
      losses: 5,
      recentMatches: [],
      pendingCashRequestsCount: 0,
    });

    knownUserMap.set(DEMO_ADMIN_PROFILE.id, {
      userId: DEMO_ADMIN_PROFILE.id,
      userName: DEMO_ADMIN_PROFILE.name,
      email: DEMO_ADMIN_PROFILE.email,
      avatar: DEMO_ADMIN_PROFILE.avatarUrl,
      registeredAt: '2026-07-01T00:00:00.000Z',
      balance: 50000,
      lockedBalance: 0,
      totalMatchesPlayed: 0,
      wins: 0,
      losses: 0,
      recentMatches: [],
      pendingCashRequestsCount: 0,
    });

    // Additional active sample players for realistic directory
    const SAMPLE_PLAYERS = [
      { id: 'usr-rohit-88', name: 'Rohit_Sharma_99', email: 'rohit@skillarena.in', matches: 38, wins: 26, losses: 12 },
      { id: 'usr-vikram-07', name: 'Vikram_Rathore', email: 'vikram.r@gmail.com', matches: 21, wins: 14, losses: 7 },
      { id: 'usr-priya-k', name: 'Priya_LudoQueen', email: 'priya.k@yahoo.in', matches: 45, wins: 31, losses: 14 },
      { id: 'usr-aman-singh', name: 'Aman_Striker', email: 'aman.singh@gmail.com', matches: 19, wins: 11, losses: 8 },
      { id: 'usr-suspicious-99', name: 'SpeedHacker_99', email: 'hacker99@anonymous.io', matches: 8, wins: 8, losses: 0 },
      { id: 'usr-quitter-12', name: 'RageQuitter_Pro', email: 'quitter@test.com', matches: 15, wins: 2, losses: 13 },
    ];

    SAMPLE_PLAYERS.forEach((sp) => {
      knownUserMap.set(sp.id, {
        userId: sp.id,
        userName: sp.name,
        email: sp.email,
        registeredAt: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
        balance: 250,
        lockedBalance: 0,
        totalMatchesPlayed: sp.matches,
        wins: sp.wins,
        losses: sp.losses,
        recentMatches: [],
        pendingCashRequestsCount: 0,
      });
    });

    // Populate actual wallet balances
    knownUserMap.forEach((p, uid) => {
      const w = WalletDataStore.getWallet(uid);
      p.balance = w.balance;
      p.lockedBalance = w.lockedBalance;

      // Attach restriction if any
      const restriction = this.getActiveRestriction(uid);
      if (restriction) {
        p.restriction = restriction;
      }

      // Count pending cash requests
      const requests = this.getCashRequests();
      p.pendingCashRequestsCount = requests.filter((r) => r.userId === uid && r.status === 'pending').length;
    });

    return Array.from(knownUserMap.values());
  }
}
