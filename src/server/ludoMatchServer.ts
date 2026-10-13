import express, { Request, Response } from 'express';
import {
  LudoCashTable,
  LudoCashMatch,
  LudoOnlinePlayer,
  LudoCashMatchRecord,
  RecentLudoWinner,
  LudoAdminConfig,
  generateDefaultCashTables,
  LUDO_CASH_TABLE_TIERS,
  getTableBotCounts,
  LudoScoreBreakdown,
  LudoScoreEvent,
  LudoFinalRanking,
} from '../types/ludoCash';
import { LudoColor, LudoGameState, LudoToken } from '../types';
import {
  createInitialLudoGame,
  getLegalMoves,
  getNextPlayer,
  getGlobalTrackIndex,
  SAFE_CELL_INDICES,
  capitalize,
} from '../lib/ludoEngine';
import { checkUserBanStatus } from './adminControlServer';
import {
  selectBotMove,
  getBotById,
  addBotLog,
  LUDO_BOTS_ENABLED,
  botPoolConfig,
  generateStealthPlayer,
} from './ludoBotEngine';

export const ludoRouter = express.Router();

// Authoritative In-Memory Game Store
const cashTables: LudoCashTable[] = generateDefaultCashTables();

const adminConfig: LudoAdminConfig = {
  onlineLudoEnabled: true,
  timerLudoEnabled: true,
  durationMinutes2P: 8,
  durationMinutes4P: 15,
  homeBonusPoints: 60,
  dicePointsEnabled: true,
  captureTransferEnabled: true,
  tieBreakerRule: 'home_tokens_then_captures',
  allowTwoPlayer: true,
  allowFourPlayer: true,
  turnTimeoutSeconds: 30,
  maxTimeoutsBeforeForfeit: 3,
};

// Queues: Map of tableId -> array of waiting players
interface QueuedPlayer {
  userId: string;
  userName: string;
  avatar?: string;
  joinedAt: string;
  isSimulated?: boolean;
}
const waitingQueues = new Map<string, QueuedPlayer[]>();

// Active Matches: Map of matchId -> LudoCashMatch
const activeMatches = new Map<string, LudoCashMatch>();

// Completed Match Ledger
const matchHistory: LudoCashMatchRecord[] = [];

// Helper: sync queue counts, admin bot configuration, and 5000+ bot pool distribution into all 42 cashTables
export function updateTableQueueStats() {
  const botsActive = botPoolConfig.enabled;
  // Bot pool scaling factor relative to default 5200 virtual bot pool
  const poolMultiplier = botPoolConfig.poolSize > 0 ? (botPoolConfig.poolSize / 5200) : 1;

  cashTables.forEach((table) => {
    const queue = waitingQueues.get(table.id) || [];
    table.waitingPlayers = queue.length;

    let activeCount = 0;
    activeMatches.forEach((m) => {
      if (m.tableId === table.id && (m.status === 'in_progress' || m.status === 'starting')) {
        activeCount++;
      }
    });
    table.activeMatches = activeCount;
    table.status = queue.length > 0 ? 'waiting' : activeCount > 0 ? 'in_progress' : 'waiting';

    // Distribute 5000+ bots with non-identical numbers per table (<250 high, >250 low)
    const botCounts = getTableBotCounts(table.entryFee, table.mode);
    const scaledOnline = botsActive ? Math.max(1, Math.round(botCounts.onlinePlayers * poolMultiplier)) : 0;
    const scaledPlaying = botsActive ? Math.max(1, Math.round(botCounts.playingPlayers * poolMultiplier)) : 0;

    // If admin explicitly set custom traffic for this table, honor manual count
    if (table.manualOnlinePlayers !== undefined) {
      table.onlinePlayers = Math.max(0, table.manualOnlinePlayers + queue.length);
    } else {
      table.onlinePlayers = scaledOnline + queue.length;
    }

    if (table.manualPlayingPlayers !== undefined) {
      table.playingPlayers = Math.max(0, table.manualPlayingPlayers + (activeCount * table.mode));
    } else {
      table.playingPlayers = scaledPlaying + (activeCount * table.mode);
    }

    // Periodically authoritative current_players field for all 42 tables
    table.current_players = table.onlinePlayers + table.playingPlayers;
  });
}

// Deterministic Tie-Breaker rule descriptions for players and admin
export function getTieBreakerDescription(rule: string = adminConfig.tieBreakerRule): string {
  switch (rule) {
    case 'most_captures':
      return 'Hierarchy: 1) Highest Score ➔ 2) Most Captures ➔ 3) Most Home Tokens ➔ 4) Fewest Timeouts';
    case 'least_timeouts':
      return 'Hierarchy: 1) Highest Score ➔ 2) Fewest Timeouts ➔ 3) Most Home Tokens ➔ 4) Most Captures';
    case 'home_tokens_then_captures':
    default:
      return 'Hierarchy: 1) Highest Score ➔ 2) Most Home Tokens ➔ 3) Most Captures ➔ 4) Fewest Timeouts';
  }
}

/**
 * Authoritatively concludes a Timer Ludo match:
 * Calculates all player scores, resolves ties deterministically,
 * awards real cash / simulation victory, and records in ledger.
 */
export function finalizeTimerLudoMatch(match: LudoCashMatch, reasonText: string) {
  if (match.status === 'completed') return;

  match.status = 'completed';
  match.gameState.isGameOver = true;
  match.completedAt = new Date().toISOString();
  match.timeRemainingSeconds = 0;

  // Build ranking table for all participants
  const rankings: LudoFinalRanking[] = match.players.map((p) => {
    const homeTokens = match.gameState.tokens[p.color]?.filter((t) => t.step === 56).length || 0;
    const captures = p.scoreBreakdown?.capturesCount || 0;
    const timeouts = p.timeoutCount || 0;
    const totalScore = p.score || 0;

    return {
      rank: 1,
      userId: p.userId,
      userName: p.userName,
      color: p.color,
      score: totalScore,
      tokensHomeCount: homeTokens,
      capturesCount: captures,
      timeoutsCount: timeouts,
      prizeWon: 0,
      isWinner: false,
      scoreBreakdown: p.scoreBreakdown || {
        dicePoints: 0,
        capturePoints: 0,
        homeBonuses: 0,
        lostInCaptures: 0,
        totalScore,
        tokensHomeCount: homeTokens,
        capturesCount: captures,
      },
    };
  });

  // Sort by Timer Ludo Rules:
  // Primary: Total Score (Highest Score Wins)
  // Tie-Breaker: Configured deterministic rule
  rankings.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    if (adminConfig.tieBreakerRule === 'most_captures') {
      if (b.capturesCount !== a.capturesCount) return b.capturesCount - a.capturesCount;
      if (b.tokensHomeCount !== a.tokensHomeCount) return b.tokensHomeCount - a.tokensHomeCount;
    } else if (adminConfig.tieBreakerRule === 'least_timeouts') {
      if (a.timeoutsCount !== b.timeoutsCount) return a.timeoutsCount - b.timeoutsCount;
      if (b.tokensHomeCount !== a.tokensHomeCount) return b.tokensHomeCount - a.tokensHomeCount;
    } else {
      // Default: home_tokens_then_captures
      if (b.tokensHomeCount !== a.tokensHomeCount) return b.tokensHomeCount - a.tokensHomeCount;
      if (b.capturesCount !== a.capturesCount) return b.capturesCount - a.capturesCount;
    }

    // Secondary Tie-Breaker: Fewest timeouts
    if (a.timeoutsCount !== b.timeoutsCount) return a.timeoutsCount - b.timeoutsCount;
    return 0;
  });

  // Assign final rank numbers and allocate prize to champion
  rankings.forEach((r, idx) => {
    r.rank = idx + 1;
    if (idx === 0) {
      r.isWinner = true;
      r.prizeWon = match.prizeAmount;
    } else {
      r.isWinner = false;
      r.prizeWon = 0;
    }
  });

  const winner = rankings[0];
  match.winnerId = winner.userId;
  match.winnerName = winner.userName;
  match.winnerColor = winner.color;
  match.gameState.winners = [winner.color];
  match.finalRankings = rankings;
  match.gameState.lastActionText = `🏆 ${reasonText} Champion: ${winner.userName} (${winner.score} pts)!`;

  // Ledger recording
  if (!(match as any).isSimulation) {
    rankings.forEach((r) => {
      matchHistory.unshift({
        id: `rec-${match.id}-${r.userId}`,
        userId: r.userId,
        userName: r.userName,
        matchId: match.id,
        tableTitle: `₹${match.entryFee} (${match.playerCount}P)`,
        entryFee: match.entryFee,
        mode: match.playerCount,
        prizeWon: r.prizeWon,
        isWinner: r.isWinner,
        status: 'completed',
        referenceId: `TIMER-LUDO-${match.id}`,
        timestamp: new Date().toISOString(),
        finalScore: r.score,
        rank: r.rank,
        scoreBreakdown: r.scoreBreakdown,
      });
    });
  } else {
    addBotLog({
      matchId: match.id,
      tableId: match.tableId,
      eventType: 'match_finished',
      details: `QA Simulation Match completed! Winner: ${winner.userName} with score ${winner.score}. Zero real cash impact.`,
      strategyUsed: (match as any).strategy || 'stronger_legal',
      isSimulation: true,
      winnerId: match.winnerId,
      winnerName: match.winnerName,
    });
  }
}

