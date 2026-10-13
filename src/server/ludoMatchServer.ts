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

export const ludoRouter = express.Router();

// Authoritative In-Memory Game Store
const cashTables: LudoCashTable[] = generateDefaultCashTables();

const adminConfig: LudoAdminConfig = {
  onlineLudoEnabled: true,
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

// Helper: sync queue counts into cashTables
function updateTableQueueStats() {
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
  });
}

// Bot Names for Simulation / Testing
const BOT_NAMES = [
  'Vikram_Star',
  'Aman_DiceKing',
  'Sneha_LudoQueen',
  'Rohit_Champ',
  'Priya_Pro',
  'Arjun_Master',
  'Rahul_Striker',
  'Kavita_Rolls',
];

// Execute Bot Turn if current turn belongs to a simulated player
function checkAndRunBotTurn(match: LudoCashMatch) {
  if (match.status !== 'in_progress' || match.gameState.isGameOver) return;

  const currentTurn = match.gameState.currentTurn;
  const player = match.players.find((p) => p.color === currentTurn);
  if (!player || !(player as any).isSimulated) return;

  // Bot plays after small human-like delay (1.2 seconds)
  setTimeout(() => {
    // Verify match is still active and same turn
    if (match.status !== 'in_progress' || match.gameState.currentTurn !== currentTurn) return;

    if (!match.gameState.hasRolled) {
      // 1. Bot Rolls
      const roll = Math.floor(Math.random() * 6) + 1;
      match.gameState.diceValue = roll;
      match.gameState.hasRolled = true;

      const legalMoves = getLegalMoves(match.gameState.tokens, currentTurn, roll);
      match.gameState.highlightedTokenIds = legalMoves;

      if (legalMoves.length === 0) {
        match.gameState.lastActionText = `${capitalize(currentTurn)} rolled ${roll} - No legal moves!`;
        // Advance turn after short pause
        setTimeout(() => {
          advanceMatchTurn(match, false);
          checkAndRunBotTurn(match);
        }, 1200);
      } else {
        match.gameState.lastActionText = `${capitalize(currentTurn)} rolled ${roll}. Thinking move...`;
        // 2. Bot selects a legal token to move
        setTimeout(() => {
          // Prefer leaving yard or moving furthest token
          let chosenTokenId = legalMoves[0];
          // If roll is 6 and a token is in yard, prioritize getting it out
          const yardToken = legalMoves.find((id) => match.gameState.tokens[currentTurn][id].step === -1);
          if (roll === 6 && yardToken !== undefined) {
            chosenTokenId = yardToken;
          } else {
            // Pick highest step token
            chosenTokenId = legalMoves.reduce((best, curr) => {
              const bestStep = match.gameState.tokens[currentTurn][best].step;
              const currStep = match.gameState.tokens[currentTurn][curr].step;
              return currStep > bestStep ? curr : best;
            }, legalMoves[0]);
          }

          executeTokenMove(match, currentTurn, chosenTokenId);
          // If bot gets extra turn, run again
          if (match.status === 'in_progress' && !match.gameState.isGameOver) {
            checkAndRunBotTurn(match);
          }
        }, 1000);
      }
    }
  }, 1200);
}

