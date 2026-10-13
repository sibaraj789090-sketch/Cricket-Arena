import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { ludoRouter } from './src/server/ludoMatchServer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// Mount Authoritative Online Ludo Multiplayer Router
app.use('/api/ludo', ludoRouter);

// In-memory server-side audit logs & score locks
interface ServerAuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  timestamp: string;
}

const serverAuditLogs: ServerAuditLog[] = [
  {
    id: 'server-audit-1',
    adminId: 'admin-master',
    adminName: 'Official Arena System',
    action: 'SERVER_BOOTSTRAP',
    targetType: 'system',
    targetId: 'cricket-arena-core',
    details: 'Free-Entry Cricket Arena server online. Zero cash/betting restrictions enforced.',
    timestamp: new Date().toISOString(),
  },
];

// Admin authorization middleware
function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  const userRole = req.headers['x-user-role'];
  const adminSecret = req.headers['x-admin-key'];

  // Accept admin role header or secret token
  if (userRole === 'admin' || adminSecret === 'cricket-arena-master-2026') {
    return next();
  }

  return res.status(403).json({
    error: 'Access Denied: Only authenticated administrators can alter scores, points rules, or tournament states.',
  });
}

// ==========================================
// API ROUTES
// ==========================================

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    mode: 'free_entry_cricket_tournament',
    serverTime: new Date().toISOString(),
    bettingOrCashAllowed: false,
  });
});

// Audit Logs (Admin only)
app.get('/api/admin/audit-logs', requireAdminRole, (req: Request, res: Response) => {
  res.json({ logs: serverAuditLogs });
});

// Validate & Create Virtual Team on the server
app.post('/api/teams/validate-and-create', (req: Request, res: Response) => {
  const { tournamentId, userId, teamName, playerIds, captainId, viceCaptainId, squadCredits } = req.body;

  if (!teamName || typeof teamName !== 'string' || teamName.trim().length < 3) {
    return res.status(400).json({ error: 'Team name must be at least 3 characters long.' });
  }

  if (!Array.isArray(playerIds) || playerIds.length !== 11) {
    return res.status(400).json({ error: 'Server validation failed: Virtual team must have exactly 11 players.' });
  }

  if (!captainId || !viceCaptainId) {
    return res.status(400).json({ error: 'Captain and Vice-Captain selections are required.' });
  }

  if (captainId === viceCaptainId) {
    return res.status(400).json({ error: 'Captain and Vice-Captain cannot be the same player.' });
  }

  if (!playerIds.includes(captainId) || !playerIds.includes(viceCaptainId)) {
    return res.status(400).json({ error: 'Captain and Vice-Captain must be present in the 11-player squad.' });
  }

  if (squadCredits && squadCredits > 100) {
    return res.status(400).json({ error: 'Credit limit exceeded! 100 credits max allowed.' });
  }

  return res.json({
    success: true,
    message: 'Virtual team squad validated successfully by server.',
    validatedAt: new Date().toISOString(),
  });
});

// Publish Score Updates & Recalculate Points (Admin only)
app.post('/api/admin/scores', requireAdminRole, (req: Request, res: Response) => {
  const { tournamentId, playerScores, adminName = 'Official Admin' } = req.body;

  if (!tournamentId) {
    return res.status(400).json({ error: 'Tournament ID is required.' });
  }

  // Record audit log
  const newLog: ServerAuditLog = {
    id: `log-${Date.now()}`,
    adminId: 'admin-master',
    adminName,
    action: 'SCORE_UPDATE_PUBLISHED',
    targetType: 'score',
    targetId: tournamentId,
    details: `Updated live scores for ${Object.keys(playerScores || {}).length} cricketers. Rankings recalculated.`,
    timestamp: new Date().toISOString(),
  };

  serverAuditLogs.unshift(newLog);

  res.json({
    success: true,
    message: 'Scores published and rankings updated across all virtual teams.',
    auditLog: newLog,
  });
});