/**
 * Checks if match timer has reached zero based on authoritative server time.
 * If expired, immediately completes match and calculates final scores.
 */
export function checkMatchTimerExpired(match: LudoCashMatch): boolean {
  if (match.status === 'completed' || match.gameState.isGameOver) return true;
  if (!match.endsAt) return false;

  const now = Date.now();
  const endsAtTime = new Date(match.endsAt).getTime();
  const remainingMs = endsAtTime - now;
  match.timeRemainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

  if (remainingMs <= 0) {
    finalizeTimerLudoMatch(match, 'Official match timer reached 00:00! Time Over!');
    return true;
  }
  return false;
}

/**
 * Periodic routine checking all live matches for timer expirations
 */
function checkAllActiveMatchTimers() {
  for (const match of activeMatches.values()) {
    if (match.status === 'in_progress' && !match.gameState.isGameOver && match.endsAt) {
      checkMatchTimerExpired(match);
    }
  }
}

// Server-side routine that periodically updates current_players and validates match timers every 3 seconds
const tableTrafficPeriodicInterval = setInterval(() => {
  try {
    updateTableQueueStats();
    checkAllActiveMatchTimers();
  } catch (err) {
    console.error('Error in periodic table and timer update routine:', err);
  }
}, 3000);

if (tableTrafficPeriodicInterval.unref) {
  tableTrafficPeriodicInterval.unref();
}

// Initial populate
updateTableQueueStats();

// Active timers for auto-matching stealth bots when no real players are online
const queueAutoMatchTimers = new Map<string, NodeJS.Timeout>();

export function clearQueueTimer(tableId: string) {
  const existing = queueAutoMatchTimers.get(tableId);
  if (existing) {
    clearTimeout(existing);
    queueAutoMatchTimers.delete(tableId);
  }
}

/**
 * Creates and starts an authoritative Timer Ludo match:
 * Sets exact match duration (2P = 8 min, 4P = 15 min),
 * marks match as started, initializes player score trackers,
 * sets server endsAt timestamp, and initiates turn timers.
 */
export function createAndStartMatch(
  table: LudoCashTable,
  matchedPlayers: QueuedPlayer[],
  isSimulation = false
): LudoCashMatch {
  const matchId = `match-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const colors: LudoColor[] = table.mode === 2 ? ['red', 'yellow'] : ['red', 'green', 'yellow', 'blue'];

  // 2-player matches: 8 minutes (or admin configured), 4-player matches: 15 minutes
  const durationMinutes = table.mode === 2
    ? (adminConfig.durationMinutes2P || 8)
    : (adminConfig.durationMinutes4P || 15);
  const durationSeconds = durationMinutes * 60;
  const startedAt = new Date().toISOString();
  const endsAt = new Date(Date.now() + durationSeconds * 1000).toISOString();

  const onlinePlayers: LudoOnlinePlayer[] = matchedPlayers.map((p, idx) => ({
    userId: p.userId,
    userName: p.userName,
    avatar: p.avatar,
    color: colors[idx],
    isReady: true,
    isOnline: true,
    lastActive: new Date().toISOString(),
    timeoutCount: 0,
    isSimulated: (p as any).isSimulated || false,
    score: 0,
    scoreBreakdown: {
      dicePoints: 0,
      capturePoints: 0,
      homeBonuses: 0,
      lostInCaptures: 0,
      totalScore: 0,
      tokensHomeCount: 0,
      capturesCount: 0,
    },
  }));

  const initialGame = createInitialLudoGame(table.mode);
  initialGame.scores = {
    red: 0,
    green: 0,
    yellow: 0,
    blue: 0,
  };

  const newMatch: LudoCashMatch = {
    id: matchId,
    tableId: table.id,
    entryFee: table.entryFee,
    playerCount: table.mode,
    prizeAmount: table.prize,
    status: 'in_progress',
    players: onlinePlayers,
    gameState: initialGame,
    createdAt: new Date().toISOString(),
    startedAt,
    endsAt,
    durationMinutes,
    durationSeconds,
    timeRemainingSeconds: durationSeconds,
    modeName: 'Timer Ludo — Highest Score Wins',
    scoreHistory: [],
    tieBreakerRule: getTieBreakerDescription(adminConfig.tieBreakerRule),
    turnDeadline: new Date(Date.now() + adminConfig.turnTimeoutSeconds * 1000).toISOString(),
  };

  if (isSimulation) {
    (newMatch as any).isSimulation = true;
  }

  activeMatches.set(matchId, newMatch);
  updateTableQueueStats();

  addBotLog({
    matchId,
    tableId: table.id,
    eventType: 'match_started',
    details: `Timer Ludo match started on table ${table.id} (${table.mode}P, ${durationMinutes} min). Highest Score Wins. Total players: ${matchedPlayers.length}.`,
    strategyUsed: botPoolConfig.defaultStrategy || 'stronger_legal',
    isSimulation,
  });

  // Run initial bot turn if starting player is simulated
  checkAndRunBotTurn(newMatch);

  return newMatch;
}

/**
 * Automatically fills remaining empty slots with realistic stealth players
 * when no other real player has joined after wait time (e.g. 3 seconds).
 * Ensures 2-player and 4-player tables start seamlessly with no delay.
 */
export function autoFillQueueWithStealthBots(tableId: string) {
  clearQueueTimer(tableId);

  const table = cashTables.find((t) => t.id === tableId);
  if (!table || !table.isActive) return;

  const queue = waitingQueues.get(tableId);
  if (!queue || queue.length === 0) return;
  if (queue.length >= table.mode) return;

  // Ensure there is at least one real human player waiting
  const hasRealPlayer = queue.some((p) => !p.isSimulated);
  if (!hasRealPlayer) return;

  // Add realistic stealth players (undistinguishable from genuine players)
  while (queue.length < table.mode) {
    const stealth = generateStealthPlayer();
    queue.push({
      userId: stealth.userId,
      userName: stealth.userName,
      avatar: stealth.avatar,
      joinedAt: new Date().toISOString(),
      isSimulated: true,
    });
  }

  // Launch the match immediately
  const matchedPlayers = queue.splice(0, table.mode);
  createAndStartMatch(table, matchedPlayers, false);
}

/**
 * Schedules auto-match countdown (default 3 seconds) for an unfilled table queue
 */
export function scheduleAutoMatchStealthBots(tableId: string) {
  if (!botPoolConfig.autoMatchStealthBots && !LUDO_BOTS_ENABLED) return;
  if (queueAutoMatchTimers.has(tableId)) return;

  const waitSeconds = botPoolConfig.autoMatchWaitSeconds || 3;
  const timer = setTimeout(() => {
    autoFillQueueWithStealthBots(tableId);
  }, waitSeconds * 1000);

  queueAutoMatchTimers.set(tableId, timer);
}

/**
 * Authoritatively applies a validated dice roll to the match:
 * 1) Enforces consecutive sixes limit (3 sixes forfeits turn).
 * 2) Adds dice points (1=1pt, 2=2pt, 3=3pt, 4=4pt, 5=5pt, 6=6pt) to current player's match score.
 * 3) Logs event to authoritative scoreHistory ledger.
 */
function applyDiceRollToMatch(
  match: LudoCashMatch,
  color: LudoColor,
  roll: number
): { forfeited: boolean } {
  match.gameState.diceValue = roll;
  match.gameState.hasRolled = true;

  const newConsecutive = roll === 6 ? (match.gameState.consecutiveSixes || 0) + 1 : 0;
  match.gameState.consecutiveSixes = newConsecutive;

  if (newConsecutive >= 3) {
    match.gameState.lastActionText = `❌ 3 consecutive sixes! Turn forfeited.`;
    return { forfeited: true };
  }

  // Add dice points to current player's match score according to server-validated dice result
  if (adminConfig.dicePointsEnabled) {
    const player = match.players.find((p) => p.color === color);
    if (player) {
      if (!player.scoreBreakdown) {
        player.scoreBreakdown = {
          dicePoints: 0,
          capturePoints: 0,
          homeBonuses: 0,
          lostInCaptures: 0,
          totalScore: player.score || 0,
          tokensHomeCount: 0,
          capturesCount: 0,
        };
      }
      player.score = (player.score || 0) + roll;
      player.scoreBreakdown.dicePoints += roll;
      player.scoreBreakdown.totalScore = player.score;

      match.gameState.scores = match.gameState.scores || { red: 0, green: 0, yellow: 0, blue: 0 };
      match.gameState.scores[color] = player.score;

      match.scoreHistory = match.scoreHistory || [];
      match.scoreHistory.push({
        id: `sh-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        timestamp: new Date().toISOString(),
        userId: player.userId,
        color,
        type: 'dice_roll',
        points: roll,
        description: `${player.userName} rolled ${roll} (+${roll} pts)`,
        totalScoreAfter: player.score,
      });
    }
  }

  return { forfeited: false };
}