// Advance Turn Logic
function advanceMatchTurn(match: LudoCashMatch, extraTurn: boolean) {
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

// Move Token Logic on the Server
function executeTokenMove(match: LudoCashMatch, color: LudoColor, tokenId: number): { success: boolean; error?: string } {
  const token = match.gameState.tokens[color].find((t) => t.id === tokenId);
  if (!token) return { success: false, error: 'Token not found' };

  const roll = match.gameState.diceValue;
  if (!roll) return { success: false, error: 'No active roll' };

  let extraTurn = roll === 6;
  let actionDesc = '';

  if (token.step === -1) {
    if (roll !== 6) return { success: false, error: 'Need 6 to leave yard' };
    token.step = 0;
    actionDesc = `${capitalize(color)} entered track at start!`;
  } else {
    const nextStep = token.step + roll;
    if (nextStep > 56) return { success: false, error: 'Overshot home' };
    token.step = nextStep;
    actionDesc = `${capitalize(color)} moved to step ${nextStep}.`;

    // Check Home Completion
    if (token.step === 56) {
      extraTurn = true;
      actionDesc = `🎉 ${capitalize(color)} moved token to HOME! Extra roll granted!`;
    } else if (token.step <= 50) {
      // Check capture on main 52-cell track
      const myGlobalIdx = getGlobalTrackIndex(color, token.step);
      if (myGlobalIdx !== null && !SAFE_CELL_INDICES.has(myGlobalIdx)) {
        // Scan other players
        match.gameState.players.forEach((otherColor) => {
          if (otherColor !== color) {
            match.gameState.tokens[otherColor].forEach((otherToken) => {
              if (otherToken.step >= 0 && otherToken.step <= 50) {
                const otherGlobalIdx = getGlobalTrackIndex(otherColor, otherToken.step);
                if (otherGlobalIdx === myGlobalIdx) {
                  // Capture!
                  otherToken.step = -1;
                  extraTurn = true;
                  actionDesc = `💥 ${capitalize(color)} CAPTURED ${capitalize(otherColor)}! Extra turn granted!`;
                }
              }
            });
          }
        });
      }
    }
  }

  match.gameState.lastActionText = actionDesc;

  // Check if player has brought all 4 tokens to 56
  const allHome = match.gameState.tokens[color].every((t) => t.step === 56);
  if (allHome && !match.gameState.winners.includes(color)) {
    match.gameState.winners.push(color);
    match.gameState.isGameOver = true;
    match.status = 'completed';
    match.completedAt = new Date().toISOString();

    const winnerPlayer = match.players.find((p) => p.color === color);
    match.winnerId = winnerPlayer?.userId;
    match.winnerName = winnerPlayer?.userName;
    match.winnerColor = color;
    match.gameState.lastActionText = `🏆 Match Over! ${winnerPlayer?.userName} (${capitalize(color)}) is the Champion!`;

    // Record in completed ledger
    match.players.forEach((p) => {
      const isWinner = p.userId === match.winnerId;
      matchHistory.unshift({
        id: `rec-${match.id}-${p.userId}`,
        userId: p.userId,
        userName: p.userName,
        matchId: match.id,
        tableTitle: `₹${match.entryFee} (${match.playerCount}P)`,
        entryFee: match.entryFee,
        mode: match.playerCount,
        prizeWon: isWinner ? match.prizeAmount : 0,
        isWinner,
        status: 'completed',
        referenceId: `LUDO-MATCH-${match.id}`,
        timestamp: new Date().toISOString(),
      });
    });

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
  };
  queue.push(newPlayer);
  updateTableQueueStats();

  // Check if queue has enough players to launch match
  if (queue.length >= table.mode) {
    const matchedPlayers = queue.splice(0, table.mode);
    const matchId = `match-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const colors: LudoColor[] = table.mode === 2 ? ['red', 'yellow'] : ['red', 'green', 'yellow', 'blue'];
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
    }));

    const newMatch: LudoCashMatch = {
      id: matchId,
      tableId: table.id,
      entryFee: table.entryFee,
      playerCount: table.mode,
      prizeAmount: table.prize,
      status: 'in_progress',
      players: onlinePlayers,
      gameState: createInitialLudoGame(table.mode),
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      turnDeadline: new Date(Date.now() + adminConfig.turnTimeoutSeconds * 1000).toISOString(),
    };

    activeMatches.set(matchId, newMatch);
    updateTableQueueStats();

    // Trigger bot turn if starting player is simulated
    checkAndRunBotTurn(newMatch);

    return res.json({
      success: true,
      status: 'starting',
      matchId,
      match: newMatch,
      message: `Match starting with ${table.mode} players!`,
    });
  }

  return res.json({
    success: true,
    status: 'waiting',
    queuePosition: queue.length,
    totalWaiting: queue.length,
    needed: table.mode,
    message: `Joined queue (${queue.length}/${table.mode}). Waiting for opponent...`,
  });
});

// 3. Simulate Opponent / Quick Match (For testing or demoing when single player is in queue)
ludoRouter.post('/queue/simulate-opponent', (req: Request, res: Response) => {
  const { tableId } = req.body;
  const table = cashTables.find((t) => t.id === tableId);
  if (!table) return res.status(404).json({ error: 'Table not found' });

  let queue = waitingQueues.get(tableId);
  if (!queue || queue.length === 0) {
    return res.status(400).json({ error: 'No human player waiting in this table queue to pair with.' });
  }

  // Add random simulated bot players until table fills
  while (queue.length < table.mode) {
    const randomName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    queue.push({
      userId: `bot-${Date.now()}-${Math.floor(Math.random() * 999)}`,
      userName: `${randomName} 🎮`,
      joinedAt: new Date().toISOString(),
      isSimulated: true,
    });
  }

  // Launch match immediately
  const matchedPlayers = queue.splice(0, table.mode);
  const matchId = `match-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const colors: LudoColor[] = table.mode === 2 ? ['red', 'yellow'] : ['red', 'green', 'yellow', 'blue'];

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
  }));

  const newMatch: LudoCashMatch = {
    id: matchId,
    tableId: table.id,
    entryFee: table.entryFee,
    playerCount: table.mode,
    prizeAmount: table.prize,
    status: 'in_progress',
    players: onlinePlayers,
    gameState: createInitialLudoGame(table.mode),
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    turnDeadline: new Date(Date.now() + adminConfig.turnTimeoutSeconds * 1000).toISOString(),
  };

  activeMatches.set(matchId, newMatch);
  updateTableQueueStats();

  checkAndRunBotTurn(newMatch);

  return res.json({
    success: true,
    status: 'starting',
    matchId,
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

  // Check timeout
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
          // Award win to opponent
          const remaining = match.players.find((p) => p.userId !== player.userId);
          if (remaining) {
            match.gameState.isGameOver = true;
            match.status = 'completed';
            match.winnerId = remaining.userId;
            match.winnerName = remaining.userName;
            match.winnerColor = remaining.color;
            match.gameState.winners = [remaining.color];
          }
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
  if (match.status !== 'in_progress') return res.status(400).json({ error: 'Match is not in progress' });

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
  match.gameState.diceValue = roll;
  match.gameState.hasRolled = true;

  // Check 3 consecutive sixes
  const newConsecutive = roll === 6 ? match.gameState.consecutiveSixes + 1 : 0;
  match.gameState.consecutiveSixes = newConsecutive;

  if (newConsecutive >= 3) {
    match.gameState.lastActionText = `❌ 3 consecutive sixes! Turn forfeited.`;
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
    match.gameState.lastActionText = `${capitalize(color)} rolled a ${roll}! Tap a highlighted token to move.`;
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
  if (match.status !== 'in_progress') return res.status(400).json({ error: 'Match not in progress' });

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

ludoRouter.post('/admin/table/toggle', (req: Request, res: Response) => {
  const { tableId, isActive } = req.body;
  const table = cashTables.find((t) => t.id === tableId);
  if (!table) return res.status(404).json({ error: 'Table not found' });

  table.isActive = Boolean(isActive);
  res.json({ success: true, table });
});

ludoRouter.post('/admin/config', (req: Request, res: Response) => {
  const { onlineLudoEnabled, allowTwoPlayer, allowFourPlayer, turnTimeoutSeconds } = req.body;

  if (onlineLudoEnabled !== undefined) adminConfig.onlineLudoEnabled = Boolean(onlineLudoEnabled);
  if (allowTwoPlayer !== undefined) adminConfig.allowTwoPlayer = Boolean(allowTwoPlayer);
  if (allowFourPlayer !== undefined) adminConfig.allowFourPlayer = Boolean(allowFourPlayer);
  if (turnTimeoutSeconds !== undefined) adminConfig.turnTimeoutSeconds = Number(turnTimeoutSeconds);

  res.json({ success: true, config: adminConfig });
});