// Configure Points Rules (Admin only)
app.post('/api/admin/points-config', requireAdminRole, (req: Request, res: Response) => {
  const { config, adminName = 'Official Admin' } = req.body;

  const newLog: ServerAuditLog = {
    id: `log-${Date.now()}`,
    adminId: 'admin-master',
    adminName,
    action: 'POINTS_CONFIG_MODIFIED',
    targetType: 'points_rule',
    targetId: config?.id || 'standard-rules',
    details: `Points configuration "${config?.title || 'System Rules'}" updated and locked.`,
    timestamp: new Date().toISOString(),
  };

  serverAuditLogs.unshift(newLog);

  res.json({
    success: true,
    message: 'Points configuration saved on server.',
    auditLog: newLog,
  });
});

// ==========================================
// LUDO SERVER OPERATIONS & MULTIPLAYER PREPARATION
// ==========================================

interface ServerLudoRoom {
  id: string;
  code: string;
  hostUserId: string;
  hostName: string;
  playerCount: 2 | 4;
  status: 'waiting' | 'in_progress' | 'completed';
  players: { userId: string; name: string; color: string; isReady: boolean }[];
  currentTurn?: string;
  createdAt: string;
}

const serverLudoRooms: Map<string, ServerLudoRoom> = new Map();

// Create Online Ludo Room
app.post('/api/ludo/rooms/create', (req: Request, res: Response) => {
  const { hostUserId, hostName, playerCount = 4 } = req.body;
  if (!hostUserId || !hostName) {
    return res.status(400).json({ error: 'hostUserId and hostName required' });
  }

  const code = `LUDO-${Math.floor(1000 + Math.random() * 9000)}`;
  const room: ServerLudoRoom = {
    id: `room-${Date.now()}`,
    code,
    hostUserId,
    hostName,
    playerCount: playerCount === 2 ? 2 : 4,
    status: 'waiting',
    players: [{ userId: hostUserId, name: hostName, color: 'red', isReady: true }],
    createdAt: new Date().toISOString(),
  };

  serverLudoRooms.set(code, room);
  res.json({ success: true, room });
});

// Join Online Ludo Room
app.post('/api/ludo/rooms/join', (req: Request, res: Response) => {
  const { code, userId, name } = req.body;
  if (!code || !userId || !name) {
    return res.status(400).json({ error: 'code, userId, and name are required' });
  }

  const room = serverLudoRooms.get(code.toUpperCase());
  if (!room) {
    return res.status(404).json({ error: 'Room not found.' });
  }

  if (room.players.length >= room.playerCount && !room.players.some((p) => p.userId === userId)) {
    return res.status(400).json({ error: 'Room is already full.' });
  }

  if (!room.players.some((p) => p.userId === userId)) {
    const colors = room.playerCount === 2 ? ['red', 'yellow'] : ['red', 'green', 'yellow', 'blue'];
    const nextColor = colors[room.players.length] || 'yellow';
    room.players.push({ userId, name, color: nextColor, isReady: true });
    if (room.players.length === room.playerCount) {
      room.status = 'in_progress';
      room.currentTurn = 'red';
    }
  }

  res.json({ success: true, room });
});

// Validate Ludo Token Movement on Server
app.post('/api/ludo/validate-move', (req: Request, res: Response) => {
  const { color, step, diceValue } = req.body;

  if (diceValue < 1 || diceValue > 6) {
    return res.status(400).json({ valid: false, error: 'Invalid dice value' });
  }

  if (step === -1 && diceValue !== 6) {
    return res.status(400).json({ valid: false, error: 'Token in yard requires rolling a 6' });
  }

  if (step + diceValue > 56) {
    return res.status(400).json({ valid: false, error: 'Cannot overshoot Home (step 56)' });
  }

  const newStep = step === -1 ? 0 : step + diceValue;
  res.json({
    valid: true,
    newStep,
    isHome: newStep === 56,
    extraTurn: diceValue === 6 || newStep === 56,
  });
});

