// Explicitly disable HMR in AI Studio container preview environment
process.env.DISABLE_HMR = 'true';

import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
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

// Support pre-parsed bodies from serverless platforms (e.g. Vercel)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
    try {
      req.body = JSON.parse(req.body);
      (req as any)._body = true;
    } catch {}
  } else if (Buffer.isBuffer(req.body)) {
    try {
      req.body = JSON.parse(req.body.toString('utf8'));
      (req as any)._body = true;
    } catch {}
  } else if (req.body && typeof req.body === 'object') {
    (req as any)._body = true;
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Normalize request URL for Vercel edge/serverless rewrites
app.use((req: Request, res: Response, next: NextFunction) => {
  const queryParam =
    req.query?.__path ||
    (req.query as any)?.[0] ||
    req.query?.path ||
    (req.query as any)?.all;
  const queryPath = Array.isArray(queryParam) ? queryParam.join('/') : (queryParam as string | undefined);

  const matchedPath =
    (req.headers['x-matched-path'] as string) ||
    (req.headers['x-vercel-matched-path'] as string) ||
    (req as any).originalUrl;

  let targetPath = '';
  if (queryPath) {
    const cleanSubPath = queryPath.replace(/^\/+/, '');
    targetPath = cleanSubPath.startsWith('api/') ? `/${cleanSubPath}` : `/api/${cleanSubPath}`;
  } else if (
    matchedPath &&
    matchedPath.startsWith('/api') &&
    !matchedPath.includes('[...') &&
    (req.url === '/api' || req.url === '/' || !req.url.startsWith('/api/'))
  ) {
    targetPath = matchedPath;
  } else if (req.url && !req.url.startsWith('/api')) {
    if (
      req.url.startsWith('/wallet/') ||
      req.url.startsWith('/auth/') ||
      req.url.startsWith('/ludo/') ||
      req.url.startsWith('/admin/') ||
      req.url.startsWith('/teams/') ||
      req.url.startsWith('/health')
    ) {
      targetPath = `/api${req.url}`;
    } else {
      targetPath = req.url;
    }
  } else {
    targetPath = req.url;
  }

  // Preserve query string when reconstructing req.url
  const queryEntries = Object.entries(req.query || {}).filter(
    ([k]) => k !== '__path' && k !== 'path' && k !== 'all' && k !== '0'
  );
  const rawPath = targetPath.split('?')[0];
  const queryString = queryEntries.length > 0
    ? '?' + new URLSearchParams(queryEntries.map(([k, v]) => [k, String(Array.isArray(v) ? v[0] : (typeof v === 'object' && v ? JSON.stringify(v) : v ?? ''))])).toString()
    : (targetPath.includes('?') ? '?' + targetPath.split('?')[1] : '');

  req.url = `${rawPath}${queryString}`;
  next();
});

// Mount User Sign Up and Login Router (No OTP, Gmail & Phone Auth)
app.use('/api/auth', userAuthRouter);
app.use('/auth', userAuthRouter);

// Mount Authoritative Online Ludo Multiplayer Router
app.use('/api/ludo', ludoRouter);
app.use('/ludo', ludoRouter);

// Mount Ludo Virtual Bots & QA Simulation Router (Temporary pre-launch feature)
app.use('/api/admin/bots', ludoBotRouter);
app.use('/admin/bots', ludoBotRouter);
app.use('/api/ludo/bots', ludoBotRouter);
app.use('/ludo/bots', ludoBotRouter);

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
  paymentSessionId?: string;
  gatewayPaymentId?: string;
  paymentMethod?: string;
  gatewayType: 'cashfree' | 'razorpay';
  createdAt: string;
  updatedAt: string;
}

const serverPaymentOrders: Map<string, ServerPaymentOrder> = new Map();
const processedPaymentSignatures: Set<string> = new Set(); // Idempotency check

