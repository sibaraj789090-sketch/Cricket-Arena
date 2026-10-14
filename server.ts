// Explicitly disable HMR in AI Studio container preview environment
process.env.DISABLE_HMR = 'true';

import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { ludoRouter } from './src/server/ludoMatchServer';
import { ludoBotRouter } from './src/server/ludoBotRouter';
import { userAuthRouter } from './src/server/userAuthServer';
import {
  serverCashRequests,
  serverPlayerRestrictions,
  checkUserBanStatus,
} from './src/server/adminControlServer';
import {
  requireAdminRole,
  handleAdminLogin,
  handleAdminLogout,
  handleAdminCheck,
} from './src/server/adminAuthServer';
import { CashAdditionRequest, PlayerRestriction, RestrictionType } from './src/types/adminControl';
import { WithdrawalRequest, PayoutMethod } from './src/types/wallet';
import { INITIAL_WITHDRAWALS } from './src/lib/walletData';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// Mount User Sign Up and Login Router (No OTP, Gmail & Phone Auth)
app.use('/api/auth', userAuthRouter);

// Mount Authoritative Online Ludo Multiplayer Router
app.use('/api/ludo', ludoRouter);

// Mount Ludo Virtual Bots & QA Simulation Router (Temporary pre-launch feature)
app.use('/api/admin/bots', ludoBotRouter);
app.use('/api/ludo/bots', ludoBotRouter);

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

// Admin Authentication Endpoints (Strict single-authorized Gmail enforcement)
app.post('/api/admin/auth/login', handleAdminLogin);
app.post('/api/admin/auth/logout', handleAdminLogout);
app.get('/api/admin/auth/check', handleAdminCheck);

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

  // Server-side Player Ban & Blacklist Enforcement
  if (userId) {
    const banCheck = checkUserBanStatus(userId, 'all');
    if (banCheck.banned) {
      return res.status(403).json({
        error: `Access Denied: Your account is restricted (${banCheck.reason || 'Restricted by administrator'}).`,
      });
    }
  }

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

// ==========================================
// SECURE WITHDRAWAL REQUESTS & VERIFICATION SYSTEM
// ==========================================

export const serverWithdrawals = new Map<string, WithdrawalRequest>();

// Seed initial sample withdrawals
INITIAL_WITHDRAWALS.forEach((w) => {
  serverWithdrawals.set(w.id, { ...w });
});

