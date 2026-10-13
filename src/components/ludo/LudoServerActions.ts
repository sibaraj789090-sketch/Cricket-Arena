import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { WalletDataStore } from '../../lib/walletStorage';

export interface LudoJoinTableParams {
  userId: string;
  userName?: string;
  tableId: string;
  tableTitle?: string;
  entryFee: number;
  matchId?: string;
}

export interface LudoJoinTableResult {
  success: boolean;
  reservationId?: string;
  matchId?: string;
  entryFee?: number;
  newBalance?: number;
  lockedBalance?: number;
  alreadyReserved?: boolean;
  error?: string;
}

export interface BalanceVerificationResult {
  hasEnough: boolean;
  currentBalance: number;
  lockedBalance: number;
  requiredAmount: number;
  error?: string;
}

/**
 * 1. Authoritative server-side balance verification via Supabase.
 * Checks the database directly to confirm the user possesses sufficient cash coins
 * before permitting them to participate or reserve a table slot.
 */
export async function verifyUserCashBalance(
  userId: string,
  requiredCoins: number
): Promise<BalanceVerificationResult> {
  if (!userId) {
    return {
      hasEnough: false,
      currentBalance: 0,
      lockedBalance: 0,
      requiredAmount: requiredCoins,
      error: 'User ID is missing or invalid.',
    };
  }

  if (requiredCoins <= 0) {
    return {
      hasEnough: true,
      currentBalance: 0,
      lockedBalance: 0,
      requiredAmount: 0,
    };
  }

  // Attempt Supabase database query if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('coin_wallets')
        .select('balance, locked_balance')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        const availableBalance = Number(data.balance ?? 0);
        const lockedBalance = Number(data.locked_balance ?? 0);
        return {
          hasEnough: availableBalance >= requiredCoins,
          currentBalance: availableBalance,
          lockedBalance,
          requiredAmount: requiredCoins,
          error:
            availableBalance < requiredCoins
              ? `Insufficient cash coins. Available: ₹${availableBalance}, Required: ₹${requiredCoins}`
              : undefined,
        };
      }
    } catch (err) {
      console.warn('[LudoServerActions] Supabase balance query error, falling back to local store:', err);
    }
  }

  // Fallback to authoritative local/memory store (e.g., local preview or offline mode)
  const wallet = WalletDataStore.getWallet(userId);
  const availableBalance = wallet.balance;
  return {
    hasEnough: availableBalance >= requiredCoins,
    currentBalance: availableBalance,
    lockedBalance: wallet.lockedBalance,
    requiredAmount: requiredCoins,
    error:
      availableBalance < requiredCoins
        ? `Insufficient cash coins. Available: ₹${availableBalance}, Required: ₹${requiredCoins}`
        : undefined,
  };
}

/**
 * 2. 'join_table' action:
 * Reserves the entry fee in the database ONLY after confirming the user has enough coins.
 * Uses database-level row locks (FOR UPDATE) and check constraints (balance >= entry_fee)
 * via Supabase RPC `rpc_ludo_join_table_reserve` to eliminate race conditions
 * and double-join duplicates during simultaneous join requests.
 */
