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
  onlinePlayers: number;
  playingPlayers: number;
  current_players?: number;
  manualOnlinePlayers?: number;
  manualPlayingPlayers?: number;
}

export interface LudoScoreBreakdown {
  dicePoints: number;
  capturePoints: number;
  homeBonuses: number;
  lostInCaptures: number;
  totalScore: number;
  tokensHomeCount: number;
  capturesCount: number;
}

export interface LudoScoreEvent {
  id: string;
  timestamp: string;
  userId: string;
  color: LudoColor;
  type: 'dice_roll' | 'token_move' | 'capture_transfer' | 'home_bonus';
  points: number;
  description: string;
  totalScoreAfter: number;
}

export interface LudoFinalRanking {
  rank: number;
  userId: string;
  userName: string;
  color: LudoColor;
  score: number;
  tokensHomeCount: number;
  capturesCount: number;
  timeoutsCount: number;
  prizeWon: number;
  isWinner: boolean;
  scoreBreakdown: LudoScoreBreakdown;
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
  timeouts?: number;
  score?: number; // Total match score in Timer Ludo
  scoreBreakdown?: LudoScoreBreakdown;
  isSimulated?: boolean;
  hasForfeited?: boolean;
  isLeft?: boolean;
}

export interface LudoCashMatch {
  id: string;
  tableId: string;
  entryFee: number;
  playerCount: 2 | 4;
  prizeAmount: number;
  status: 'waiting' | 'starting' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
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

  // Timer Ludo (Highest Score Wins) fields
  modeName?: 'Timer Ludo — Highest Score Wins';
  durationMinutes: number; // 2P: 10 min (or admin configured), 4P: 15 min
  durationSeconds: number; // 600s for 2P, 900s for 4P
  endsAt?: string; // Authoritative server timestamp when match timer expires
  timeRemainingSeconds?: number; // Real-time server remaining countdown
  scoreHistory?: LudoScoreEvent[];
  tieBreakerRule?: string; // Clear deterministic rule shown to players
  finalRankings?: LudoFinalRanking[];
  chatMessages?: LudoQuickMessage[];
}

export interface LudoQuickMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: LudoColor;
  text: string;
  timestamp: number;
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
  finalScore?: number;
  rank?: number;
  scoreBreakdown?: LudoScoreBreakdown;
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
  finalScore?: number;
}