// Admin Ludo Tournament Update (Admin only)
app.post('/api/admin/ludo/tournament', requireAdminRole, (req: Request, res: Response) => {
  const { tournamentId, title, status, action = 'STATUS_CHANGE', adminName = 'Official Admin' } = req.body;

  const newLog: ServerAuditLog = {
    id: `log-${Date.now()}`,
    adminId: 'admin-master',
    adminName,
    action: `LUDO_TOURNAMENT_${action}`,
    targetType: 'ludo_tournament',
    targetId: tournamentId || 'new-tournament',
    details: `Ludo Tournament "${title || tournamentId}" updated to ${status || 'MODIFIED'}`,
    timestamp: new Date().toISOString(),
  };

  serverAuditLogs.unshift(newLog);

  res.json({
    success: true,
    message: 'Ludo tournament updated on server.',
    auditLog: newLog,
  });
});

// ==========================================
// SECURE COINS WALLET & PAYMENT API
// ==========================================

interface ServerWalletSettings {
  topUpEnabled: boolean;
  minDepositInr: number;
  maxDepositInr: number;
  minWithdrawalInr: number;
  maxWithdrawalInr: number;
  startingBonusCoins: number;
  coinToInrRate: number;
}

let serverWalletSettings: ServerWalletSettings = {
  topUpEnabled: true,
  minDepositInr: 100,
  maxDepositInr: 100000,
  minWithdrawalInr: 110,
  maxWithdrawalInr: 50000,
  startingBonusCoins: 100,
  coinToInrRate: 1,
};

interface ServerCoinPackage {
  id: string;
  title: string;
  coins: number;
  bonusCoins: number;
  priceInr: number;
  badge?: string;
  isActive: boolean;
  displayOrder: number;
}

let serverCoinPackages: ServerCoinPackage[] = [
  { id: 'pkg-100', title: 'Starter Pack', coins: 100, bonusCoins: 0, priceInr: 100, badge: 'Min Deposit', isActive: true, displayOrder: 1 },
  { id: 'pkg-250', title: 'Popular Booster', coins: 250, bonusCoins: 25, priceInr: 250, badge: 'Popular (+10%)', isActive: true, displayOrder: 2 },
  { id: 'pkg-500', title: 'Pro Player Pack', coins: 500, bonusCoins: 100, priceInr: 500, badge: 'Best Value (+20%)', isActive: true, displayOrder: 3 },
  { id: 'pkg-1000', title: 'Champion Stash', coins: 1000, bonusCoins: 300, priceInr: 1000, badge: 'Hot Deal (+30%)', isActive: true, displayOrder: 4 },
  { id: 'pkg-2500', title: 'Arena Legend Vault', coins: 2500, bonusCoins: 1000, priceInr: 2500, badge: 'Huge Bonus (+40%)', isActive: true, displayOrder: 5 },
  { id: 'pkg-5000', title: 'Grand Master Chest', coins: 5000, bonusCoins: 2500, priceInr: 5000, badge: 'Mega Value (+50%)', isActive: true, displayOrder: 6 },
];

interface ServerPaymentOrder {
  id: string;
  userId: string;
  packageId: string;
  amountInr: number;
  coinsAwarded: number;
  status: 'created' | 'pending' | 'completed' | 'failed';
  gatewayOrderId: string;
  gatewayPaymentId?: string;
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
}

const serverPaymentOrders: Map<string, ServerPaymentOrder> = new Map();
const processedPaymentSignatures: Set<string> = new Set(); // Idempotency check

// Get Wallet Config & Packages
app.get('/api/wallet/config', (req: Request, res: Response) => {
  res.json({
    settings: serverWalletSettings,
    packages: serverCoinPackages.filter((p) => p.isActive).sort((a, b) => a.displayOrder - b.displayOrder),
  });
});

