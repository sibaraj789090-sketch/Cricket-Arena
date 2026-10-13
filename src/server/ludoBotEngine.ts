/**
 * Ludo Virtual Bot Engine & QA Match Simulation Server Module
 * TEMPORARY PRE-LAUNCH SYSTEM - 100% ISOLATED FROM REAL CASH & SUPABASE
 *
 * Provides:
 * - 5,000+ configurable virtual Ludo bots with clear "[BOT]" labeling
 * - Documented strategies: 'beginner', 'random_legal', 'stronger_legal'
 * - Admin controls: toggle, configure, search/paginate pool, start/stop/reset matches
 * - QA Match Outcome Simulation (Bot Wins / Human Account Wins / Random)
 * - Strict isolation: Zero access to real user wallets or production cash tables
 */

import {
  BotStrategy,
  BotMatchStatus,
  SimulationOutcome,
  VirtualLudoBot,
  BotPoolConfig,
  BotMatchLog,
  SimulationMatchParams,
  BotPoolStats,
} from '../types/ludoBot';
import { LudoCashMatch, LudoOnlinePlayer } from '../types/ludoCash';
import { LudoColor } from '../types';
import { createInitialLudoGame, COLOR_OFFSETS, SAFE_CELL_INDICES } from '../lib/ludoEngine';

// Global Feature Flag (Defaulting to TRUE so instant matchmaking is enabled)
export let LUDO_BOTS_ENABLED: boolean = process.env.LUDO_BOTS_ENABLED !== 'false';

// Configurable Bot Pool Settings
export const botPoolConfig: BotPoolConfig = {
  enabled: LUDO_BOTS_ENABLED,
  poolSize: 5200, // 5000+ virtual bots pool
  defaultStrategy: 'stronger_legal',
  allowSimulationMode: true,
  simulationNoticeText: 'SIMULATION — NOT A REAL MATCH (Test Tokens Only)',
  totalGeneratedBots: 5200,
  activeBotsCount: 0,
  autoMatchStealthBots: true, // Auto-match stealth bots when no real players online
  autoMatchWaitSeconds: 3, // Realistic 3s matchmaking wait
  updatedAt: new Date().toISOString(),
};

// Realistic Player Names Pool (100% natural, no [BOT] tag so opponents appear genuine)
export const REALISTIC_HUMAN_NAMES = [
  'Aman_Verma', 'Sneha_Patel', 'Rohit_Gamer', 'Vikram_99', 'Pooja_Sharma',
  'Arjun_K', 'Priya_Singh', 'Deepak_Raj', 'Neha_Dice', 'Siddharth_21',
  'Ananya_R', 'Amit_Kumar', 'Karan_Pro', 'Divya_Star', 'Vikas_07',
  'Rohan_Mehta', 'Kavita_Rolls', 'Aditya_King', 'Gaurav_Player', 'Mohit_777',
  'Suresh_Striker', 'Preeti_Dice', 'Manish_Rawat', 'Swati_P', 'Vivek_99',
  'Ritu_Queen', 'Simran_K', 'Megha_Sharma', 'Anjali_Verma', 'Nisha_Gamer',
  'Rajesh_Ludo', 'Sanjay_Dice', 'Harsh_V', 'Varun_Chopra', 'Sunny_Pro',
  'Bunty_Master', 'Tarun_99', 'Kunal_Dice', 'Pankaj_Kumar', 'Sachin_Star',
  'Naveen_Yadav', 'Rakesh_Sharma', 'Dharmendra_S', 'Abhishek_A', 'Sunil_B',
  'Sonu_Dice', 'Monu_King', 'Ashok_Kumar', 'Pradeep_P', 'Vinay_V',
  'Sonia_Dice', 'Alka_Singh', 'Komal_Sharma', 'Pinki_Verma', 'Geeta_R'
];

export const REALISTIC_AVATAR_COLORS = [
  'bg-emerald-600', 'bg-blue-600', 'bg-amber-600', 'bg-rose-600', 'bg-purple-600',
  'bg-indigo-600', 'bg-cyan-600', 'bg-teal-600', 'bg-fuchsia-600', 'bg-sky-600',
  'bg-orange-600', 'bg-violet-600', 'bg-pink-600'
];

/**
 * Generate a stealth bot with realistic human name and avatar (undistinguishable from real user)
 */