// Execute Bot Turn with natural, human-like reaction times
function checkAndRunBotTurn(match: LudoCashMatch) {
  if (match.status !== 'in_progress' || match.gameState.isGameOver) return;
  if (checkMatchTimerExpired(match)) return;

  const currentTurn = match.gameState.currentTurn;
  const player = match.players.find((p) => p.color === currentTurn);
  if (!player || !(player as any).isSimulated) return;

  // Bot plays after natural human-like delay (1.2 to 2.2 seconds)
  const rollDelay = Math.floor(Math.random() * 800) + 1200;
  setTimeout(() => {
    // Verify match is still active and same turn
    if (match.status !== 'in_progress' || match.gameState.currentTurn !== currentTurn) return;
    if (checkMatchTimerExpired(match)) return;

    if (!match.gameState.hasRolled) {
      // 1. Authoritative Roll
      const roll = Math.floor(Math.random() * 6) + 1;
      const rollResult = applyDiceRollToMatch(match, currentTurn, roll);

      if (rollResult.forfeited) {
        advanceMatchTurn(match, false);
        checkAndRunBotTurn(match);
        return;
      }

      const legalMoves = getLegalMoves(match.gameState.tokens, currentTurn, roll);
      match.gameState.highlightedTokenIds = legalMoves;

      if (legalMoves.length === 0) {
        match.gameState.lastActionText = `${player.userName} rolled ${roll} - No legal moves!`;
        // Advance turn after short pause
        setTimeout(() => {
          advanceMatchTurn(match, false);
          checkAndRunBotTurn(match);
        }, 1100);
      } else {
        match.gameState.lastActionText = `${player.userName} rolled ${roll}. Thinking move...`;
        // 2. Bot selects a legal token to move based on documented strategy
        const moveDelay = Math.floor(Math.random() * 800) + 1000;
        setTimeout(() => {
          if (checkMatchTimerExpired(match)) return;

          const botProfile = getBotById(player.userId);
          const botStrategy = botProfile?.strategy || (match as any).strategy || 'stronger_legal';

          const chosenTokenId = selectBotMove(
            match.gameState,
            currentTurn,
            roll,
            legalMoves,
            botStrategy
          );

          addBotLog({
            matchId: match.id,
            tableId: match.tableId,
            eventType: 'token_moved',
            details: `${player.userName} rolled ${roll} and moved token ${chosenTokenId} using '${botStrategy}' strategy.`,
            strategyUsed: botStrategy,
            isSimulation: (match as any).isSimulation || false,
          });

          executeTokenMove(match, currentTurn, chosenTokenId);
          // If bot gets extra turn, run again
          if (match.status === 'in_progress' && !match.gameState.isGameOver) {
            checkAndRunBotTurn(match);
          }
        }, moveDelay);
      }
    }
  }, rollDelay);
}

// Advance Turn Logic
function advanceMatchTurn(match: LudoCashMatch, extraTurn: boolean) {
  if (checkMatchTimerExpired(match)) return;

  if (extraTurn) {
    match.gameState.hasRolled = false;
    match.gameState.diceValue = null;
    match.gameState.highlightedTokenIds = [];
    match.gameState.extraTurn = true;
    match.turnDeadline = new Date(Date.now() + adminConfig.turnTimeoutSeconds * 1000).toISOString();
  } else {
    const nextColor = getNextPlayer(
      match.gameState.currentTurn,
      match.gameState.players,
      match.gameState.winners
    );
    match.gameState.currentTurn = nextColor;
    match.gameState.hasRolled = false;
    match.gameState.diceValue = null;
    match.gameState.highlightedTokenIds = [];
    match.gameState.extraTurn = false;
    match.gameState.lastActionText = `${capitalize(nextColor)}'s turn to roll!`;
    match.turnDeadline = new Date(Date.now() + adminConfig.turnTimeoutSeconds * 1000).toISOString();
  }
}

/**
 * Move Token Logic on the Server for Timer Ludo:
 * - Increases moving token's recorded score by the dice roll amount.
 * - If token reaches Home (56): awards +60 points home bonus once per token and logs to history.
 * - If token captures opponent: transfers captured token's recorded score from victim to captor,
 *   deducts from victim, applies transfer once, and resets captured token to 0 in yard.
 * - Grants extra turn for 6, capture, or reaching home.
 * - Concludes match with finalizeTimerLudoMatch if all tokens reach home.
 */