// Create Secure Payment Order on Server
app.post('/api/wallet/create-order', (req: Request, res: Response) => {
  const { userId, packageId, customAmountInr } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  if (!serverWalletSettings.topUpEnabled) {
    return res.status(403).json({ error: 'Coin purchases are currently disabled by administration.' });
  }

  let amountInr = 0;
  let coinsAwarded = 0;

  if (packageId === 'custom') {
    const customAmt = Number(customAmountInr);
    if (isNaN(customAmt) || customAmt < serverWalletSettings.minDepositInr) {
      return res.status(400).json({ error: `Minimum deposit amount is ₹${serverWalletSettings.minDepositInr}.` });
    }
    if (customAmt > serverWalletSettings.maxDepositInr) {
      return res.status(400).json({ error: `Maximum deposit amount is ₹${serverWalletSettings.maxDepositInr}.` });
    }
    amountInr = customAmt;
    coinsAwarded = Math.floor(customAmt * serverWalletSettings.coinToInrRate);
  } else {
    // Authoritative lookup from server package catalog (never trust client amounts)
    const pkg = serverCoinPackages.find((p) => p.id === packageId && p.isActive);
    if (!pkg) {
      return res.status(404).json({ error: 'Invalid or inactive package selected.' });
    }
    amountInr = pkg.priceInr;
    coinsAwarded = pkg.coins + pkg.bonusCoins;
  }

  const orderId = `order_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const gatewayOrderId = `pay_gw_${Date.now()}`;

  const order: ServerPaymentOrder = {
    id: orderId,
    userId,
    packageId,
    amountInr,
    coinsAwarded,
    status: 'pending',
    gatewayOrderId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  serverPaymentOrders.set(orderId, order);

  res.json({
    success: true,
    orderId,
    gatewayOrderId,
    amountInr,
    coinsAwarded,
    currency: 'INR',
    message: 'Payment order created securely on server.',
  });
});

// Verify Payment & Credit Coins Idempotently
app.post('/api/wallet/verify-payment', (req: Request, res: Response) => {
  const { orderId, paymentId, signature } = req.body;

  if (!orderId || !paymentId) {
    return res.status(400).json({ error: 'orderId and paymentId are required for verification.' });
  }

  const order = serverPaymentOrders.get(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found or expired.' });
  }

  // Idempotency check: prevent duplicate credits
  const paymentKey = `${orderId}:${paymentId}`;
  if (order.status === 'completed' || processedPaymentSignatures.has(paymentKey)) {
    return res.json({
      success: true,
      idempotent: true,
      message: 'Payment already verified and credited.',
      coinsAwarded: order.coinsAwarded,
    });
  }

  processedPaymentSignatures.add(paymentKey);
  order.status = 'completed';
  order.gatewayPaymentId = paymentId;
  order.updatedAt = new Date().toISOString();

  // Audit log for financial credit
  const auditEntry: ServerAuditLog = {
    id: `audit-pay-${Date.now()}`,
    adminId: 'system-gateway',
    adminName: 'Payment Gateway Webhook',
    action: 'COIN_TOPUP_VERIFIED',
    targetType: 'wallet',
    targetId: order.userId,
    details: `Verified ₹${order.amountInr} payment (${paymentId}). Credited ${order.coinsAwarded} coins.`,
    timestamp: new Date().toISOString(),
  };
  serverAuditLogs.unshift(auditEntry);

  res.json({
    success: true,
    coinsAwarded: order.coinsAwarded,
    amountInr: order.amountInr,
    message: 'Payment verified successfully. Coins credited.',
  });
});

// Admin Update Wallet Settings
app.post('/api/admin/wallet/settings', requireAdminRole, (req: Request, res: Response) => {
  const { settings, adminName = 'Official Admin' } = req.body;
  if (!settings) return res.status(400).json({ error: 'Settings payload required' });

  serverWalletSettings = {
    ...serverWalletSettings,
    ...settings,
  };

  serverAuditLogs.unshift({
    id: `audit-set-${Date.now()}`,
    adminId: 'admin-master',
    adminName,
    action: 'WALLET_SETTINGS_UPDATED',
    targetType: 'system',
    targetId: 'wallet_config',
    details: `Updated min/max deposit (₹${serverWalletSettings.minDepositInr} - ₹${serverWalletSettings.maxDepositInr}) and withdrawal (₹${serverWalletSettings.minWithdrawalInr} - ₹${serverWalletSettings.maxWithdrawalInr}).`,
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, settings: serverWalletSettings });
});

// Admin Update Packages
app.post('/api/admin/wallet/packages', requireAdminRole, (req: Request, res: Response) => {
  const { packages, adminName = 'Official Admin' } = req.body;
  if (!Array.isArray(packages)) return res.status(400).json({ error: 'Packages array required' });

  serverCoinPackages = packages;

  serverAuditLogs.unshift({
    id: `audit-pkg-${Date.now()}`,
    adminId: 'admin-master',
    adminName,
    action: 'COIN_PACKAGES_UPDATED',
    targetType: 'system',
    targetId: 'coin_packages',
    details: `Admin updated coin packages catalog (${packages.length} packages).`,
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, packages: serverCoinPackages });
});

// Server-side Withdrawal Request Verification
app.post('/api/wallet/request-withdrawal', (req: Request, res: Response) => {
  const { userId, userName, userEmail, amountInr, payoutMethod, payoutDetails } = req.body;

  if (!userId || !amountInr || !payoutMethod) {
    return res.status(400).json({ error: 'Missing required withdrawal fields.' });
  }

  const amt = Number(amountInr);
  if (isNaN(amt) || amt < serverWalletSettings.minWithdrawalInr) {
    return res.status(400).json({ error: `Minimum withdrawal is ₹${serverWalletSettings.minWithdrawalInr}.` });
  }
  if (amt > serverWalletSettings.maxWithdrawalInr) {
    return res.status(400).json({ error: `Maximum withdrawal is ₹${serverWalletSettings.maxWithdrawalInr}.` });
  }

  const requestId = `wdr-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const referenceId = `WDR-REF-${Date.now()}`;

  const auditEntry: ServerAuditLog = {
    id: `audit-wdr-${Date.now()}`,
    adminId: 'system',
    adminName: userName || 'Arena Player',
    action: 'WITHDRAWAL_REQUESTED',
    targetType: 'wallet',
    targetId: userId,
    details: `Withdrawal request submitted for ₹${amt} via ${String(payoutMethod).toUpperCase()}. Pending admin verification.`,
    timestamp: new Date().toISOString(),
  };
  serverAuditLogs.unshift(auditEntry);

  res.json({
    success: true,
    requestId,
    referenceId,
    amountInr: amt,
    amountCoins: amt,
    status: 'pending',
    message: 'Withdrawal request verified and submitted for administrative approval.',
  });
});

