/**
 * Ludo Virtual Bots & QA Match Simulation Types
 * Temporary feature - Isolated from real users, production cash, and Supabase data
 */

export type BotStrategy = 'beginner' | 'random_legal' | 'stronger_legal';

export type BotMatchStatus = 'idle' | 'in_match' | 'paused' | 'testing';

export type SimulationOutcome = 'random' | 'bot_wins' | 'human_wins';

export interface VirtualLudoBot {
  id: string; // e.g. "bot-0001"
  name: string; // e.g. "PawnStriker [BOT]"
  rawName: string; // "PawnStriker"
  avatar: string;
  strategy: BotStrategy;
  status: BotMatchStatus;
  assignedTableId: string | null;
  activeMatchId: string | null;
  testTokenBalance: number; // Isolated non-purchasable test tokens
  rating: number; // Simulated ELO
  matchesPlayed: number;
  wins: number;
  losses: number;
  isBot: true;
  isSimulated: true;
  createdAt: string;
  lastActive: string;
}

export interface BotPoolConfig {
  enabled: boolean; // Global LUDO_BOTS_ENABLED
  poolSize: number; // 5000+
  defaultStrategy: BotStrategy;
  allowSimulationMode: boolean;
  simulationNoticeText: string;
  totalGeneratedBots: number;
  activeBotsCount: number;
  autoMatchStealthBots: boolean; // Auto-fill empty queue slots with realistic stealth bots
  autoMatchWaitSeconds: number; // Time before auto-pairing with stealth players (default 3s)
  updatedAt: string;
}

export interface BotMatchLog {
  id: string;
  matchId: string;
  tableId: string;
  timestamp: string;
  eventType: 'match_started' | 'dice_rolled' | 'token_moved' | 'capture' | 'match_finished' | 'match_stopped' | 'match_reset' | 'simulation_override';
  details: string;
  strategyUsed: BotStrategy;
  isSimulation: boolean;
  simulatedOutcome?: SimulationOutcome;
  winnerId?: string;
  winnerName?: string;
}

export interface SimulationMatchParams {
  tableId: string;
  mode: 2 | 4;
  strategy: BotStrategy;
  simulatedOutcome: SimulationOutcome;
  botCount: number; // 1 to 3 bots depending on mode
  adminUserId?: string;
  adminUserName?: string;
}

export interface BotPoolStats {
  totalBots: number;
  idleBots: number;
  inMatchBots: number;
  pausedBots: number;
  strategiesCount: {
    beginner: number;
    random_legal: number;
    stronger_legal: number;
  };
  totalMatchesRun: number;
  totalLogsCount: number;
}