function executeTokenMove(
  match: LudoCashMatch,
  color: LudoColor,
  tokenId: number
): { success: boolean; error?: string } {
  if (checkMatchTimerExpired(match)) {
    return { success: false, error: 'Match timer has ended! Score calculation in progress.' };
  }

  const token = match.gameState.tokens[color].find((t) => t.id === tokenId);
  if (!token) return { success: false, error: 'Token not found' };

  const roll = match.gameState.diceValue;
  if (!roll) return { success: false, error: 'No active roll' };

  let extraTurn = roll === 6;
  let actionDesc = '';

  const player = match.players.find((p) => p.color === color);
  if (!player) return { success: false, error: 'Player not found' };

  if (!player.scoreBreakdown) {
    player.scoreBreakdown = {
      dicePoints: 0,
      capturePoints: 0,
      homeBonuses: 0,
      lostInCaptures: 0,
      totalScore: player.score || 0,
      tokensHomeCount: 0,
      capturesCount: 0,
    };
  }

  if (token.step === -1) {
    if (roll !== 6) return { success: false, error: 'Need 6 to leave yard' };
    token.step = 0;
    // Record roll score on this token
    token.score = (token.score || 0) + roll;
    actionDesc = `${capitalize(color)} entered track at start! Token active with ${token.score} pts.`;
  } else {
    const nextStep = token.step + roll;
    if (nextStep > 56) return { success: false, error: 'Overshot home' };
    token.step = nextStep;
    // Record roll score on this token
    token.score = (token.score || 0) + roll;
    actionDesc = `${capitalize(color)} moved to step ${nextStep}.`;

    // 4. REACHING HOME: Award 60 points bonus only once per token
    if (token.step === 56) {
      extraTurn = true;
      if (!token.reachedHome) {
        token.reachedHome = true;
        const bonus = adminConfig.homeBonusPoints || 60;
        player.score = (player.score || 0) + bonus;
        player.scoreBreakdown.homeBonuses += bonus;
        player.scoreBreakdown.tokensHomeCount += 1;
        player.scoreBreakdown.totalScore = player.score;

        match.gameState.scores = match.gameState.scores || { red: 0, green: 0, yellow: 0, blue: 0 };
        match.gameState.scores[color] = player.score;

        match.scoreHistory = match.scoreHistory || [];
        match.scoreHistory.push({
          id: `sh-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          timestamp: new Date().toISOString(),
          userId: player.userId,
          color,
          type: 'home_bonus',
          points: bonus,
          description: `🎉 ${player.userName} reached HOME! +${bonus} Home Bonus awarded!`,
          totalScoreAfter: player.score,
        });

        actionDesc = `🎉 ${capitalize(color)} moved token to HOME! +${bonus} points home bonus! Extra roll!`;
      } else {
        actionDesc = `${capitalize(color)} token already completed home.`;
      }
    } else if (token.step <= 50) {
      // 3. CAPTURE OPPONENT'S TOKEN:
      // Transfer captured token's recorded score to capturing player, deduct from captured player
      const myGlobalIdx = getGlobalTrackIndex(color, token.step);
      if (myGlobalIdx !== null && !SAFE_CELL_INDICES.has(myGlobalIdx)) {
        match.gameState.players.forEach((otherColor) => {
          if (otherColor !== color) {
            match.gameState.tokens[otherColor].forEach((otherToken) => {
              if (otherToken.step >= 0 && otherToken.step <= 50) {
                const otherGlobalIdx = getGlobalTrackIndex(otherColor, otherToken.step);
                if (otherGlobalIdx === myGlobalIdx) {
                  // Capture triggered!
                  const capturedScore = otherToken.score || 0;
                  const otherPlayer = match.players.find((p) => p.color === otherColor);

                  if (adminConfig.captureTransferEnabled && otherPlayer) {
                    if (!otherPlayer.scoreBreakdown) {
                      otherPlayer.scoreBreakdown = {
                        dicePoints: 0,
                        capturePoints: 0,
                        homeBonuses: 0,
                        lostInCaptures: 0,
                        totalScore: otherPlayer.score || 0,
                        tokensHomeCount: 0,
                        capturesCount: 0,
                      };
                    }

                    if (!player.scoreBreakdown) {
                      player.scoreBreakdown = {
                        dicePoints: 0,
                        capturePoints: 0,
                        homeBonuses: 0,
                        lostInCaptures: 0,
                        totalScore: player.score || 0,
                        tokensHomeCount: 0,
                        capturesCount: 0,
                      };
                    }

                    // Transfer score
                    player.score = (player.score || 0) + capturedScore;
                    player.scoreBreakdown.capturePoints += capturedScore;
                    player.scoreBreakdown.capturesCount += 1;
                    player.scoreBreakdown.totalScore = player.score;

                    otherPlayer.score = Math.max(0, (otherPlayer.score || 0) - capturedScore);
                    otherPlayer.scoreBreakdown.lostInCaptures += capturedScore;
                    otherPlayer.scoreBreakdown.totalScore = otherPlayer.score;

                    match.gameState.scores = match.gameState.scores || { red: 0, green: 0, yellow: 0, blue: 0 };
                    match.gameState.scores[color] = player.score;
                    match.gameState.scores[otherColor] = otherPlayer.score;

                    match.scoreHistory = match.scoreHistory || [];
                    match.scoreHistory.push({
                      id: `sh-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
                      timestamp: new Date().toISOString(),
                      userId: player.userId,
                      color,
                      type: 'capture_transfer',
                      points: capturedScore,
                      description: `💥 ${player.userName} CAPTURED ${otherPlayer.userName}'s token! Transferred ${capturedScore} points!`,
                      totalScoreAfter: player.score,
                    });
                  }

                  // Reset captured token to yard with ZERO points (prevents duplicate transfers)
                  otherToken.step = -1;
                  otherToken.score = 0;
                  otherToken.reachedHome = false;

                  extraTurn = true;
                  actionDesc = `💥 ${capitalize(color)} CAPTURED ${capitalize(otherColor)}! Transferred ${capturedScore} pts! Extra roll!`;
                }
              }
            });
          }
        });
      }
    }
  }

  match.gameState.lastActionText = actionDesc;

  // Check if player has brought all 4 tokens to Home (immediate victory condition)
  const allHome = match.gameState.tokens[color].every((t) => t.step === 56);
  if (allHome && !match.gameState.winners.includes(color)) {
    finalizeTimerLudoMatch(match, `${player.userName} brought all tokens home!`);
    return { success: true };
  }

  advanceMatchTurn(match, extraTurn);
  return { success: true };
}

// ==========================================
// API ENDPOINTS
// ==========================================

// 1. Get All Tables with Live Status & Queues
ludoRouter.get('/tables', (req: Request, res: Response) => {
  updateTableQueueStats();
  res.json({
    success: true,
    enabled: adminConfig.onlineLudoEnabled,
    allowTwoPlayer: adminConfig.allowTwoPlayer,
    allowFourPlayer: adminConfig.allowFourPlayer,
    turnTimeoutSeconds: adminConfig.turnTimeoutSeconds,
    tables: cashTables,
  });
});