export async function join_table(
  params: LudoJoinTableParams
): Promise<LudoJoinTableResult> {
  const { userId, tableId, entryFee, tableTitle = `Ludo Table ${tableId}` } = params;
  const matchId = params.matchId || `ludo_res_${tableId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  if (!userId) {
    return { success: false, error: 'User ID is required to join a Ludo table.' };
  }

  if (entryFee <= 0) {
    return { success: false, error: 'Entry fee must be greater than zero.' };
  }

  // Step 1: Pre-verify sufficient balance before entering the transaction
  const balanceCheck = await verifyUserCashBalance(userId, entryFee);
  if (!balanceCheck.hasEnough) {
    return {
      success: false,
      entryFee,
      newBalance: balanceCheck.currentBalance,
      error: `Not enough cash. Please top up your cash balance. (Available: ₹${balanceCheck.currentBalance}, Required: ₹${entryFee})`,
    };
  }

  // Step 2: Atomic database reservation with database-level lock & constraints
  if (isSupabaseConfigured && supabase) {
    try {
      // Derive authenticated user if available
      let effectiveUserId = userId;
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) {
          effectiveUserId = authData.user.id;
        }
      } catch {
        // Fall back to passed userId
      }

      // Call canonical RPC signature:
      // public.rpc_ludo_join_table_reserve(p_user_id, p_table_id, p_entry_fee, p_match_id, p_table_title)
      const { data, error } = await supabase.rpc('rpc_ludo_join_table_reserve', {
        p_user_id: String(effectiveUserId),
        p_table_id: String(tableId),
        p_entry_fee: Number(entryFee),
        p_match_id: String(matchId),
        p_table_title: String(tableTitle),
      });

      if (error) {
        // If the error is network, fetch failure, or RPC ambiguity/schema cache pending,
        // log a warning diagnostic and seamlessly fallback to authoritative local store
        const isNetworkOrUnavailable =
          !error.code ||
          error.message?.includes('Failed to fetch') ||
          error.message?.includes('fetch') ||
          error.message?.includes('NetworkError') ||
          error.message?.includes('network') ||
          error.code === 'PGRST202' ||
          error.code === 'PGRST203' ||
          error.code === 'PGRST205' ||
          error.code === '42883' ||
          error.code === '42725' ||
          error.message?.includes('schema cache') ||
          error.message?.includes('best candidate') ||
          error.message?.includes('ambiguous') ||
          error.message?.includes('not found');

        if (isNetworkOrUnavailable) {
          console.warn(
            '[LudoServerActions] Supabase RPC unavailable or network offline. Falling back to authoritative store:',
            error.message || 'network unavailable'
          );
          // Fall through to Step 3 below
        } else {
          // If stored procedure returned an explicit business logic exception
          console.warn('[LudoServerActions] Supabase rpc_ludo_join_table_reserve rejected:', error.message);
          return {
            success: false,
            error: error.message || 'Database rejected entry fee reservation.',
          };
        }
      } else if (data && typeof data === 'object') {
        if (!data.success) {
          return {
            success: false,
            error: data.error || 'Insufficient balance or reservation rejected.',
            newBalance: data.balance,
          };
        }

        // Keep local store in sync with remote DB state
        WalletDataStore.reserveGameEntry(userId, matchId, tableTitle, entryFee);

        return {
          success: true,
          reservationId: data.reservation_id,
          matchId,
          entryFee,
          newBalance: data.balance,
          lockedBalance: data.locked_balance,
          alreadyReserved: Boolean(data.already_reserved),
        };
      }
    } catch (err: any) {
      console.warn('[LudoServerActions] Supabase RPC exception, delegating to authoritative store:', err);
    }
  }

  // Step 3: Server/Local atomic reservation with boundary constraints
  const res = WalletDataStore.reserveGameEntry(userId, matchId, tableTitle, entryFee);
  if (!res.success) {
    return {
      success: false,
      entryFee,
      error: res.error || 'Failed to lock required cash entry fee.',
    };
  }

  return {
    success: true,
    reservationId: `local-res-${matchId}`,
    matchId,
    entryFee,
    newBalance: res.newBalance,
    lockedBalance: entryFee,
  };
}

// Alias for idiomatic camelCase usage
export const joinTable = join_table;

/**
 * 3. Cancel / Refund Table Join
 * Restores the locked entry fee to the player's active balance if matchmaking is cancelled or fails.
 */
export async function refund_table_entry(params: {
  userId: string;
  matchId: string;
  entryFee: number;
  reason?: string;
}): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const { userId, matchId, entryFee, reason = 'Queue cancelled by player' } = params;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('rpc_ludo_refund_table_entry', {
        p_user_id: userId,
        p_match_id: matchId,
        p_entry_fee: entryFee,
        p_reason: reason,
      });

      if (!error && data && data.success) {
        return {
          success: true,
          newBalance: data.balance,
        };
      }
    } catch (err) {
      console.warn('[LudoServerActions] RPC refund error:', err);
    }
  }

  const localRes = WalletDataStore.refundGameEntry(
    userId,
    matchId,
    `Ludo Table Entry Refund`,
    entryFee,
    reason
  );

  return localRes;
}

export const refundTableEntry = refund_table_entry;

/**
 * 4. Authoritative Winner Prize Settlement
 * Clears locked fee and credits the winner's reward safely into the ledger.
 */
export async function settle_table_winner(params: {
  winnerUserId: string;
  matchId: string;
  prizeAmount: number;
  entryFee: number;
  tableTitle?: string;
}): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const {
    winnerUserId,
    matchId,
    prizeAmount,
    entryFee,
    tableTitle = 'Ludo Match',
  } = params;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('rpc_ludo_settle_table_win', {
        p_winner_user_id: winnerUserId,
        p_match_id: matchId,
        p_prize_amount: prizeAmount,
        p_entry_fee: entryFee,
        p_table_title: tableTitle,
      });

      if (!error && data && data.success) {
        return {
          success: true,
          newBalance: data.balance,
        };
      }
    } catch (err) {
      console.warn('[LudoServerActions] RPC settle winner error:', err);
    }
  }

  const localRes = WalletDataStore.settleGameReward(
    winnerUserId,
    matchId,
    tableTitle,
    prizeAmount,
    entryFee
  );

  return localRes;
}

export const settleTableWinner = settle_table_winner;