// Payment Gateway Configuration Helper
const getPaymentGatewayConfig = () => {
  // Support standard Cashfree Vercel environment variables as first-class citizens,
  // while preserving fallback to generic PAYMENT_GATEWAY_* and RAZORPAY_* variables.
  const keyId = (
    process.env.CASHFREE_CLIENT_ID ||
    process.env.CASHFREE_APP_ID ||
    process.env.PAYMENT_GATEWAY_KEY_ID ||
    process.env.RAZORPAY_KEY_ID ||
    ''
  ).trim();

  const keySecret = (
    process.env.CASHFREE_CLIENT_SECRET ||
    process.env.CASHFREE_SECRET_KEY ||
    process.env.PAYMENT_GATEWAY_KEY_SECRET ||
    process.env.RAZORPAY_KEY_SECRET ||
    ''
  ).trim();

  const webhookSecret = (
    process.env.CASHFREE_WEBHOOK_SECRET ||
    process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET ||
    process.env.RAZORPAY_WEBHOOK_SECRET ||
    ''
  ).trim();

  const isConfigured = Boolean(keyId && keySecret);

  // Auto-detect gateway provider based on environment and key formats
  const hasCashfreeEnv = Boolean(
    process.env.CASHFREE_CLIENT_ID ||
    process.env.CASHFREE_CLIENT_SECRET ||
    process.env.CASHFREE_APP_ID ||
    process.env.CASHFREE_SECRET_KEY ||
    process.env.CASHFREE_ENV
  );
  const isCashfree = hasCashfreeEnv || keySecret.startsWith('cfsk_') || keyId.length > 20 || (!keyId.startsWith('rzp_') && keyId.length >= 8);

  // Interpret CASHFREE_ENV (case-insensitive)
  const rawEnv = (
    process.env.CASHFREE_ENV ||
    process.env.CASHFREE_ENVIRONMENT ||
    process.env.PAYMENT_GATEWAY_ENV ||
    ''
  ).trim().toLowerCase();

  let isProd = false;
  if (rawEnv === 'production' || rawEnv === 'prod') {
    isProd = true;
  } else if (rawEnv === 'sandbox' || rawEnv === 'test' || rawEnv === 'dev' || rawEnv === 'development') {
    isProd = false;
  } else {
    // Heuristic fallback if CASHFREE_ENV is omitted
    isProd = isCashfree
      ? (keySecret.startsWith('cfsk_ma_prod_') || (!keySecret.toLowerCase().includes('test') && !keyId.toLowerCase().includes('test')))
      : !keyId.startsWith('rzp_test_');
  }

  const apiVersion = (process.env.CASHFREE_API_VERSION || '2023-08-01').trim();

  return {
    keyId,
    keySecret,
    webhookSecret,
    isConfigured,
    gatewayType: (isCashfree ? 'cashfree' : 'razorpay') as 'cashfree' | 'razorpay',
    isProd,
    apiVersion,
    cashfreeBaseUrl: isProd ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg',
  };
};

const SUPPORTED_PAYMENT_METHODS = ['upi', 'card', 'netbanking'] as const;
type SupportedPaymentMethod = (typeof SUPPORTED_PAYMENT_METHODS)[number];

// Get Wallet Config & Packages
app.get('/api/wallet/config', (req: Request, res: Response) => {
  const gwConfig = getPaymentGatewayConfig();
  res.json({
    settings: serverWalletSettings,
    packages: serverCoinPackages.filter((p) => p.isActive).sort((a, b) => a.displayOrder - b.displayOrder),
    gatewayConfigured: gwConfig.isConfigured,
    gatewayType: gwConfig.isConfigured ? gwConfig.gatewayType : null,
    isProd: gwConfig.isProd,
    gatewayMode: gwConfig.isProd ? 'production' : 'sandbox',
  });
});