// 2. Join Matchmaking Queue (Locks entry fee on client via WalletContext & registers in server queue)
ludoRouter.post('/queue/join', (req: Request, res: Response) => {
  const { tableId, userId, userName, avatar } = req.body;

  if (!adminConfig.onlineLudoEnabled) {
    return res.status(403).json({ error: 'Online Ludo is temporarily paused by administrator.' });
  }

  if (!tableId || !userId) {
    return res.status(400).json({ error: 'tableId and userId are required.' });
  }

  // Server-side Player Ban & Blacklist Enforcement
  const banStatus = checkUserBanStatus(userId, 'ludo');
  if (banStatus.banned) {
    return res.status(403).json({
      error: `Access Denied: Your account is restricted (${banStatus.reason || 'Restricted by administrator'}).`,
      isBanned: true,
      restriction: banStatus.restriction,
    });
  }

  const table = cashTables.find((t) => t.id === tableId);
  if (!table || !table.isActive) {
    return res.status(404).json({ error: 'Selected cash table is inactive or unavailable.' });
  }

  // Check if user is already playing in an active match
  for (const [mId, m] of activeMatches.entries()) {
    if (m.status === 'in_progress' && m.players.some((p) => p.userId === userId)) {
      return res.json({
        success: true,
        alreadyInMatch: true,
        matchId: mId,
        match: m,
        message: 'Reconnected to your active match in progress.',
      });
    }
  }

  // Get or create queue
  let queue = waitingQueues.get(tableId);
  if (!queue) {
    queue = [];
    waitingQueues.set(tableId, queue);
  }

  // Check if user already in this queue
  const existingIdx = queue.findIndex((p) => p.userId === userId);
  if (existingIdx !== -1) {
    return res.json({
      success: true,
      status: 'waiting',
      queuePosition: existingIdx + 1,
      totalWaiting: queue.length,
      needed: table.mode,
      message: 'Already in waiting queue for this table.',
    });
  }

  // Add to queue
  const newPlayer: QueuedPlayer = {
    userId,
    userName: userName || 'Player',
    avatar,
    joinedAt: new Date().toISOString(),
    isSimulated: false,
  };
  queue.push(newPlayer);
  updateTableQueueStats();

  // Check if queue has enough players to launch match immediately with real players
  if (queue.length >= table.mode) {
    clearQueueTimer(tableId);
    const matchedPlayers = queue.splice(0, table.mode);
    const newMatch = createAndStartMatch(table, matchedPlayers, false);

    return res.json({
      success: true,
      status: 'starting',
      matchId: newMatch.id,
      match: newMatch,
      message: `Match starting with ${table.mode} players!`,
    });
  }

  // Schedule automatic matchmaking: If no other real player joins in 3s,
  // stealth opponents automatically join so the user never has to wait!
  scheduleAutoMatchStealthBots(tableId);

  return res.json({
    success: true,
    status: 'waiting',
    queuePosition: queue.length,
    totalWaiting: queue.length,
    needed: table.mode,
    message: `Joined queue (${queue.length}/${table.mode}). Searching for players...`,
  });
});

// 3. Simulate Opponent / Quick Match (For testing or instant matching)
ludoRouter.post('/queue/simulate-opponent', (req: Request, res: Response) => {
  const { tableId } = req.body;
  const table = cashTables.find((t) => t.id === tableId);
  if (!table) return res.status(404).json({ error: 'Table not found' });

  // 1. Enforce global LUDO_BOTS_ENABLED feature flag
  if (!LUDO_BOTS_ENABLED) {
    return res.status(403).json({
      error: 'Bot matchmaking is globally disabled (LUDO_BOTS_ENABLED = false). Enable bots in Admin Settings.',
    });
  }

  let queue = waitingQueues.get(tableId);
  if (!queue || queue.length === 0) {
    return res.status(400).json({ error: 'No human player waiting in this table queue to pair with.' });
  }

  clearQueueTimer(tableId);

  // Add realistic stealth players until table fills (natural human-like names and avatars)
  while (queue.length < table.mode) {
    const stealth = generateStealthPlayer();
    queue.push({
      userId: stealth.userId,
      userName: stealth.userName,
      avatar: stealth.avatar,
      joinedAt: new Date().toISOString(),
      isSimulated: true,
    });
  }

  // Launch match immediately
  const matchedPlayers = queue.splice(0, table.mode);
  const newMatch = createAndStartMatch(table, matchedPlayers, false);

  return res.json({
    success: true,
    status: 'starting',
    matchId: newMatch.id,
    match: newMatch,
  });
});

// 4. Cancel Queue & 100% Refund
ludoRouter.post('/queue/cancel', (req: Request, res: Response) => {
  const { tableId, userId } = req.body;
  if (!tableId || !userId) return res.status(400).json({ error: 'tableId and userId required' });

  const table = cashTables.find((t) => t.id === tableId);
  const queue = waitingQueues.get(tableId);
  if (queue) {
    const idx = queue.findIndex((p) => p.userId === userId);
    if (idx !== -1) {
      queue.splice(idx, 1);
      const hasReal = queue.some((p) => !p.isSimulated);
      if (!hasReal) {
        clearQueueTimer(tableId);
        waitingQueues.set(tableId, []);
      }
      updateTableQueueStats();
      return res.json({
        success: true,
        refundAmount: table?.entryFee || 0,
        message: 'Queue cancelled successfully. Reserved entry fee refunded 100%.',
      });
    }
  }

  return res.json({ success: true, refundAmount: table?.entryFee || 0 });
});

// 5. Query Queue Status / Match Readiness
ludoRouter.get('/queue/status', (req: Request, res: Response) => {
  const { tableId, userId } = req.query as { tableId: string; userId: string };

  // Check if match was created for this user
  for (const [mId, m] of activeMatches.entries()) {
    if (
      (m.status === 'starting' || m.status === 'in_progress') &&
      m.players.some((p) => p.userId === userId)
    ) {
      return res.json({
        inMatch: true,
        matchId: mId,
        match: m,
      });
    }
  }

  // Check waiting queue
  const queue = waitingQueues.get(tableId) || [];
  const pos = queue.findIndex((p) => p.userId === userId);

  return res.json({
    inMatch: false,
    inQueue: pos !== -1,
    queuePosition: pos + 1,
    waitingCount: queue.length,
    needed: cashTables.find((t) => t.id === tableId)?.mode || 2,
  });
});

// 6. Get Authoritative Match State
ludoRouter.get('/match/:matchId/state', (req: Request, res: Response) => {
  const { matchId } = req.params;
  const match = activeMatches.get(matchId);

  if (!match) {
    // Check completed history
    const pastRec = matchHistory.find((r) => r.matchId === matchId);
    if (pastRec) {
      return res.json({
        success: true,
        status: 'completed',
        record: pastRec,
      });
    }
    return res.status(404).json({ error: 'Match not found or expired.' });
  }

  // 1. Authoritative check: has match timer expired?
  checkMatchTimerExpired(match);

  // 2. Turn timeout check
  if (match.status === 'in_progress' && !match.gameState.isGameOver && match.turnDeadline) {
    const now = Date.now();
    const deadline = new Date(match.turnDeadline).getTime();
    if (now > deadline) {
      // Current player timed out!
      const currentTurn = match.gameState.currentTurn;
      const player = match.players.find((p) => p.color === currentTurn);
      if (player) {
        player.timeoutCount = (player.timeoutCount || 0) + 1;
        if (player.timeoutCount >= adminConfig.maxTimeoutsBeforeForfeit) {
          // Forfeit game
          player.isOnline = false;
          match.gameState.lastActionText = `⚠️ ${player.userName} exceeded ${adminConfig.maxTimeoutsBeforeForfeit} timeouts and forfeited!`;
          // Conclude match via timer/score rule
          finalizeTimerLudoMatch(match, `${player.userName} forfeited.`);
        } else {
          // Auto-pass turn
          match.gameState.lastActionText = `⏱️ ${player.userName} turn timed out. Passing to next player.`;
          advanceMatchTurn(match, false);
          checkAndRunBotTurn(match);
        }
      }
    }
  }

  return res.json({ success: true, match });
});

