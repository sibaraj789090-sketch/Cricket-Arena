/**
 * Ludo Virtual Bots & QA Simulation Router
 * TEMPORARY PRE-LAUNCH SYSTEM - MOUNTED UNDER /api/admin/bots
 *
 * All endpoints require Administrator authorization (requireAdminRole).
 * Enforces server-side feature flag (LUDO_BOTS_ENABLED).
 */

import express, { Request, Response, NextFunction } from 'express';
import {
  LUDO_BOTS_ENABLED,
  botPoolConfig,
  setLudoBotsEnabled,
  getBotPoolStats,
  queryBots,
  getBotById,
  updateBot,
  initializeBotPool,
  createSimulationMatch,
  stopSimulationMatch,
  resetAllSimulationMatches,
  getActiveSimulationMatches,
  getBotMatchLogs,
  clearBotLogs,
  addBotLog,
} from './ludoBotEngine';
import { BotStrategy, SimulationOutcome } from '../types/ludoBot';

import { requireAdminRole } from './adminAuthServer';

export const ludoBotRouter = express.Router();

// Strict Admin Authorization Middleware for Bot Management
const verifyAdminRole = requireAdminRole;
ludoBotRouter.use(requireAdminRole);

// 1. Get Global Bot Pool Config & Summary Statistics
ludoBotRouter.get('/config', verifyAdminRole, (req: Request, res: Response) => {
  res.json({
    success: true,
    config: botPoolConfig,
    stats: getBotPoolStats(),
  });
});

// 2. Toggle Bot System On/Off (Global LUDO_BOTS_ENABLED)
ludoBotRouter.post('/toggle', verifyAdminRole, (req: Request, res: Response) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'Field "enabled" must be a boolean.' });
  }

  setLudoBotsEnabled(enabled);
  res.json({
    success: true,
    enabled: LUDO_BOTS_ENABLED,
    config: botPoolConfig,
    stats: getBotPoolStats(),
    message: `Ludo bots have been ${enabled ? 'ENABLED' : 'DISABLED'} successfully.`,
  });
});

// 3. Configure Bot Pool (Pool Size, Default Strategy)
ludoBotRouter.post('/configure', verifyAdminRole, (req: Request, res: Response) => {
  const { poolSize, defaultStrategy, simulationNoticeText, reseed, autoMatchStealthBots, autoMatchWaitSeconds } = req.body;

  if (defaultStrategy && ['beginner', 'random_legal', 'stronger_legal'].includes(defaultStrategy)) {
    botPoolConfig.defaultStrategy = defaultStrategy as BotStrategy;
  }

  if (simulationNoticeText && typeof simulationNoticeText === 'string') {
    botPoolConfig.simulationNoticeText = simulationNoticeText.trim();
  }

  if (typeof autoMatchStealthBots === 'boolean') {
    botPoolConfig.autoMatchStealthBots = autoMatchStealthBots;
  }

  if (typeof autoMatchWaitSeconds === 'number' && autoMatchWaitSeconds >= 1 && autoMatchWaitSeconds <= 30) {
    botPoolConfig.autoMatchWaitSeconds = autoMatchWaitSeconds;
  }

  if (poolSize && typeof poolSize === 'number' && poolSize >= 1000 && poolSize <= 20000) {
    botPoolConfig.poolSize = poolSize;
  }

  if (reseed === true || (poolSize && poolSize !== botPoolConfig.totalGeneratedBots)) {
    initializeBotPool(botPoolConfig.poolSize);
  }

  botPoolConfig.updatedAt = new Date().toISOString();

  res.json({
    success: true,
    config: botPoolConfig,
    stats: getBotPoolStats(),
    message: 'Bot pool configuration updated successfully.',
  });
});

// 4. Query & Paginate 5,000+ Bots (Fast search, filter by status / strategy / table)
ludoBotRouter.get('/list', verifyAdminRole, (req: Request, res: Response) => {
  const { search, status, strategy, tableId, page, limit } = req.query;

  const result = queryBots({
    search: search ? String(search) : undefined,
    status: status ? String(status) : undefined,
    strategy: strategy ? String(strategy) : undefined,
    tableId: tableId ? String(tableId) : undefined,
    page: page ? parseInt(String(page), 10) : 1,
    limit: limit ? Math.min(parseInt(String(limit), 10), 200) : 50,
  });

  res.json({
    success: true,
    ...result,
  });
});

// 5. Get Bot by ID
ludoBotRouter.get('/bot/:id', verifyAdminRole, (req: Request, res: Response) => {
  const bot = getBotById(req.params.id);
  if (!bot) {
    return res.status(404).json({ error: `Bot ${req.params.id} not found.` });
  }
  res.json({ success: true, bot });
});