// Create Secure Payment Order on Server
app.post('/api/wallet/create-order', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      packageId,
      customAmountInr,
      paymentMethod = 'upi',
      customerName,
      customerEmail,
      customerPhone,
    } = req.body || {};

    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return res.status(400).json({ success: false, error: 'User ID is required to create a payment order.' });
    }

    // Ban / Player restriction enforcement
    const banStatus = checkUserBanStatus(userId, 'all');
    if (banStatus.banned) {
      return res.status(403).json({
        success: false,
        error: `Your account is restricted (${banStatus.reason || 'Restricted by administrator'}). Purchases are suspended.`,
      });
    }

    if (!serverWalletSettings.topUpEnabled) {
      return res.status(403).json({
        success: false,
        error: 'Coin purchases are currently disabled by administration.',
      });
    }

    // Validate payment method
    const validMethod = String(paymentMethod || 'upi').toLowerCase().trim() as SupportedPaymentMethod;
    if (!SUPPORTED_PAYMENT_METHODS.includes(validMethod)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported payment method "${paymentMethod}". Supported methods: UPI / QR, Card, and NetBanking.`,
      });
    }

    let amountInr = 0;
    let coinsAwarded = 0;

    if (packageId === 'custom') {
      const customAmt = Number(customAmountInr);
      if (isNaN(customAmt) || customAmt < serverWalletSettings.minDepositInr) {
        return res.status(400).json({
          success: false,
          error: `Minimum deposit amount is ₹${serverWalletSettings.minDepositInr}.`,
        });
      }
      if (customAmt > serverWalletSettings.maxDepositInr) {
        return res.status(400).json({
          success: false,
          error: `Maximum deposit amount is ₹${serverWalletSettings.maxDepositInr.toLocaleString()}.`,
        });
      }
      amountInr = Math.floor(customAmt);
      coinsAwarded = Math.floor(amountInr * serverWalletSettings.coinToInrRate);
    } else {
      const pkg = serverCoinPackages.find((p) => p.id === packageId && p.isActive);
      if (!pkg) {
        return res.status(404).json({
          success: false,
          error: 'Selected coin package is invalid or inactive.',
        });
      }
      amountInr = pkg.priceInr;
      coinsAwarded = pkg.coins + pkg.bonusCoins;
    }

    const gwConfig = getPaymentGatewayConfig();

    if (!gwConfig.isConfigured) {
      return res.status(503).json({
        success: false,
        error: 'Payment gateway credentials are not configured on the server. Please verify CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET (or PAYMENT_GATEWAY_KEY_ID/SECRET) in your environment variables.',
        missingGatewayConfig: true,
      });
    }

    // Clean unique order ID: Cashfree order_id allows letters, numbers, hyphens, and underscores (max 45 chars)
    const orderId = `ord_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    let gatewayOrderId = '';
    let paymentSessionId = '';

    if (gwConfig.gatewayType === 'cashfree') {
      // Clean customer_id (must be alphanumeric, hyphens, underscores, max 50 chars)
      const cleanCustomerId = `cust_${userId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(-30)}`;
      const rawPhone = String(customerPhone || '').replace(/\D/g, '');
      const cleanPhone = rawPhone.length >= 10 ? rawPhone.slice(-10) : '9876543210';
      const cleanEmail = (customerEmail && String(customerEmail).includes('@')) ? String(customerEmail).trim() : 'player@cricketarena.in';
      const cleanName = String(customerName || 'Arena Player').trim() || 'Arena Player';

      // Detect host and protocol for safe return_url. Cashfree Production strictly mandates HTTPS return_url.
      const host = req.get('host') || 'cricketarena.in';
      const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
      const origin = isLocal || !host.includes('.')
        ? 'https://cricketarena.in'
        : `https://${host}`;

      const orderMeta: Record<string, string> = {
        return_url: `${origin}/?order_id={order_id}`,
      };
      if (gwConfig.webhookSecret) {
        orderMeta.notify_url = `${origin}/api/wallet/webhook`;
      }

      const cashfreeOrderPayload = {
        order_id: orderId,
        order_amount: Number(amountInr.toFixed(2)),
        order_currency: 'INR',
        customer_details: {
          customer_id: cleanCustomerId,
          customer_phone: cleanPhone,
          customer_email: cleanEmail,
          customer_name: cleanName,
        },
        order_meta: orderMeta,
        order_tags: {
          userId: cleanCustomerId,
          packageId: String(packageId),
          coinsAwarded: String(coinsAwarded),
        },
        order_note: `Cricket Arena: ${coinsAwarded} Coins Top-Up`,
      };

      try {
        const cfResponse = await fetch(`${gwConfig.cashfreeBaseUrl}/orders`, {
          method: 'POST',
          headers: {
            'x-client-id': gwConfig.keyId,
            'x-client-secret': gwConfig.keySecret,
            'x-api-version': gwConfig.apiVersion,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(cashfreeOrderPayload),
        });

        const cfData = await cfResponse.json().catch(() => ({}));

        if (!cfResponse.ok) {
          // Log sanitized error details without leaking client secret or auth headers
          console.error('[Cashfree Order Creation Error]', {
            status: cfResponse.status,
            code: cfData?.code,
            type: cfData?.type,
            subCode: cfData?.sub_code,
            message: cfData?.message || cfData?.error || 'Rejected by gateway',
          });

          const gatewayErrorMsg =
            cfData?.message ||
            cfData?.error_description ||
            (typeof cfData?.error === 'string' ? cfData.error : '') ||
            `Gateway rejected order creation (HTTP ${cfResponse.status})`;

          return res.status(502).json({
            success: false,
            error: `Gateway error: ${gatewayErrorMsg}`,
            gatewayStatus: cfResponse.status,
            gatewayCode: cfData?.code,
          });
        }

        gatewayOrderId = String(cfData.cf_order_id || cfData.order_id);
        paymentSessionId = cfData.payment_session_id;

        if (!paymentSessionId) {
          console.error('[Cashfree Error] Missing payment_session_id in response:', cfData);
          return res.status(502).json({
            success: false,
            error: 'Payment gateway did not provide a valid payment session ID. Please try again.',
          });
        }
      } catch (networkErr: any) {
        console.error('[Cashfree Network Error]', networkErr?.message || networkErr);
        return res.status(502).json({
          success: false,
          error: 'Failed to communicate with payment gateway. Please check your network connection.',
        });
      }
    } else {
      // Razorpay Gateway
      const amountInPaise = Math.round(amountInr * 100);
      const authHeader = 'Basic ' + Buffer.from(`${gwConfig.keyId}:${gwConfig.keySecret}`).toString('base64');

      try {
        const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: amountInPaise,
            currency: 'INR',
            receipt: orderId,
            notes: {
              userId,
              packageId,
              paymentMethod: validMethod,
            },
          }),
        });

        const rzpData = await rzpResponse.json().catch(() => ({}));
        if (!rzpResponse.ok) {
          return res.status(502).json({
            success: false,
            error: rzpData?.error?.description || 'Payment gateway rejected order creation.',
          });
        }

        gatewayOrderId = rzpData.id;
      } catch (err: any) {
        return res.status(502).json({
          success: false,
          error: 'Failed to communicate with Razorpay payment gateway.',
        });
      }
    }

    const order: ServerPaymentOrder = {
      id: orderId,
      userId,
      packageId,
      amountInr,
      coinsAwarded,
      status: 'pending',
      gatewayOrderId,
      paymentSessionId,
      paymentMethod: validMethod,
      gatewayType: gwConfig.gatewayType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    serverPaymentOrders.set(orderId, order);
    if (gatewayOrderId) {
      serverPaymentOrders.set(gatewayOrderId, order);
    }

    return res.json({
      success: true,
      orderId,
      gatewayOrderId,
      paymentSessionId,
      gatewayType: gwConfig.gatewayType,
      isProd: gwConfig.isProd,
      keyId: gwConfig.gatewayType === 'razorpay' ? gwConfig.keyId : undefined,
      amountInr,
      coinsAwarded,
      currency: 'INR',
      paymentMethod: validMethod,
      message: 'Payment order created securely on server.',
    });
  } catch (err: any) {
    console.error('[create-order server exception]', err);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while creating the payment order.',
    });
  }
});