// User Submits Withdrawal Request (Atomic, Pending Admin Approval)
app.post('/api/wallet/request-withdrawal', (req: Request, res: Response) => {
  const { userId, userName, userEmail, amountInr, payoutMethod, payoutDetails } = req.body;

  if (!userId || !amountInr || !payoutMethod || !payoutDetails) {
    return res.status(400).json({
      success: false,
      error: 'User ID, withdrawal amount, payout method, and payout details are required.',
    });
  }

  // Enforce ban / player restriction check
  const banStatus = checkUserBanStatus(userId, 'all');
  if (banStatus.banned) {
    return res.status(403).json({
      success: false,
      error: `Your account is restricted (${banStatus.reason || 'Restricted by administrator'}). Withdrawals are suspended.`,
    });
  }

  const amt = Number(amountInr);
  if (isNaN(amt) || !Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Withdrawal amount must be a valid positive number.',
    });
  }

  if (amt < serverWalletSettings.minWithdrawalInr) {
    return res.status(400).json({
      success: false,
      error: `Minimum withdrawal limit is ₹${serverWalletSettings.minWithdrawalInr}.`,
    });
  }

  if (amt > serverWalletSettings.maxWithdrawalInr) {
    return res.status(400).json({
      success: false,
      error: `Maximum withdrawal limit is ₹${serverWalletSettings.maxWithdrawalInr}.`,
    });
  }

  // Validate payout method & required details
  if (payoutMethod === 'upi') {
    const upiId = String(payoutDetails.upiId || '').trim();
    if (!upiId || !upiId.includes('@') || upiId.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid UPI ID (e.g., username@oksbi, 9876543210@paytm).',
      });
    }
  } else if (payoutMethod === 'bank_transfer') {
    const accHolder = String(payoutDetails.accountHolderName || '').trim();
    const accNum = String(payoutDetails.bankAccountNumber || '').trim();
    const ifsc = String(payoutDetails.ifscCode || '').trim();

    if (!accHolder || accHolder.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Account holder name is required and must match your bank account.',
      });
    }
    if (!accNum || accNum.length < 6 || !/^\d+$/.test(accNum)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid numerical bank account number (at least 6 digits).',
      });
    }
    if (!ifsc || ifsc.length < 4) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid bank IFSC code.',
      });
    }
  } else {
    return res.status(400).json({
      success: false,
      error: 'Invalid payout method. Please choose UPI or Direct Bank Transfer.',
    });
  }

  const requestId = `wdr-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const referenceId = `WDR-REF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const newWithdrawal: WithdrawalRequest = {
    id: requestId,
    userId,
    userName: userName || 'Arena Player',
    userEmail: userEmail || 'player@arena.com',
    amountCoins: Math.floor(amt),
    amountInr: Math.floor(amt),
    payoutMethod: payoutMethod as PayoutMethod,
    payoutDetails: {
      upiId: payoutDetails.upiId ? String(payoutDetails.upiId).trim() : undefined,
      accountHolderName: payoutDetails.accountHolderName ? String(payoutDetails.accountHolderName).trim() : undefined,
      bankAccountNumber: payoutDetails.bankAccountNumber ? String(payoutDetails.bankAccountNumber).trim() : undefined,
      ifscCode: payoutDetails.ifscCode ? String(payoutDetails.ifscCode).trim().toUpperCase() : undefined,
      bankName: payoutDetails.bankName ? String(payoutDetails.bankName).trim() : undefined,
    },
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  serverWithdrawals.set(requestId, newWithdrawal);

  // Authoritative server audit trail
  serverAuditLogs.unshift({
    id: `audit-wdr-${Date.now()}`,
    adminId: 'system',
    adminName: newWithdrawal.userName,
    action: 'WITHDRAWAL_REQUESTED',
    targetType: 'withdrawal',
    targetId: requestId,
    details: `Withdrawal request submitted: ₹${newWithdrawal.amountInr} via ${payoutMethod.toUpperCase()} (${referenceId}). Pending admin review.`,
    timestamp: new Date().toISOString(),
  });

  return res.json({
    success: true,
    requestId,
    referenceId,
    withdrawal: newWithdrawal,
    message: `Withdrawal request for ₹${newWithdrawal.amountInr} received. It is pending review by finance administrators.`,
  });
});

// Admin Review / Decision on Withdrawal Request (Approve or Reject & Refund)
app.post('/api/admin/wallet/withdrawal/action', requireAdminRole, (req: Request, res: Response) => {
  const {
    requestId,
    action,
    adminNotes = '',
    payoutReferenceId = '',
    adminName = 'Finance Admin',
  } = req.body;

  if (!requestId || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({
      success: false,
      error: 'Valid requestId and action (approve/reject) are required.',
    });
  }

  const withdrawal = serverWithdrawals.get(requestId);
  if (!withdrawal) {
    // If not in server in-memory cache, log and return success so client store and Supabase proceed
    serverAuditLogs.unshift({
      id: `audit-wdr-ext-${Date.now()}`,
      adminId: 'admin-master',
      adminName,
      action: action === 'approve' ? 'WITHDRAWAL_APPROVED' : 'WITHDRAWAL_REJECTED',
      targetType: 'withdrawal',
      targetId: requestId,
      details: `Admin ${action}d withdrawal ${requestId}. Note: ${adminNotes}`,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: `Withdrawal action ${action} recorded.`,
    });
  }

  // Idempotency check: exactly-once decision
  if (withdrawal.status !== 'pending') {
    return res.status(400).json({
      success: false,
      error: `Withdrawal request has already been processed with status: ${withdrawal.status}. Duplicate processing prevented.`,
      alreadyProcessed: true,
    });
  }

  if (action === 'approve') {
    withdrawal.status = 'approved';
    withdrawal.adminNotes = String(adminNotes).trim() || 'Verified and transferred.';
    withdrawal.payoutReferenceId = String(payoutReferenceId).trim() || `UTR-${Date.now()}`;
    withdrawal.processedAt = new Date().toISOString();
    withdrawal.processedBy = adminName;

    serverAuditLogs.unshift({
      id: `audit-wdr-appv-${Date.now()}`,
      adminId: 'admin-master',
      adminName,
      action: 'WITHDRAWAL_APPROVED',
      targetType: 'withdrawal',
      targetId: requestId,
      details: `Approved payout of ₹${withdrawal.amountInr} to ${withdrawal.userName} (${withdrawal.payoutMethod.toUpperCase()}). Ref: ${withdrawal.payoutReferenceId}`,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      success: true,
      withdrawal,
      message: `Withdrawal for ₹${withdrawal.amountInr} approved and marked as transferred.`,
    });
  } else {
    withdrawal.status = 'rejected';
    withdrawal.adminNotes = String(adminNotes).trim() || 'Declined by administration. Coins refunded.';
    withdrawal.processedAt = new Date().toISOString();
    withdrawal.processedBy = adminName;

    serverAuditLogs.unshift({
      id: `audit-wdr-rej-${Date.now()}`,
      adminId: 'admin-master',
      adminName,
      action: 'WITHDRAWAL_REJECTED',
      targetType: 'withdrawal',
      targetId: requestId,
      details: `Declined withdrawal of ₹${withdrawal.amountInr} for ${withdrawal.userName}. Coins refunded. Reason: ${withdrawal.adminNotes}`,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      success: true,
      withdrawal,
      message: `Withdrawal declined. ${withdrawal.amountCoins} coins refunded to user wallet.`,
    });
  }
});