export interface LudoAdminConfig {
  onlineLudoEnabled: boolean;
  timerLudoEnabled: boolean; // Enable or disable Timer Ludo
  durationMinutes2P: number; // Default 10 min
  durationMinutes4P: number; // Default 15 min
  homeBonusPoints: number; // Default 60 pts
  dicePointsEnabled: boolean; // 1=1pt, 2=2pt, ..., 6=6pt
  captureTransferEnabled: boolean; // Captured token score transferred
  tieBreakerRule: 'home_tokens_then_captures' | 'most_captures' | 'least_timeouts';
  turnTimeoutSeconds: number;
  maxTimeoutsBeforeForfeit: number;
  allowTwoPlayer: boolean;
  allowFourPlayer: boolean;
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

/**
 * Distribution of 5000+ virtual bot players across all 42 tables:
 * - Entry fee <= 250: Higher player volumes (150 - 480 players per table format)
 * - Entry fee > 250: Lower player volumes (4 - 105 players per table format)
 * - Every table format has unique, non-identical numbers of online and playing players.
 */
export const TABLE_BOT_DISTRIBUTION: Record<
  number,
  { online2P: number; playing2P: number; online4P: number; playing4P: number }
> = {
  5:     { online2P: 285, playing2P: 194, online4P: 263, playing4P: 181 },
  10:    { online2P: 251, playing2P: 174, online4P: 237, playing4P: 163 },
  20:    { online2P: 224, playing2P: 152, online4P: 211, playing4P: 143 },
  50:    { online2P: 196, playing2P: 135, online4P: 182, playing4P: 126 },
  100:   { online2P: 168, playing2P: 115, online4P: 155, playing4P: 106 },
  200:   { online2P: 142, playing2P: 96,  online4P: 131, playing4P: 89  },
  250:   { online2P: 121, playing2P: 82,  online4P: 112, playing4P: 75  },
  500:   { online2P: 62,  playing2P: 43,  online4P: 54,  playing4P: 37  },
  750:   { online2P: 48,  playing2P: 33,  online4P: 43,  playing4P: 29  },
  1000:  { online2P: 39,  playing2P: 26,  online4P: 35,  playing4P: 23  },
  1500:  { online2P: 31,  playing2P: 21,  online4P: 28,  playing4P: 19  },
  1750:  { online2P: 26,  playing2P: 17,  online4P: 23,  playing4P: 15  },
  2000:  { online2P: 21,  playing2P: 14,  online4P: 19,  playing4P: 13  },
  3000:  { online2P: 18,  playing2P: 12,  online4P: 16,  playing4P: 10  },
  3500:  { online2P: 15,  playing2P: 9,   online4P: 14,  playing4P: 8   },
  5000:  { online2P: 13,  playing2P: 8,   online4P: 11,  playing4P: 7   },
  7000:  { online2P: 10,  playing2P: 6,   online4P: 9,   playing4P: 5   },
  10000: { online2P: 8,   playing2P: 5,   online4P: 7,   playing4P: 4   },
  12000: { online2P: 6,   playing2P: 4,   online4P: 5,   playing4P: 3   },
  15000: { online2P: 5,   playing2P: 3,   online4P: 4,   playing4P: 2   },
  25000: { online2P: 4,   playing2P: 2,   online4P: 3,   playing4P: 1   },
};

/**
 * Returns dynamic, non-identical Online and Playing counts for a given table
 * with realistic natural fluctuation over time.
 */
export function getTableBotCounts(entryFee: number, mode: 2 | 4): { onlinePlayers: number; playingPlayers: number } {
  const dist = TABLE_BOT_DISTRIBUTION[entryFee] || (
    entryFee < 250
      ? {
          online2P: Math.max(120, Math.floor(1800 / (entryFee + 5))),
          playing2P: Math.max(80, Math.floor(1200 / (entryFee + 5))),
          online4P: Math.max(110, Math.floor(1600 / (entryFee + 5))),
          playing4P: Math.max(75, Math.floor(1100 / (entryFee + 5))),
        }
      : {
          online2P: Math.max(4, Math.floor(1000 / (entryFee + 1))),
          playing2P: Math.max(2, Math.floor(700 / (entryFee + 1))),
          online4P: Math.max(3, Math.floor(900 / (entryFee + 1))),
          playing4P: Math.max(1, Math.floor(600 / (entryFee + 1))),
        }
  );

  const baseOnline = mode === 2 ? dist.online2P : dist.online4P;
  const basePlaying = mode === 2 ? dist.playing2P : dist.playing4P;

  // Gentle pseudo-random natural drift (+/- 1 to 3) based on current minute and table fee/mode
  const timeStep = Math.floor(Date.now() / 20000);
  const hash = (entryFee * 19 + (mode === 2 ? 37 : 73) + timeStep) % 7;
  const onlineDrift = (hash % 5) - 2;
  const playingDrift = ((hash + 2) % 5) - 2;

  const onlinePlayers = Math.max(mode === 2 ? 3 : 2, baseOnline + onlineDrift);
  const playingPlayers = Math.max(1, basePlaying + playingDrift);

  return { onlinePlayers, playingPlayers };
}

export function generateDefaultCashTables(): LudoCashTable[] {
  const tables: LudoCashTable[] = [];

  LUDO_CASH_TABLE_TIERS.forEach((tier) => {
    const counts2P = getTableBotCounts(tier.entryFee, 2);
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
      onlinePlayers: counts2P.onlinePlayers,
      playingPlayers: counts2P.playingPlayers,
      current_players: counts2P.onlinePlayers + counts2P.playingPlayers,
    });

    const counts4P = getTableBotCounts(tier.entryFee, 4);
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
      onlinePlayers: counts4P.onlinePlayers,
      playingPlayers: counts4P.playingPlayers,
      current_players: counts4P.onlinePlayers + counts4P.playingPlayers,
    });
  });

  return tables;
}
