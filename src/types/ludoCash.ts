import { LudoColor, LudoGameState } from './index';

export interface LudoCashTable {
  id: string;
  entryFee: number;
  mode: 2 | 4;
  prize: number;
  isActive: boolean;
  minBalanceRequired: number;
  waitingPlayers: number;
  activeMatches: number;
  status: 'waiting' | 'starting' | 'in_progress';
}

export interface LudoOnlinePlayer {
  userId: string;
  userName: string;
  avatar?: string;
  color: LudoColor;
  isReady: boolean;
  isOnline: boolean;
  lastActive: string;
  timeoutCount: number;
}

export interface LudoCashMatch {
  id: string;
  tableId: string;
  entryFee: number;
  playerCount: 2 | 4;
  prizeAmount: number;
  status: 'waiting' | 'starting' | 'in_progress' | 'completed' | 'cancelled';
  players: LudoOnlinePlayer[];
  gameState: LudoGameState;
  winnerId?: string;
  winnerName?: string;
  winnerColor?: LudoColor;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  turnDeadline?: string;
  refundProcessed?: boolean;
}

export interface LudoCashMatchRecord {
  id: string;
  userId: string;
  userName?: string;
  matchId: string;
  tableTitle: string;
  entryFee: number;
  mode: 2 | 4;
  prizeWon: number;
  isWinner: boolean;
  status: 'completed' | 'refunded' | 'cancelled' | 'in_progress';
  referenceId: string;
  timestamp: string;
}

export interface RecentLudoWinner {
  id: string;
  matchId: string;
  userId: string;
  userName: string;
  avatarUrl?: string;
  tableTitle: string;
  entryFee: number;
  mode: 2 | 4;
  prizeWon: number;
  completedAt: string;
}

export interface LudoAdminConfig {
  onlineLudoEnabled: boolean;
  allowTwoPlayer: boolean;
  allowFourPlayer: boolean;
  turnTimeoutSeconds: number;
  maxTimeoutsBeforeForfeit: number;
  customTables?: LudoCashTable[];
}

// 21 Exact real cash table tiers
export const LUDO_CASH_TABLE_TIERS: { entryFee: number; prize2P: number; prize4P: number }[] = [
  { entryFee: 5, prize2P: 8.75, prize4P: 17.5 },
  { entryFee: 10, prize2P: 17.5, prize4P: 35 },
  { entryFee: 20, prize2P: 35, prize4P: 70 },
  { entryFee: 50, prize2P: 87.5, prize4P: 175 },
  { entryFee: 100, prize2P: 175, prize4P: 350 },
  { entryFee: 200, prize2P: 350, prize4P: 700 },
  { entryFee: 250, prize2P: 440, prize4P: 875 },
  { entryFee: 500, prize2P: 880, prize4P: 1750 },
  { entryFee: 750, prize2P: 1320, prize4P: 2625 },
  { entryFee: 1000, prize2P: 1800, prize4P: 3500 },
  { entryFee: 1500, prize2P: 2700, prize4P: 5250 },
  { entryFee: 1750, prize2P: 3150, prize4P: 6125 },
  { entryFee: 2000, prize2P: 3640, prize4P: 7000 },
  { entryFee: 3000, prize2P: 5460, prize4P: 10500 },
  { entryFee: 3500, prize2P: 6370, prize4P: 12250 },
  { entryFee: 5000, prize2P: 9200, prize4P: 17500 },
  { entryFee: 7000, prize2P: 12880, prize4P: 24500 },
  { entryFee: 10000, prize2P: 18400, prize4P: 35000 },
  { entryFee: 12000, prize2P: 22080, prize4P: 42000 },
  { entryFee: 15000, prize2P: 27600, prize4P: 52500 },
  { entryFee: 25000, prize2P: 46000, prize4P: 87000 },
];

export function generateDefaultCashTables(): LudoCashTable[] {
  const tables: LudoCashTable[] = [];

  LUDO_CASH_TABLE_TIERS.forEach((tier) => {
    // 2-player table
    tables.push({
      id: `table-2p-${tier.entryFee}`,
      entryFee: tier.entryFee,
      mode: 2,
      prize: tier.prize2P,
      isActive: true,
      minBalanceRequired: tier.entryFee,
      waitingPlayers: 0,
      activeMatches: 0,
      status: 'waiting',
    });

    // 4-player table
    tables.push({
      id: `table-4p-${tier.entryFee}`,
      entryFee: tier.entryFee,
      mode: 4,
      prize: tier.prize4P,
      isActive: true,
      minBalanceRequired: tier.entryFee,
      waitingPlayers: 0,
      activeMatches: 0,
      status: 'waiting',
    });
  });

  return tables;
}