// 6. Update Individual Bot Strategy or Status
ludoBotRouter.patch('/bot/:id', verifyAdminRole, (req: Request, res: Response) => {
  const { strategy, status } = req.body;
  const updates: any = {};
  if (strategy && ['beginner', 'random_legal', 'stronger_legal'].includes(strategy)) {
    updates.strategy = strategy;
  }
  if (status && ['idle', 'paused'].includes(status)) {
    updates.status = status;
  }

  const updated = updateBot(req.params.id, updates);
  if (!updated) {
    return res.status(404).json({ error: `Bot ${req.params.id} not found.` });
  }

  res.json({ success: true, bot: updated });
});

// 7. Start Bot Test Match (Bot vs Bot or Admin Sandbox)
ludoBotRouter.post('/start-match', verifyAdminRole, (req: Request, res: Response) => {
  if (!LUDO_BOTS_ENABLED) {
    return res.status(403).json({
      error: 'Cannot start match: Bot system is globally disabled (LUDO_BOTS_ENABLED = false).',
    });
  }

  const { mode = 2, tableId = 'table-test-sandbox', strategy = 'stronger_legal' } = req.body;
  const numMode = mode === 4 ? 4 : 2;

  const simResult = createSimulationMatch({
    tableId,
    mode: numMode,
    strategy,
    simulatedOutcome: 'random',
    botCount: numMode,
  });

  if (!simResult.success) {
    return res.status(400).json({ error: simResult.error });
  }

  res.json({
    success: true,
    match: simResult.match,
    message: `Test bot match started with ${numMode} bots. Mode: ${numMode}P.`,
  });
});

// 8. Stop / Abort Match Safely
ludoBotRouter.post('/stop-match', verifyAdminRole, (req: Request, res: Response) => {
  const { matchId, reason } = req.body;
  if (!matchId) {
    return res.status(400).json({ error: 'matchId is required.' });
  }

  const stopped = stopSimulationMatch(matchId, reason || 'Stopped by administrator');
  if (!stopped) {
    return res.status(404).json({ error: `Simulation match ${matchId} not found or already ended.` });
  }

  res.json({
    success: true,
    matchId,
    message: 'Simulation match stopped safely. Bots returned to idle pool.',
  });
});

// 9. Reset All Matches Safely
ludoBotRouter.post('/reset-match', verifyAdminRole, (req: Request, res: Response) => {
  const { matchId } = req.body;
  if (matchId) {
    stopSimulationMatch(matchId, 'Single match reset');
    return res.json({ success: true, message: `Match ${matchId} reset successfully.` });
  }

  const clearedCount = resetAllSimulationMatches();
  res.json({
    success: true,
    clearedCount,
    message: `Reset complete. ${clearedCount} active simulation matches cleared. All bots restored to idle.`,
  });
});

// 10. QA MATCH OUTCOME SIMULATION
// Pre-select outcomes ('bot_wins', 'human_wins', 'random') for testing
ludoBotRouter.post('/simulation/start', verifyAdminRole, (req: Request, res: Response) => {
  if (!LUDO_BOTS_ENABLED) {
    return res.status(403).json({
      error: 'Cannot start simulation: LUDO_BOTS_ENABLED is false. Enable bots first.',
    });
  }

  const {
    tableId = 'test-table-qa',
    mode = 2,
    strategy = 'stronger_legal',
    simulatedOutcome = 'random',
    adminUserId,
    adminUserName,
  } = req.body;

  if (!['random', 'bot_wins', 'human_wins'].includes(simulatedOutcome)) {
    return res.status(400).json({
      error: 'Invalid simulatedOutcome. Must be "random", "bot_wins", or "human_wins".',
    });
  }

  const numMode = mode === 4 ? 4 : 2;
  const botCount = adminUserId ? numMode - 1 : numMode;

  const simResult = createSimulationMatch({
    tableId,
    mode: numMode,
    strategy,
    simulatedOutcome: simulatedOutcome as SimulationOutcome,
    botCount,
    adminUserId,
    adminUserName,
  });

  if (!simResult.success) {
    return res.status(400).json({ error: simResult.error });
  }

  res.json({
    success: true,
    match: simResult.match,
    simulatedOutcome,
    notice: 'SIMULATION — NOT A REAL MATCH (Test Tokens Only. Zero real cash.)',
  });
});

// 11. View Active Simulation Matches
ludoBotRouter.get('/simulation/active', verifyAdminRole, (req: Request, res: Response) => {
  res.json({
    success: true,
    matches: getActiveSimulationMatches(),
  });
});

// 12. View Bot Activity Logs & Game Results
ludoBotRouter.get('/logs', verifyAdminRole, (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
  res.json({
    success: true,
    logs: getBotMatchLogs(limit),
  });
});

// 13. Clear Logs
ludoBotRouter.delete('/logs', verifyAdminRole, (req: Request, res: Response) => {
  clearBotLogs();
  res.json({
    success: true,
    message: 'Bot match logs cleared successfully.',
  });
});