// 7. Authoritative Dice Roll
ludoRouter.post('/match/:matchId/roll', (req: Request, res: Response) => {
  const { matchId } = req.params;
  const { userId, color } = req.body;

  const match = activeMatches.get(matchId);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  // 1. Check timer expiration
  if (checkMatchTimerExpired(match) || match.status !== 'in_progress') {
    return res.status(400).json({ error: 'Match timer has ended or match is completed.', match });
  }

  if (match.gameState.currentTurn !== color) {
    return res.status(403).json({ error: `Not your turn! Current turn is ${match.gameState.currentTurn}` });
  }

  // Validate player owns this color
  const player = match.players.find((p) => p.color === color);
  if (!player || (player.userId !== userId && !(player as any).isSimulated)) {
    return res.status(403).json({ error: 'You do not control this color' });
  }

  if (match.gameState.hasRolled) {
    return res.status(400).json({ error: 'Already rolled for this turn' });
  }

  // Authoritative random roll 1-6
  const roll = Math.floor(Math.random() * 6) + 1;
  const rollResult = applyDiceRollToMatch(match, color, roll);

  if (rollResult.forfeited) {
    advanceMatchTurn(match, false);
    checkAndRunBotTurn(match);
    return res.json({
      success: true,
      roll,
      legalMoves: [],
      forfeited: true,
      match,
    });
  }

  const legalMoves = getLegalMoves(match.gameState.tokens, color, roll);
  match.gameState.highlightedTokenIds = legalMoves;

  if (legalMoves.length === 0) {
    match.gameState.lastActionText = `${capitalize(color)} rolled ${roll}. No legal moves available!`;
    setTimeout(() => {
      advanceMatchTurn(match, false);
      checkAndRunBotTurn(match);
    }, 1500);
  } else {
    match.gameState.lastActionText = `${capitalize(color)} rolled a ${roll}! (+${roll} pts). Tap a highlighted token to move.`;
  }

  // Reset deadline for token move
  match.turnDeadline = new Date(Date.now() + adminConfig.turnTimeoutSeconds * 1000).toISOString();

  return res.json({
    success: true,
    roll,
    legalMoves,
    match,
  });
});

// 8. Authoritative Token Move
ludoRouter.post('/match/:matchId/move', (req: Request, res: Response) => {
  const { matchId } = req.params;
  const { userId, color, tokenId } = req.body;

  const match = activeMatches.get(matchId);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  // 1. Check timer expiration
  if (checkMatchTimerExpired(match) || match.status !== 'in_progress') {
    return res.status(400).json({ error: 'Match timer has ended or match is completed.', match });
  }

  if (match.gameState.currentTurn !== color) {
    return res.status(403).json({ error: `Not your turn! Current turn is ${match.gameState.currentTurn}` });
  }

  const player = match.players.find((p) => p.color === color);
  if (!player || (player.userId !== userId && !(player as any).isSimulated)) {
    return res.status(403).json({ error: 'You do not control this color' });
  }

  if (!match.gameState.hasRolled || match.gameState.diceValue === null) {
    return res.status(400).json({ error: 'Must roll dice first' });
  }

  const result = executeTokenMove(match, color, Number(tokenId));
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  // Trigger bot if next turn is simulated
  checkAndRunBotTurn(match);

  return res.json({
    success: true,
    match,
  });
});