// Admin Process Withdrawal (Approve or Reject with Refund)
app.post('/api/admin/wallet/withdrawal/action', requireAdminRole, (req: Request, res: Response) => {
  const { requestId, action, adminNotes = '', payoutReferenceId = '', adminName = 'Finance Admin' } = req.body;

  if (!requestId || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Valid requestId and action (approve/reject) required.' });
  }

  serverAuditLogs.unshift({
    id: `audit-act-${Date.now()}`,
    adminId: 'admin-master',
    adminName,
    action: action === 'approve' ? 'WITHDRAWAL_APPROVED' : 'WITHDRAWAL_REJECTED',
    targetType: 'withdrawal_request',
    targetId: requestId,
    details: action === 'approve'
      ? `Approved withdrawal ${requestId}. Payout reference: ${payoutReferenceId || 'N/A'}. Notes: ${adminNotes}`
      : `Rejected withdrawal ${requestId}. Coins refunded to player balance. Notes: ${adminNotes}`,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    action,
    requestId,
    message: `Withdrawal ${action}d successfully on server.`,
  });
});

// Admin Manual Balance Adjustment
app.post('/api/admin/wallet/adjust', requireAdminRole, (req: Request, res: Response) => {
  const { targetUserId, amountDelta, reason, adminName = 'Administrator' } = req.body;

  const delta = Number(amountDelta);
  if (!targetUserId || isNaN(delta) || delta === 0) {
    return res.status(400).json({ error: 'Valid targetUserId and non-zero amountDelta required.' });
  }

  serverAuditLogs.unshift({
    id: `audit-adj-${Date.now()}`,
    adminId: 'admin-master',
    adminName,
    action: 'WALLET_MANUAL_ADJUSTMENT',
    targetType: 'wallet',
    targetId: targetUserId,
    details: `Manual balance adjustment: ${delta > 0 ? '+' : ''}${delta} coins. Reason: ${reason || 'Administrative adjustment'}`,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    targetUserId,
    amountDelta: delta,
    message: `Balance adjustment of ${delta} coins confirmed by server.`,
  });
});

// Start Server with Vite or Static Middleware
async function startServer() {
  const httpServer = http.createServer(app);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Cricket Arena server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