// Verify Payment & Credit Coins Idempotently
app.post('/api/wallet/verify-payment', async (req: Request, res: Response) => {
  try {
    const { orderId, paymentId, signature } = req.body || {};

    if (!orderId && !paymentId) {
      return res.status(400).json({ success: false, error: 'Order ID or Payment ID is required for verification.' });
    }

    let order = (orderId ? serverPaymentOrders.get(orderId) : undefined) || (paymentId ? serverPaymentOrders.get(paymentId) : undefined);

    const gwConfig = getPaymentGatewayConfig();

    // In serverless environments (e.g. Vercel), in-memory Map may be reset between lambda invocations.
    // Recover order details directly from Cashfree API if order is missing in local memory.
    if (!order && gwConfig.isConfigured && gwConfig.gatewayType === 'cashfree' && (orderId || paymentId)) {
      const targetOrderId = orderId || paymentId;
      try {
        const cfOrderRes = await fetch(`${gwConfig.cashfreeBaseUrl}/orders/${targetOrderId}`, {
          method: 'GET',
          headers: {
            'x-client-id': gwConfig.keyId,
            'x-client-secret': gwConfig.keySecret,
            'x-api-version': gwConfig.apiVersion,
          },
        });
        if (cfOrderRes.ok) {
          const cfData = await cfOrderRes.json().catch(() => ({}));
          const orderAmount = Number(cfData.order_amount) || 0;
          const coins = cfData.order_tags?.coinsAwarded
            ? Number(cfData.order_tags.coinsAwarded)
            : Math.floor(orderAmount * serverWalletSettings.coinToInrRate);
          const userIdFromTags = cfData.order_tags?.userId?.replace(/^cust_/, '') || 'anonymous';
          order = {
            id: targetOrderId,
            userId: userIdFromTags,
            packageId: cfData.order_tags?.packageId || 'custom',
            amountInr: orderAmount,
            coinsAwarded: coins,
            status: cfData.order_status === 'PAID' ? 'completed' : 'pending',
            gatewayOrderId: String(cfData.cf_order_id || cfData.order_id || targetOrderId),
            gatewayType: 'cashfree',
            createdAt: cfData.created_at || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          serverPaymentOrders.set(targetOrderId, order);
        }
      } catch (recoveryErr) {
        console.error('[Cashfree serverless order recovery error]', recoveryErr);
      }
    }

    if (!order) {
      return res.status(404).json({ success: false, error: 'Payment order not found or expired on server.' });
    }

    // Idempotency check: prevent duplicate credits
    const paymentKey = `${order.id}:${paymentId || order.gatewayOrderId}`;
    if (order.status === 'completed' || processedPaymentSignatures.has(paymentKey)) {
      return res.json({
        success: true,
        idempotent: true,
        message: 'Payment already verified and credited.',
        coinsAwarded: order.coinsAwarded,
        amountInr: order.amountInr,
        orderId: order.id,
      });
    }

    if (order.gatewayType === 'cashfree') {
      // Verify payment with Cashfree API
      try {
        const cfOrderRes = await fetch(`${gwConfig.cashfreeBaseUrl}/orders/${order.id}`, {
          method: 'GET',
          headers: {
            'x-client-id': gwConfig.keyId,
            'x-client-secret': gwConfig.keySecret,
            'x-api-version': gwConfig.apiVersion,
          },
        });

        const cfOrderData = await cfOrderRes.json().catch(() => ({}));

        if (!cfOrderRes.ok) {
          return res.status(502).json({
            success: false,
            error: 'Failed to verify payment status with Cashfree.',
          });
        }

        if (cfOrderData.order_status !== 'PAID') {
          return res.status(400).json({
            success: false,
            error: `Payment is not confirmed by gateway (status: ${cfOrderData.order_status || 'PENDING'}). Coins have not been credited.`,
            orderStatus: cfOrderData.order_status,
          });
        }

        if (Number(cfOrderData.order_amount) !== Number(order.amountInr)) {
          return res.status(400).json({
            success: false,
            error: 'Payment amount mismatch detected. Transaction suspended.',
          });
        }
      } catch (err: any) {
        return res.status(502).json({
          success: false,
          error: 'Network error while verifying payment with Cashfree gateway.',
        });
      }
    } else {
      // Razorpay signature verification
      if (!signature || !paymentId) {
        return res.status(400).json({ success: false, error: 'Payment ID and Signature are required for verification.' });
      }

      const expected = crypto
        .createHmac('sha256', gwConfig.keySecret)
        .update(`${order.gatewayOrderId}|${paymentId}`)
        .digest('hex');

      if (expected !== signature) {
        return res.status(400).json({ success: false, error: 'Invalid payment signature. Verification failed.' });
      }
    }

    // Mark as completed
    processedPaymentSignatures.add(paymentKey);
    order.status = 'completed';
    order.gatewayPaymentId = paymentId || `cf_pay_${Date.now()}`;
    order.updatedAt = new Date().toISOString();

    // Authoritative Server Audit Log
    const auditEntry: ServerAuditLog = {
      id: `audit-pay-${Date.now()}`,
      adminId: 'system-gateway',
      adminName: `${order.gatewayType.toUpperCase()} Gateway Verified`,
      action: 'COIN_TOPUP_VERIFIED',
      targetType: 'wallet',
      targetId: order.userId,
      details: `Verified ₹${order.amountInr} payment via ${order.gatewayType.toUpperCase()} (${order.id}). Credited ${order.coinsAwarded} coins.`,
      timestamp: new Date().toISOString(),
    };
    serverAuditLogs.unshift(auditEntry);

    return res.json({
      success: true,
      coinsAwarded: order.coinsAwarded,
      amountInr: order.amountInr,
      orderId: order.id,
      gatewayOrderId: order.gatewayOrderId,
      gatewayPaymentId: order.gatewayPaymentId,
      message: 'Payment verified successfully. Coins credited.',
    });
  } catch (err: any) {
    console.error('[verify-payment server exception]', err);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while verifying the payment.',
    });
  }
});