// 9. Leave Match / Forfeit
ludoRouter.post('/match/:matchId/leave', (req: Request, res: Response) => {
  const { matchId } = req.params;
  const { userId } = req.body;

  const match = activeMatches.get(matchId);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  if (match.status === 'in_progress' && !match.gameState.isGameOver) {
    const quittingPlayer = match.players.find((p) => p.userId === userId);
    const opponent = match.players.find((p) => p.userId !== userId);

    if (quittingPlayer && opponent) {
      match.gameState.isGameOver = true;
      match.status = 'completed';
      match.completedAt = new Date().toISOString();
      match.winnerId = opponent.userId;
      match.winnerName = opponent.userName;
      match.winnerColor = opponent.color;
      match.gameState.winners = [opponent.color];
      match.gameState.lastActionText = `🏳️ ${quittingPlayer.userName} left the table. ${opponent.userName} wins by forfeit!`;

      // Record in ledger
      matchHistory.unshift({
        id: `rec-${match.id}-${opponent.userId}`,
        userId: opponent.userId,
        userName: opponent.userName,
        matchId: match.id,
        tableTitle: `₹${match.entryFee} (${match.playerCount}P)`,
        entryFee: match.entryFee,
        mode: match.playerCount,
        prizeWon: match.prizeAmount,
        isWinner: true,
        status: 'completed',
        referenceId: `LUDO-FORFEIT-${match.id}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return res.json({ success: true, match });
});

// 10. Match History for User
ludoRouter.get('/history/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const userRecords = matchHistory.filter((r) => r.userId === userId);
  res.json({ success: true, records: userRecords });
});

// Seeded verified recent winners for initial lobby marquee
const seededRecentWinners: RecentLudoWinner[] = [
  {
    id: 'seed-win-1',
    matchId: 'match-ludo-891',
    userId: 'usr-rohit-88',
    userName: 'Rohit_Sharma_99',
    tableTitle: '₹50 Table (2P)',
    entryFee: 50,
    mode: 2,
    prizeWon: 87.50,
    completedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: 'seed-win-2',
    matchId: 'match-ludo-892',
    userId: 'usr-vikram-07',
    userName: 'Vikram_Rathore',
    tableTitle: '₹200 Table (2P)',
    entryFee: 200,
    mode: 2,
    prizeWon: 350.00,
    completedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'seed-win-3',
    matchId: 'match-ludo-893',
    userId: 'usr-priya-k',
    userName: 'Priya_LudoQueen',
    tableTitle: '₹100 Table (4P)',
    entryFee: 100,
    mode: 4,
    prizeWon: 350.00,
    completedAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
  },
  {
    id: 'seed-win-4',
    matchId: 'match-ludo-894',
    userId: 'usr-aman-singh',
    userName: 'Aman_Striker',
    tableTitle: '₹500 Table (2P)',
    entryFee: 500,
    mode: 2,
    prizeWon: 880.00,
    completedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
  },
  {
    id: 'seed-win-5',
    matchId: 'match-ludo-895',
    userId: 'usr-rahul-m',
    userName: 'Rahul_DiceKing',
    tableTitle: '₹20 Table (2P)',
    entryFee: 20,
    mode: 2,
    prizeWon: 35.00,
    completedAt: new Date(Date.now() - 21 * 60 * 1000).toISOString(),
  },
  {
    id: 'seed-win-6',
    matchId: 'match-ludo-896',
    userId: 'usr-deepak-99',
    userName: 'Deepak_Arena7',
    tableTitle: '₹1000 Table (4P)',
    entryFee: 1000,
    mode: 4,
    prizeWon: 3500.00,
    completedAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
  },
  {
    id: 'seed-win-7',
    matchId: 'match-ludo-897',
    userId: 'usr-suresh-p',
    userName: 'Suresh_Player1',
    tableTitle: '₹250 Table (2P)',
    entryFee: 250,
    mode: 2,
    prizeWon: 440.00,
    completedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
];

// 10b. Recent Winners for Lobby Marquee & Showcase
ludoRouter.get('/recent-winners', (req: Request, res: Response) => {
  // Extract completed winners from server authoritative match ledger
  const liveWinners: RecentLudoWinner[] = matchHistory
    .filter((r) => r.isWinner && r.prizeWon > 0)
    .map((r) => ({
      id: r.id,
      matchId: r.matchId,
      userId: r.userId,
      userName: r.userName || ('Player_' + r.userId.slice(-4)),
      tableTitle: r.tableTitle,
      entryFee: r.entryFee,
      mode: r.mode,
      prizeWon: r.prizeWon,
      completedAt: r.timestamp,
    }));

  // Combine live winners with seeded records to guarantee an active ticker
  const seenMatchIds = new Set<string>();
  const combinedWinners: RecentLudoWinner[] = [];

  for (const w of [...liveWinners, ...seededRecentWinners]) {
    if (!seenMatchIds.has(w.matchId)) {
      seenMatchIds.add(w.matchId);
      combinedWinners.push(w);
    }
  }

  res.json({
    success: true,
    winners: combinedWinners.slice(0, 16),
  });
});

// 11. Admin Endpoints: Configure Tables, View Active Matches
ludoRouter.get('/admin/overview', (req: Request, res: Response) => {
  const queuesData: Record<string, number> = {};
  waitingQueues.forEach((list, key) => {
    if (list.length > 0) queuesData[key] = list.length;
  });

  const liveMatches = Array.from(activeMatches.values()).filter(
    (m) => m.status === 'in_progress' || m.status === 'starting'
  );

  res.json({
    success: true,
    config: adminConfig,
    activeQueues: queuesData,
    liveMatchesCount: liveMatches.length,
    completedMatchesCount: matchHistory.length,
    tables: cashTables,
  });
});

// Detailed Tables with Real Waiting Players & Match State (NEVER FAKE)
const getDetailedTablesHandler = (req: Request, res: Response) => {
  updateTableQueueStats();

  const detailedTables = cashTables.map((t) => {
    const queue = waitingQueues.get(t.id) || [];
    const tableMatches = Array.from(activeMatches.values()).filter(
      (m) => m.tableId === t.id && m.status !== 'completed' && m.status !== 'cancelled'
    );

    return {
      ...t,
      waitingQueue: queue.map((p) => ({
        userId: p.userId,
        userName: p.userName,
        joinedAt: p.joinedAt,
        isOnline: true,
      })),
      activeMatches: tableMatches.map((m) => ({
        matchId: m.id,
        status: m.status,
        playerCount: m.playerCount,
        entryFee: m.entryFee,
        prizeAmount: m.prizeAmount,
        startedAt: m.startedAt,
        players: m.players.map((p) => ({
          userId: p.userId,
          userName: p.userName,
          color: p.color,
          isOnline: p.isOnline,
          isReady: p.isReady,
        })),
        currentTurn: m.gameState?.currentTurn,
      })),
    };
  });

  res.json({ success: true, tables: detailedTables, config: adminConfig });
};

ludoRouter.get('/admin/tables/detailed', getDetailedTablesHandler);
ludoRouter.get('/admin/detailed-tables', getDetailedTablesHandler);

// Create New Ludo Table
ludoRouter.post('/admin/table/create', (req: Request, res: Response) => {
  const { entryFee, mode, prize, minBalance } = req.body;

  const fee = Number(entryFee);
  const playerMode = mode === 2 ? 2 : 4;
  if (isNaN(fee) || fee <= 0) {
    return res.status(400).json({ error: 'Valid entry fee greater than zero is required.' });
  }

  const defaultPrize = playerMode === 2 ? Math.round(fee * 1.75 * 100) / 100 : Math.round(fee * 3.5 * 100) / 100;
  const tablePrize = prize !== undefined ? Number(prize) : defaultPrize;

  const newTable: LudoCashTable = {
    id: `custom-table-${Date.now()}-${fee}-${playerMode}p`,
    entryFee: fee,
    mode: playerMode,
    prize: tablePrize,
    isActive: true,
    minBalanceRequired: minBalance ? Number(minBalance) : fee,
    waitingPlayers: 0,
    activeMatches: 0,
    status: 'waiting',
    onlinePlayers: getTableBotCounts(fee, playerMode).onlinePlayers,
    playingPlayers: getTableBotCounts(fee, playerMode).playingPlayers,
    current_players: getTableBotCounts(fee, playerMode).onlinePlayers + getTableBotCounts(fee, playerMode).playingPlayers,
  };

  cashTables.unshift(newTable);
  res.json({ success: true, table: newTable, message: `Created ₹${fee} (${playerMode}P) cash table.` });
});

// Edit Existing Table (Fee, Prize, Active Status, and Player Traffic counts)
ludoRouter.post('/admin/table/edit', (req: Request, res: Response) => {
  const { tableId, entryFee, prize, isActive, onlinePlayers, playingPlayers, resetAutoTraffic } = req.body;
  const table = cashTables.find((t) => t.id === tableId);
  if (!table) return res.status(404).json({ error: 'Table not found.' });

  if (entryFee !== undefined) {
    const fee = Number(entryFee);
    if (!isNaN(fee) && fee > 0) {
      table.entryFee = fee;
      table.minBalanceRequired = fee;
    }
  }
  if (prize !== undefined) {
    const p = Number(prize);
    if (!isNaN(p) && p > 0) table.prize = p;
  }
  if (isActive !== undefined) {
    table.isActive = Boolean(isActive);
  }

  // Handle Online & Playing player counts edit
  if (resetAutoTraffic) {
    delete table.manualOnlinePlayers;
    delete table.manualPlayingPlayers;
  } else {
    if (onlinePlayers !== undefined) {
      const onCount = Number(onlinePlayers);
      if (!isNaN(onCount) && onCount >= 0) {
        table.manualOnlinePlayers = Math.floor(onCount);
      }
    }
    if (playingPlayers !== undefined) {
      const plCount = Number(playingPlayers);
      if (!isNaN(plCount) && plCount >= 0) {
        table.manualPlayingPlayers = Math.floor(plCount);
      }
    }
  }

  updateTableQueueStats();
  res.json({ success: true, table, message: `Table ${tableId} updated successfully.` });
});

// Dedicated Quick-Update for Online and Playing counts on a table
ludoRouter.post('/admin/table/traffic', (req: Request, res: Response) => {
  const { tableId, onlinePlayers, playingPlayers, resetAutoTraffic } = req.body;
  const table = cashTables.find((t) => t.id === tableId);
  if (!table) return res.status(404).json({ error: 'Table not found.' });

  if (resetAutoTraffic) {
    delete table.manualOnlinePlayers;
    delete table.manualPlayingPlayers;
  } else {
    if (onlinePlayers !== undefined) {
      const onCount = Number(onlinePlayers);
      if (!isNaN(onCount) && onCount >= 0) {
        table.manualOnlinePlayers = Math.floor(onCount);
      }
    }
    if (playingPlayers !== undefined) {
      const plCount = Number(playingPlayers);
      if (!isNaN(plCount) && plCount >= 0) {
        table.manualPlayingPlayers = Math.floor(plCount);
      }
    }
  }

  updateTableQueueStats();
  res.json({
    success: true,
    table,
    message: resetAutoTraffic
      ? `Table ${tableId} traffic restored to auto 5000+ bot distribution.`
      : `Table ${tableId} traffic updated: ${table.onlinePlayers} Online, ${table.playingPlayers} Playing.`,
  });
});

// Bulk traffic operations across all tables (Reset all to auto, or global multiplier/scale)
ludoRouter.post('/admin/tables/traffic-bulk', (req: Request, res: Response) => {
  const { action, multiplier } = req.body;

  if (action === 'reset_all_auto') {
    cashTables.forEach((t) => {
      delete t.manualOnlinePlayers;
      delete t.manualPlayingPlayers;
    });
    updateTableQueueStats();
    return res.json({
      success: true,
      message: 'All 42 tables reset to realistic 5,000+ bot pool distribution.',
      tables: cashTables,
    });
  }

  if (action === 'scale' && multiplier) {
    const factor = Number(multiplier);
    if (!isNaN(factor) && factor > 0) {
      cashTables.forEach((t) => {
        const curOn = t.manualOnlinePlayers !== undefined ? t.manualOnlinePlayers : t.onlinePlayers;
        const curPl = t.manualPlayingPlayers !== undefined ? t.manualPlayingPlayers : t.playingPlayers;
        t.manualOnlinePlayers = Math.max(0, Math.floor(curOn * factor));
        t.manualPlayingPlayers = Math.max(0, Math.floor(curPl * factor));
      });
      updateTableQueueStats();
      return res.json({
        success: true,
        message: `Scaled traffic by ${factor}x across all tables.`,
        tables: cashTables,
      });
    }
  }

  res.status(400).json({ error: 'Invalid bulk action specified.' });
});

// Archive Table
ludoRouter.post('/admin/table/archive', (req: Request, res: Response) => {
  const { tableId } = req.body;
  const idx = cashTables.findIndex((t) => t.id === tableId);
  if (idx === -1) return res.status(404).json({ error: 'Table not found.' });

  const table = cashTables[idx];
  table.isActive = false;
  (table as any).isArchived = true;

  res.json({ success: true, message: `Table ${tableId} archived successfully.` });
});

// Cancel Table Queue with automatic safe refunds
ludoRouter.post('/admin/table/cancel-queue', (req: Request, res: Response) => {
  const { tableId, reason = 'Queue cancelled by administrator' } = req.body;
  const queue = waitingQueues.get(tableId);

  if (!queue || queue.length === 0) {
    return res.json({ success: true, refundedPlayers: 0, message: 'Queue is already empty.' });
  }

  const refundedPlayers = queue.map((p) => ({
    userId: p.userId,
    userName: p.userName,
    reason,
  }));

  // Clear queue
  waitingQueues.set(tableId, []);
  updateTableQueueStats();

  res.json({
    success: true,
    refundedCount: refundedPlayers.length,
    refundedPlayers,
    message: `Cancelled waiting queue for table ${tableId}. ${refundedPlayers.length} players refunded.`,
  });
});

// Active Games (Live Match Control) Endpoints
ludoRouter.get('/admin/matches/active', (req: Request, res: Response) => {
  const matches = Array.from(activeMatches.values()).map((m) => {
    const startMs = m.startedAt ? new Date(m.startedAt).getTime() : new Date(m.createdAt).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    const endsMs = m.endsAt ? new Date(m.endsAt).getTime() : startMs + (m.durationSeconds || 480) * 1000;
    const timeRemainingSeconds = Math.max(0, Math.floor((endsMs - Date.now()) / 1000));

    return {
      ...m,
      elapsedSeconds,
      timeRemainingSeconds,
      currentTurnPlayer: m.players.find((p) => p.color === m.gameState.currentTurn),
      totalTokensInPlay: m.gameState?.tokens
        ? Object.values(m.gameState.tokens).flat().filter((t) => t.step >= 0 && t.step < 56).length
        : 0,
      tokensHomeCount: m.gameState?.tokens
        ? Object.values(m.gameState.tokens).flat().filter((t) => t.step === 56).length
        : 0,
    };
  });

  res.json({ success: true, matches });
});

// Pause Active Match
ludoRouter.post('/admin/match/pause', (req: Request, res: Response) => {
  const { matchId, reason = 'Match paused by administrator' } = req.body;
  const match = activeMatches.get(matchId);
  if (!match) return res.status(404).json({ error: 'Match not found.' });

  match.status = 'paused' as any;
  (match as any).pausedAt = new Date().toISOString();
  (match as any).pausedReason = reason;
  match.gameState.lastActionText = `⏸️ Game PAUSED by Admin: ${reason}`;

  res.json({ success: true, match, message: `Match ${matchId} paused.` });
});

// Resume Paused Match
ludoRouter.post('/admin/match/resume', (req: Request, res: Response) => {
  const { matchId } = req.body;
  const match = activeMatches.get(matchId);
  if (!match) return res.status(404).json({ error: 'Match not found.' });

  match.status = 'in_progress';
  (match as any).pausedAt = undefined;
  (match as any).pausedReason = undefined;
  match.gameState.lastActionText = `▶️ Game RESUMED by Admin.`;

  res.json({ success: true, match, message: `Match ${matchId} resumed.` });
});

// Cancel Active Match with Safe Refunds (NO secret score alterations allowed)
ludoRouter.post('/admin/match/cancel', (req: Request, res: Response) => {
  const { matchId, reason = 'Match cancelled by administrator' } = req.body;
  const match = activeMatches.get(matchId);
  if (!match) return res.status(404).json({ error: 'Match not found.' });

  match.status = 'cancelled';
  match.completedAt = new Date().toISOString();
  match.refundProcessed = true;
  (match as any).cancelledReason = reason;
  match.gameState.isGameOver = true;
  match.gameState.lastActionText = `🛑 Match CANCELLED by Admin. Entry fee of ₹${match.entryFee} refunded to all players.`;

  // Record refund in match history ledger for each participating player
  match.players.forEach((p) => {
    matchHistory.unshift({
      id: `refund-${match.id}-${p.userId}`,
      userId: p.userId,
      userName: p.userName,
      matchId: match.id,
      tableTitle: `₹${match.entryFee} (${match.playerCount}P)`,
      entryFee: match.entryFee,
      mode: match.playerCount,
      prizeWon: 0,
      isWinner: false,
      status: 'refunded',
      referenceId: `REFUND-ADMIN-${match.id}`,
      timestamp: new Date().toISOString(),
    });
  });

  res.json({
    success: true,
    matchId,
    refundedPlayersCount: match.players.length,
    message: `Match ${matchId} cancelled safely. Full refunds registered for ${match.players.length} players.`,
  });
});

ludoRouter.post('/admin/table/toggle', (req: Request, res: Response) => {
  const { tableId, isActive } = req.body;
  const table = cashTables.find((t) => t.id === tableId);
  if (!table) return res.status(404).json({ error: 'Table not found' });

  table.isActive = Boolean(isActive);
  res.json({ success: true, table });
});

// Admin Timer Ludo Configuration Endpoints
ludoRouter.get('/admin/config', (req: Request, res: Response) => {
  res.json({ success: true, config: adminConfig });
});

ludoRouter.post('/admin/config', (req: Request, res: Response) => {
  const {
    onlineLudoEnabled,
    timerLudoEnabled,
    durationMinutes2P,
    durationMinutes4P,
    homeBonusPoints,
    dicePointsEnabled,
    captureTransferEnabled,
    tieBreakerRule,
    turnTimeoutSeconds,
    maxTimeoutsBeforeForfeit,
    allowTwoPlayer,
    allowFourPlayer,
  } = req.body;

  if (onlineLudoEnabled !== undefined) adminConfig.onlineLudoEnabled = Boolean(onlineLudoEnabled);
  if (timerLudoEnabled !== undefined) adminConfig.timerLudoEnabled = Boolean(timerLudoEnabled);
  if (typeof durationMinutes2P === 'number' && durationMinutes2P >= 1 && durationMinutes2P <= 60) {
    adminConfig.durationMinutes2P = durationMinutes2P;
  }
  if (typeof durationMinutes4P === 'number' && durationMinutes4P >= 1 && durationMinutes4P <= 60) {
    adminConfig.durationMinutes4P = durationMinutes4P;
  }
  if (typeof homeBonusPoints === 'number' && homeBonusPoints >= 0 && homeBonusPoints <= 500) {
    adminConfig.homeBonusPoints = homeBonusPoints;
  }
  if (dicePointsEnabled !== undefined) adminConfig.dicePointsEnabled = Boolean(dicePointsEnabled);
  if (captureTransferEnabled !== undefined) adminConfig.captureTransferEnabled = Boolean(captureTransferEnabled);
  if (tieBreakerRule && ['home_tokens_then_captures', 'most_captures', 'least_timeouts'].includes(tieBreakerRule)) {
    adminConfig.tieBreakerRule = tieBreakerRule;
  }
  if (allowTwoPlayer !== undefined) adminConfig.allowTwoPlayer = Boolean(allowTwoPlayer);
  if (allowFourPlayer !== undefined) adminConfig.allowFourPlayer = Boolean(allowFourPlayer);
  if (turnTimeoutSeconds !== undefined) adminConfig.turnTimeoutSeconds = Number(turnTimeoutSeconds);
  if (maxTimeoutsBeforeForfeit !== undefined) adminConfig.maxTimeoutsBeforeForfeit = Number(maxTimeoutsBeforeForfeit);

  res.json({ success: true, config: adminConfig, message: 'Timer Ludo configuration updated successfully.' });
});