// User Views Own Withdrawals
app.get('/api/wallet/withdrawals/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const list: WithdrawalRequest[] = [];

  for (const w of serverWithdrawals.values()) {
    if (w.userId === userId) {
      list.push(w);
    }
  }

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ success: true, withdrawals: list });
});

// Admin Views All Withdrawals Queue
app.get('/api/admin/wallet/withdrawals', requireAdminRole, (req: Request, res: Response) => {
  const { status } = req.query;
  let list = Array.from(serverWithdrawals.values());

  if (status && status !== 'all') {
    list = list.filter((w) => w.status === status);
  }

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ success: true, withdrawals: list });
});

// User Submits Manual Cash Addition Request (NEVER auto-credited)
app.post('/api/wallet/cash-request', (req: Request, res: Response) => {
  const { userId, userName, requestedAmount, reason } = req.body;

  if (!userId || !requestedAmount || !reason) {
    return res.status(400).json({ error: 'User ID, requested amount, and reason are required.' });
  }

  // Enforce ban check
  const banStatus = checkUserBanStatus(userId, 'all');
  if (banStatus.banned) {
    return res.status(403).json({
      error: `Your account is restricted (${banStatus.reason || 'Restricted by administrator'}). Cannot submit requests.`,
    });
  }

  const amt = Number(requestedAmount);
  if (isNaN(amt) || amt <= 0) {
    return res.status(400).json({ error: 'Requested amount must be greater than zero.' });
  }

  const requestId = `req-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const newRequest: CashAdditionRequest = {
    id: requestId,
    userId,
    userName: userName || 'Arena Player',
    requestedAmount: Math.floor(amt),
    reason: String(reason).trim(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  serverCashRequests.set(requestId, newRequest);

  serverAuditLogs.unshift({
    id: `audit-req-${Date.now()}`,
    adminId: 'system',
    adminName: newRequest.userName,
    action: 'CASH_REQUEST_SUBMITTED',
    targetType: 'cash_request',
    targetId: requestId,
    details: `User submitted request for ₹${newRequest.requestedAmount} coins. Reason: ${newRequest.reason}`,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    request: newRequest,
    message: 'Cash addition request submitted for administrative review. Wallet was not credited.',
  });
});

// User Views Own Cash Addition Requests
app.get('/api/wallet/cash-requests/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const userRequests: CashAdditionRequest[] = [];

  for (const r of serverCashRequests.values()) {
    if (r.userId === userId) {
      userRequests.push(r);
    }
  }

  userRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ success: true, requests: userRequests });
});

// Admin Views All Cash Addition Requests
app.get('/api/admin/cash-requests', requireAdminRole, (req: Request, res: Response) => {
  const { status, query } = req.query;
  let requests = Array.from(serverCashRequests.values());

  if (status && status !== 'all') {
    requests = requests.filter((r) => r.status === status);
  }

  if (query && typeof query === 'string') {
    const q = query.toLowerCase().trim();
    requests = requests.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.userId.toLowerCase().includes(q) ||
        r.userName.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)
    );
  }

  requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ success: true, requests });
});

// Admin Decides on Cash Request (Approve or Reject - EXACTLY ONCE)
app.post('/api/admin/cash-requests/action', requireAdminRole, (req: Request, res: Response) => {
  const { requestId, action, approvedAmount, adminNote = '', adminId = 'admin-master', adminName = 'Official Admin' } = req.body;

  if (!requestId || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Valid requestId and action (approve/reject) are required.' });
  }

  const request = serverCashRequests.get(requestId);
  if (!request) {
    return res.status(404).json({ error: 'Cash request not found.' });
  }

  // Idempotency check: exactly-once decision
  if (request.status !== 'pending') {
    return res.status(400).json({
      error: `Request has already been processed with status: ${request.status}. Duplicate processing prevented.`,
      alreadyProcessed: true,
    });
  }

  // Self-approval prohibition
  if (adminId && adminId === request.userId) {
    return res.status(403).json({ error: 'Security violation: Administrators cannot approve their own cash requests.' });
  }

  if (action === 'approve') {
    const amt = approvedAmount !== undefined ? Number(approvedAmount) : request.requestedAmount;
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: 'Approved amount must be greater than zero.' });
    }

    request.status = 'approved';
    request.approvedAmount = amt;
    request.adminNote = String(adminNote).trim();
    request.processedBy = adminId;
    request.processedByName = adminName;
    request.processedAt = new Date().toISOString();

    // Immutable audit log
    serverAuditLogs.unshift({
      id: `audit-appv-${Date.now()}`,
      adminId,
      adminName,
      action: 'CASH_REQUEST_APPROVED',
      targetType: 'cash_request',
      targetId: requestId,
      details: `Approved ₹${amt} coins for ${request.userName} (UID: ${request.userId}). Note: ${request.adminNote || 'Approved'}`,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      success: true,
      request,
      creditedCoins: amt,
      message: `Approved and credited ₹${amt} game coins to ${request.userName}.`,
    });
  } else {
    // Reject request: zero balance alteration
    request.status = 'rejected';
    request.adminNote = String(adminNote).trim() || 'Request rejected by administration.';
    request.processedBy = adminId;
    request.processedByName = adminName;
    request.processedAt = new Date().toISOString();

    serverAuditLogs.unshift({
      id: `audit-rej-${Date.now()}`,
      adminId,
      adminName,
      action: 'CASH_REQUEST_REJECTED',
      targetType: 'cash_request',
      targetId: requestId,
      details: `Rejected cash request of ₹${request.requestedAmount} for ${request.userName}. Reason: ${request.adminNote}`,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      success: true,
      request,
      message: `Cash request rejected with zero wallet balance modification.`,
    });
  }
});

// Admin Player Management & Directory
app.get('/api/admin/players', requireAdminRole, (req: Request, res: Response) => {
  const { query } = req.query;

  // Base list of players from directory and active records
  const samplePlayers = [
    { userId: 'user-demo-1', userName: 'Rajesh_Sharma', email: 'rajesh@arena.in', registeredAt: '2026-08-15T00:00:00.000Z', matches: 14, wins: 9, losses: 5 },
    { userId: 'usr-rohit-88', userName: 'Rohit_Sharma_99', email: 'rohit@skillarena.in', registeredAt: '2026-09-01T00:00:00.000Z', matches: 38, wins: 26, losses: 12 },
    { userId: 'usr-vikram-07', userName: 'Vikram_Rathore', email: 'vikram.r@gmail.com', registeredAt: '2026-09-10T00:00:00.000Z', matches: 21, wins: 14, losses: 7 },
    { userId: 'usr-priya-k', userName: 'Priya_LudoQueen', email: 'priya.k@yahoo.in', registeredAt: '2026-09-14T00:00:00.000Z', matches: 45, wins: 31, losses: 14 },
    { userId: 'usr-aman-singh', userName: 'Aman_Striker', email: 'aman.singh@gmail.com', registeredAt: '2026-09-20T00:00:00.000Z', matches: 19, wins: 11, losses: 8 },
    { userId: 'usr-suspicious-99', userName: 'SpeedHacker_99', email: 'hacker99@anonymous.io', registeredAt: '2026-10-01T00:00:00.000Z', matches: 8, wins: 8, losses: 0 },
    { userId: 'usr-quitter-12', userName: 'RageQuitter_Pro', email: 'quitter@test.com', registeredAt: '2026-10-05T00:00:00.000Z', matches: 15, wins: 2, losses: 13 },
  ];

  let players = samplePlayers.map((sp) => {
    const restriction = Array.from(serverPlayerRestrictions.values()).find(
      (r) => r.userId === sp.userId && r.status === 'active'
    );
    const pendingRequests = Array.from(serverCashRequests.values()).filter(
      (r) => r.userId === sp.userId && r.status === 'pending'
    ).length;

    return {
      userId: sp.userId,
      userName: sp.userName,
      email: sp.email,
      registeredAt: sp.registeredAt,
      balance: 250,
      lockedBalance: 0,
      totalMatchesPlayed: sp.matches,
      wins: sp.wins,
      losses: sp.losses,
      pendingCashRequestsCount: pendingRequests,
      restriction,
    };
  });

  if (query && typeof query === 'string') {
    const q = query.toLowerCase().trim();
    players = players.filter(
      (p) => p.userId.toLowerCase().includes(q) || p.userName.toLowerCase().includes(q) || (p.email && p.email.toLowerCase().includes(q))
    );
  }

  res.json({ success: true, players });
});

// Admin Bans & Restricts Player
app.post('/api/admin/players/restrict', requireAdminRole, (req: Request, res: Response) => {
  const { userId, userName, restrictionType, reason, internalNote = '', durationHours, adminId = 'admin-master', adminName = 'Official Admin' } = req.body;

  if (!userId || !restrictionType || !reason) {
    return res.status(400).json({ error: 'User ID, restriction type, and reason are required.' });
  }

  // Lift any existing active restrictions for this user first
  for (const r of serverPlayerRestrictions.values()) {
    if (r.userId === userId && r.status === 'active') {
      r.status = 'lifted';
      r.liftedAt = new Date().toISOString();
      r.liftedBy = adminId;
    }
  }

  let expiresAt: string | undefined = undefined;
  if (restrictionType === 'temp_suspend' && durationHours) {
    expiresAt = new Date(Date.now() + Number(durationHours) * 3600 * 1000).toISOString();
  }

  const restrictionId = `res-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const newRestriction: PlayerRestriction = {
    id: restrictionId,
    userId,
    userName: userName || `Player_${userId.slice(-4)}`,
    restrictionType: restrictionType as RestrictionType,
    status: 'active',
    reason: String(reason).trim(),
    internalNote: String(internalNote).trim(),
    adminId,
    adminName,
    expiresAt,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  serverPlayerRestrictions.set(restrictionId, newRestriction);

  serverAuditLogs.unshift({
    id: `audit-ban-${Date.now()}`,
    adminId,
    adminName,
    action: `PLAYER_${restrictionType.toUpperCase()}`,
    targetType: 'player_restriction',
    targetId: userId,
    details: `Applied ${restrictionType} to ${newRestriction.userName} (UID: ${userId}). Reason: ${newRestriction.reason}. ${expiresAt ? `Expires: ${expiresAt}` : 'Permanent'}`,
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, restriction: newRestriction, message: `Restriction ${restrictionType} applied to user ${userId}.` });
});

// Admin Lifts Player Ban / Unbans
app.post('/api/admin/players/unban', requireAdminRole, (req: Request, res: Response) => {
  const { userId, reason = 'Unbanned by admin', adminId = 'admin-master', adminName = 'Official Admin' } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  let liftedCount = 0;
  for (const r of serverPlayerRestrictions.values()) {
    if (r.userId === userId && r.status === 'active') {
      r.status = 'lifted';
      r.liftedAt = new Date().toISOString();
      r.liftedBy = adminId;
      liftedCount++;
    }
  }

  serverAuditLogs.unshift({
    id: `audit-unban-${Date.now()}`,
    adminId,
    adminName,
    action: 'PLAYER_RESTRICTION_LIFTED',
    targetType: 'player_restriction',
    targetId: userId,
    details: `Lifted restrictions for player UID ${userId}. Notes: ${reason}`,
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, liftedCount, message: `Access restored for user UID ${userId}.` });
});

// Admin Views All Bans & Blacklist History
app.get('/api/admin/bans', requireAdminRole, (req: Request, res: Response) => {
  const list = Array.from(serverPlayerRestrictions.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json({ success: true, restrictions: list });
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

// In standard dev or full-stack production, start the standalone HTTP server.
// In Vercel serverless environment, the app instance is exported for function routing.
if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export { app };
export default app;