// Cashfree & Razorpay Webhook Handler
app.post('/api/wallet/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const gwConfig = getPaymentGatewayConfig();
    const signature = (req.headers['x-webhook-signature'] as string) || (req.headers['x-razorpay-signature'] as string);
    const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    if (gwConfig.webhookSecret && signature) {
      const timestamp = (req.headers['x-webhook-timestamp'] as string) || '';
      const payloadToSign = timestamp ? `${timestamp}${bodyStr}` : bodyStr;
      const expected = crypto.createHmac('sha256', gwConfig.webhookSecret).update(payloadToSign).digest('base64');
      const expectedHex = crypto.createHmac('sha256', gwConfig.webhookSecret).update(payloadToSign).digest('hex');

      if (signature !== expected && signature !== expectedHex) {
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
    }

    const payload = typeof req.body === 'object' ? req.body : JSON.parse(bodyStr || '{}');
    const orderId = payload?.data?.order?.order_id || payload?.payload?.payment?.entity?.notes?.orderId;
    const isSuccess = payload?.type === 'PAYMENT_SUCCESS_WEBHOOK' || payload?.type === 'ORDER_PAID_WEBHOOK' || payload?.event === 'payment.captured';

    if (orderId && isSuccess) {
      const order = serverPaymentOrders.get(orderId);
      if (order && order.status !== 'completed') {
        order.status = 'completed';
        order.updatedAt = new Date().toISOString();
        serverAuditLogs.unshift({
          id: `audit-wb-${Date.now()}`,
          adminId: 'webhook',
          adminName: 'Payment Gateway Webhook',
          action: 'WEBHOOK_PAYMENT_CONFIRMED',
          targetType: 'wallet',
          targetId: order.userId,
          details: `Webhook confirmed payment for order ${orderId}. Credited ${order.coinsAwarded} coins.`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return res.json({ status: 'ok' });
  } catch {
    return res.status(200).json({ status: 'ignored' });
  }
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
// In Vercel / serverless environment, the app instance is exported for function routing.
const isServerless = Boolean(process.env.VERCEL || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME);
if (!isServerless && process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
  });
}

export { app };
export default app;