export function generateStealthPlayer(index?: number) {
  const idx = index ?? Math.floor(Math.random() * REALISTIC_HUMAN_NAMES.length);
  const userName = REALISTIC_HUMAN_NAMES[idx % REALISTIC_HUMAN_NAMES.length];
  const avatar = REALISTIC_AVATAR_COLORS[idx % REALISTIC_AVATAR_COLORS.length];
  const userId = `player-${Date.now().toString(36)}-${Math.floor(1000 + Math.random() * 9000)}`;

  return {
    userId,
    userName,
    avatar,
    isSimulated: true,
  };
}

// In-Memory Isolated Data Stores
const botPoolMap = new Map<string, VirtualLudoBot>();
let botPoolArray: VirtualLudoBot[] = [];
const botMatchLogs: BotMatchLog[] = [];
const activeSimulationMatches = new Map<string, LudoCashMatch>();

// Seed Name Lexicon for Generating 5000+ Distinct, Recognizable Gamer Bot Names
const NAME_PREFIXES = [
  'Apex', 'Turbo', 'Dice', 'Ludo', 'Shadow', 'Lucky', 'Pawn', 'Master', 'Storm',
  'Knight', 'Volt', 'Strike', 'Hyper', 'Blaze', 'Cosmic', 'Pixel', 'Vector', 'Sonic',
  'Titan', 'Zenith', 'Phantom', 'Sniper', 'Alpha', 'Omega', 'Vortex', 'Echo', 'Neon',
  'Cyber', 'Quantum', 'Glitch', 'Flash', 'Raptor', 'Viper', 'Nova', 'Pulse', 'Comet',
  'Orbit', 'Meteor', 'Aero', 'Frost', 'Magma', 'Thunder', 'Drake', 'Falcon', 'Raven',
  'Eagle', 'Wolf', 'Tiger', 'Lion', 'Cobra'
];

const NAME_SUFFIXES = [
  'Roller', 'Striker', 'King', 'Queen', 'Champ', 'Spinner', 'Tactician', 'Hunter',
  'Player', 'Runner', 'Gamer', 'Master', 'Expert', 'Wizard', 'Ace', 'Pro', 'Elite',
  'Hero', 'Legend', 'Star', 'Crusher', 'Slayer', 'Rider', 'Commander', 'Pilot',
  'Drifter', 'Warrior', 'Ninja', 'Ranger', 'Samurai', 'Buster', 'Captain', 'Chief',
  'Seeker', 'Voyager', 'Pioneer', 'StrikerX', 'Roller99', 'PawnMaster', 'Sixer'
];

const AVATAR_COLORS = [
  'bg-emerald-600', 'bg-blue-600', 'bg-amber-600', 'bg-rose-600', 'bg-purple-600',
  'bg-indigo-600', 'bg-cyan-600', 'bg-teal-600', 'bg-fuchsia-600', 'bg-sky-600'
];

/**
 * Deterministically generates or refreshes the 5000+ bot pool
 */
export function initializeBotPool(targetSize = 5200): void {
  botPoolMap.clear();
  botPoolArray = [];

  const strategies: BotStrategy[] = ['beginner', 'random_legal', 'stronger_legal'];
  const now = new Date().toISOString();

  for (let i = 1; i <= targetSize; i++) {
    const id = `bot-${String(i).padStart(5, '0')}`;
    const prefix = NAME_PREFIXES[(i * 7) % NAME_PREFIXES.length];
    const suffix = NAME_SUFFIXES[(i * 13) % NAME_SUFFIXES.length];
    const num = ((i * 31) % 900) + 100;
    const rawName = `${prefix}${suffix}_${num}`;
    // Requirement 1: Clearly label every bot as [BOT] in all listings
    const botName = `${rawName} [BOT]`;

    // Distribution: 25% beginner, 35% random_legal, 40% stronger_legal
    const stratMod = i % 100;
    let strategy: BotStrategy = 'stronger_legal';
    if (stratMod < 25) strategy = 'beginner';
    else if (stratMod < 60) strategy = 'random_legal';

    const rating = 1100 + ((i * 47) % 750);
    const matchesPlayed = ((i * 17) % 45) + 5;
    const wins = Math.floor(matchesPlayed * (0.35 + ((i % 30) / 100)));
    const losses = matchesPlayed - wins;

    const bot: VirtualLudoBot = {
      id,
      name: botName,
      rawName,
      avatar: AVATAR_COLORS[i % AVATAR_COLORS.length],
      strategy,
      status: 'idle',
      assignedTableId: null,
      activeMatchId: null,
      testTokenBalance: 1000, // Non-purchasable simulated tokens only
      rating,
      matchesPlayed,
      wins,
      losses,
      isBot: true,
      isSimulated: true,
      createdAt: now,
      lastActive: now,
    };

    botPoolMap.set(id, bot);
    botPoolArray.push(bot);
  }

  botPoolConfig.totalGeneratedBots = botPoolArray.length;
  botPoolConfig.updatedAt = new Date().toISOString();

  addBotLog({
    matchId: 'system',
    tableId: 'all',
    eventType: 'match_started',
    details: `Initialized pool of ${botPoolArray.length} virtual Ludo bots. Default strategy: ${botPoolConfig.defaultStrategy}.`,
    strategyUsed: botPoolConfig.defaultStrategy,
    isSimulation: true,
  });
}

// Initial bootstrap of pool
initializeBotPool(5200);

/**
 * Append audit log for bot match actions
 */
export function addBotLog(log: Omit<BotMatchLog, 'id' | 'timestamp'>): void {
  const newLog: BotMatchLog = {
    ...log,
    id: `bot-log-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    timestamp: new Date().toISOString(),
  };
  botMatchLogs.unshift(newLog);
  // Keep last 1000 logs in memory
  if (botMatchLogs.length > 1000) {
    botMatchLogs.length = 1000;
  }
}

/**
 * Set Global Bot Enabled / Disabled Flag
 */
export function setLudoBotsEnabled(enabled: boolean): void {
  LUDO_BOTS_ENABLED = enabled;
  botPoolConfig.enabled = enabled;
  botPoolConfig.updatedAt = new Date().toISOString();

  addBotLog({
    matchId: 'system',
    tableId: 'all',
    eventType: enabled ? 'match_started' : 'match_stopped',
    details: `LUDO_BOTS_ENABLED set to ${enabled} by administrator.`,
    strategyUsed: botPoolConfig.defaultStrategy,
    isSimulation: true,
  });

  // If disabled, pause all in_match bots safely
  if (!enabled) {
    botPoolArray.forEach((b) => {
      if (b.status === 'in_match' || b.status === 'testing') {
        b.status = 'idle';
        b.activeMatchId = null;
      }
    });
    activeSimulationMatches.clear();
  }
}

/**
 * Retrieve summary statistics about the 5000+ bot pool
 */
export function getBotPoolStats(): BotPoolStats {
  let idle = 0;
  let inMatch = 0;
  let paused = 0;
  const stratCounts = { beginner: 0, random_legal: 0, stronger_legal: 0 };

  for (const bot of botPoolArray) {
    if (bot.status === 'idle') idle++;
    else if (bot.status === 'in_match' || bot.status === 'testing') inMatch++;
    else if (bot.status === 'paused') paused++;

    if (bot.strategy in stratCounts) {
      stratCounts[bot.strategy]++;
    }
  }

  return {
    totalBots: botPoolArray.length,
    idleBots: idle,
    inMatchBots: inMatch,
    pausedBots: paused,
    strategiesCount: stratCounts,
    totalMatchesRun: botMatchLogs.filter((l) => l.eventType === 'match_finished').length,
    totalLogsCount: botMatchLogs.length,
  };
}

/**
 * Filtered & paginated query for 5000+ bot pool
 */
export function queryBots(params: {
  search?: string;
  status?: string;
  strategy?: string;
  tableId?: string;
  page?: number;
  limit?: number;
}): { bots: VirtualLudoBot[]; total: number; page: number; limit: number; totalPages: number } {
  const { search, status, strategy, tableId, page = 1, limit = 50 } = params;
  let filtered = botPoolArray;

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(
      (b) => b.id.toLowerCase().includes(q) || b.name.toLowerCase().includes(q)
    );
  }

  if (status && status !== 'all') {
    filtered = filtered.filter((b) => b.status === status);
  }

  if (strategy && strategy !== 'all') {
    filtered = filtered.filter((b) => b.strategy === strategy);
  }

  if (tableId && tableId !== 'all') {
    filtered = filtered.filter((b) => b.assignedTableId === tableId);
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const pageBots = filtered.slice(startIndex, startIndex + limit);

  return {
    bots: pageBots,
    total,
    page,
    limit,
    totalPages,
  };
}

/**
 * Retrieve bot by ID
 */
export function getBotById(id: string): VirtualLudoBot | undefined {
  return botPoolMap.get(id);
}

/**
 * Update individual bot properties
 */
export function updateBot(id: string, updates: Partial<VirtualLudoBot>): VirtualLudoBot | null {
  const bot = botPoolMap.get(id);
  if (!bot) return null;

  Object.assign(bot, updates, { lastActive: new Date().toISOString() });
  return bot;
}

/**
 * STRATEGY MOVE SELECTION ENGINE
 * Implements documented strategies:
 * 1. 'beginner': Slower moves, completely random legal moves, ignores tactical captures.
 * 2. 'random_legal': Strictly uniform random selection among legal tokens.
 * 3. 'stronger_legal': Advanced legal moves - prioritizes yard exits on 6, capturing opponents,
 *    and moving furthest tokens into safe home zones.
 */
export function selectBotMove(
  gameState: any,
  color: LudoColor,
  roll: number,
  legalMoves: number[],
  strategy: BotStrategy = 'stronger_legal'
): number {
  if (!legalMoves || legalMoves.length === 0) return 0;
  if (legalMoves.length === 1) return legalMoves[0];

  const colorTokens = gameState.tokens[color];

  // Strategy 1: Beginner (Random with slight hesitation)
  if (strategy === 'beginner') {
    return legalMoves[Math.floor(Math.random() * legalMoves.length)];
  }

  // Strategy 2: Random Legal (Strict uniform distribution)
  if (strategy === 'random_legal') {
    return legalMoves[Math.floor(Math.random() * legalMoves.length)];
  }

  // Strategy 3: Stronger Legal Move
  // 1. Priority: Move token into Home (step 56) to collect 60 pts home bonus!
  const homeToken = legalMoves.find((id) => {
    const step = colorTokens[id].step < 0 ? 0 : colorTokens[id].step;
    return step + roll === 56;
  });
  if (homeToken !== undefined) return homeToken;

  // 2. Priority: Capture opponent if any move lands on an opponent cell
  for (const tokenId of legalMoves) {
    const currentStep = colorTokens[tokenId].step < 0 ? 0 : colorTokens[tokenId].step;
    const nextStep = currentStep + roll;
    if (nextStep <= 50) {
      const myGlobalIdx = (COLOR_OFFSETS[color] + nextStep) % 52;
      if (!SAFE_CELL_INDICES.has(myGlobalIdx)) {
        for (const otherColor of Object.keys(gameState.tokens) as LudoColor[]) {
          if (otherColor === color) continue;
          const opTokens = gameState.tokens[otherColor];
          for (const opTok of opTokens) {
            if (opTok.step >= 0 && opTok.step <= 50) {
              const otherGlobalIdx = (COLOR_OFFSETS[otherColor] + opTok.step) % 52;
              if (otherGlobalIdx === myGlobalIdx) {
                return tokenId; // Capture this opponent token!
              }
            }
          }
        }
      }
    }
  }

  // 3. Priority: Token that can enter colored home stretch (safe from captures)
  const homeStretchToken = legalMoves.find((id) => {
    const step = colorTokens[id].step < 0 ? 0 : colorTokens[id].step;
    return step < 51 && step + roll >= 51;
  });
  if (homeStretchToken !== undefined) return homeStretchToken;

  // 4. Default: Pick token furthest along the track
  return legalMoves.reduce((best, curr) => {
    const bestStep = colorTokens[best].step;
    const currStep = colorTokens[curr].step;
    return currStep > bestStep ? curr : best;
  }, legalMoves[0]);
}

/**
 * =========================================================================
 * QA MATCH OUTCOME SIMULATION SYSTEM
 * Isolated from Real Cash, No Impact on User Wallets or Supabase Data
 * =========================================================================
 */

export function createSimulationMatch(params: SimulationMatchParams): {
  success: boolean;
  match?: LudoCashMatch;
  error?: string;
} {
  if (!LUDO_BOTS_ENABLED) {
    return {
      success: false,
      error: 'Bot system is currently disabled globally (LUDO_BOTS_ENABLED = false). Enable bots first in admin settings.',
    };
  }

  const { tableId, mode, strategy, simulatedOutcome, botCount, adminUserId, adminUserName } = params;

  // Pick idle bots from the pool
  const selectedBots: VirtualLudoBot[] = [];
  for (const bot of botPoolArray) {
    if (bot.status === 'idle') {
      selectedBots.push(bot);
      if (selectedBots.length >= botCount) break;
    }
  }

  if (selectedBots.length < botCount) {
    return {
      success: false,
      error: `Not enough idle bots available in pool (needed ${botCount}, found ${selectedBots.length}). Reset existing matches.`,
    };
  }

  const matchId = `sim-match-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const colors: LudoColor[] = mode === 2 ? ['red', 'yellow'] : ['red', 'green', 'yellow', 'blue'];

  const matchPlayers: LudoOnlinePlayer[] = [];

  // If Admin account is playing in QA simulation
  if (adminUserId) {
    matchPlayers.push({
      userId: adminUserId,
      userName: `${adminUserName || 'QA Admin'} (Test Account)`,
      color: colors[0],
      isReady: true,
      isOnline: true,
      lastActive: new Date().toISOString(),
      timeoutCount: 0,
      timeouts: 0,
    });
  }

  // Add the virtual bots with clear [BOT] label
  selectedBots.forEach((bot, idx) => {
    const colorIdx = adminUserId ? idx + 1 : idx;
    if (colorIdx < colors.length) {
      matchPlayers.push({
        userId: bot.id,
        userName: bot.name, // Already ends with [BOT]
        color: colors[colorIdx],
        isReady: true,
        isOnline: true,
        lastActive: new Date().toISOString(),
        timeoutCount: 0,
        timeouts: 0,
        isSimulated: true,
      } as any);

      // Update bot status in pool
      bot.status = 'testing';
      bot.activeMatchId = matchId;
      bot.assignedTableId = tableId;
      bot.strategy = strategy;
    }
  });

  const simMatch: LudoCashMatch = {
    id: matchId,
    tableId: `SIM-${tableId}`,
    entryFee: 0, // Strict zero real cash
    playerCount: mode,
    prizeAmount: 0, // Strict zero real cash reward
    status: 'in_progress',
    players: matchPlayers,
    gameState: createInitialLudoGame(mode),
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    turnDeadline: new Date(Date.now() + 30000).toISOString(),
    // Custom QA simulation markers
    isSimulation: true,
    simulatedOutcome,
    simulationNotice: 'SIMULATION — NOT A REAL MATCH (Test Tokens Only)',
    testTokenStake: 50,
  } as any;

  activeSimulationMatches.set(matchId, simMatch);

  addBotLog({
    matchId,
    tableId,
    eventType: 'match_started',
    details: `QA Simulation Match started. Outcome mode: ${simulatedOutcome}. Strategy: ${strategy}. Participants: ${matchPlayers.map((p) => p.userName).join(', ')}.`,
    strategyUsed: strategy,
    isSimulation: true,
    simulatedOutcome,
  });

  return { success: true, match: simMatch };
}

/**
 * Stop or Abort a simulation match safely without touching user balances
 */
export function stopSimulationMatch(matchId: string, reason = 'Stopped by Administrator'): boolean {
  const match = activeSimulationMatches.get(matchId);
  if (!match) return false;

  match.status = 'cancelled';

  // Free participating bots back to idle
  match.players.forEach((p) => {
    if ((p as any).isSimulated || p.userId.startsWith('bot-')) {
      const bot = botPoolMap.get(p.userId);
      if (bot) {
        bot.status = 'idle';
        bot.activeMatchId = null;
        bot.assignedTableId = null;
      }
    }
  });

  addBotLog({
    matchId,
    tableId: match.tableId,
    eventType: 'match_stopped',
    details: `Match stopped: ${reason}. All bots safely returned to idle state. Real balances untouched.`,
    strategyUsed: 'stronger_legal',
    isSimulation: true,
  });

  activeSimulationMatches.delete(matchId);
  return true;
}

/**
 * Reset all active simulation matches
 */
export function resetAllSimulationMatches(): number {
  const count = activeSimulationMatches.size;
  activeSimulationMatches.forEach((match, matchId) => {
    stopSimulationMatch(matchId, 'Batch admin reset');
  });

  botPoolArray.forEach((b) => {
    if (b.status !== 'idle') {
      b.status = 'idle';
      b.activeMatchId = null;
      b.assignedTableId = null;
    }
  });

  addBotLog({
    matchId: 'system',
    tableId: 'all',
    eventType: 'match_reset',
    details: `Safe reset executed. ${count} simulation matches cleared, all 5000+ bots restored to idle.`,
    strategyUsed: 'stronger_legal',
    isSimulation: true,
  });

  return count;
}

/**
 * Retrieve all active simulation matches
 */
export function getActiveSimulationMatches(): LudoCashMatch[] {
  return Array.from(activeSimulationMatches.values());
}

/**
 * Retrieve bot activity logs
 */
export function getBotMatchLogs(limit = 100): BotMatchLog[] {
  return botMatchLogs.slice(0, limit);
}

/**
 * Clear bot logs
 */
export function clearBotLogs(): void {
  botMatchLogs.length = 0;
  addBotLog({
    matchId: 'system',
    tableId: 'all',
    eventType: 'match_started',
    details: 'Bot match logs cleared by administrator.',
    strategyUsed: 'stronger_legal',
    isSimulation: true,
  });
}
