import {
  CoinPackage,
  WalletSettings,
  UserWallet,
  WalletTransaction,
  WithdrawalRequest,
  PayoutMethod,
  TransactionType,
  WithdrawalStatus,
} from '../types/wallet';
import {
  DEFAULT_WALLET_SETTINGS,
  INITIAL_COIN_PACKAGES,
  INITIAL_TRANSACTIONS,
  INITIAL_WITHDRAWALS,
} from './walletData';

const KEYS = {
  SETTINGS: 'cricket_arena_wallet_settings',
  PACKAGES: 'cricket_arena_coin_packages',
  WALLETS: 'cricket_arena_user_wallets',
  TRANSACTIONS: 'cricket_arena_wallet_transactions',
  WITHDRAWALS: 'cricket_arena_wallet_withdrawals',
};

const memoryStorage = new Map<string, string>();

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    const raw = memoryStorage.get(key);
    return raw ? JSON.parse(raw) : fallback;
  }
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`Error loading key ${key}`, err);
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined') {
    memoryStorage.set(key, JSON.stringify(data));
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Error saving key ${key}`, err);
  }
}

export class WalletDataStore {
  // Settings
  static getSettings(): WalletSettings {
    return loadFromStorage<WalletSettings>(KEYS.SETTINGS, DEFAULT_WALLET_SETTINGS);
  }

  static saveSettings(settings: WalletSettings): void {
    saveToStorage(KEYS.SETTINGS, settings);
  }

  // Packages
  static getPackages(activeOnly = false): CoinPackage[] {
    const pkgs = loadFromStorage<CoinPackage[]>(KEYS.PACKAGES, INITIAL_COIN_PACKAGES);
    if (activeOnly) {
      return pkgs.filter((p) => p.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
    }
    return pkgs.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  static savePackages(packages: CoinPackage[]): void {
    saveToStorage(KEYS.PACKAGES, packages);
  }

  // User Wallets map: userId -> UserWallet
  static getWalletsMap(): Record<string, UserWallet> {
    return loadFromStorage<Record<string, UserWallet>>(KEYS.WALLETS, {
      'user-demo-1': {
        userId: 'user-demo-1',
        balance: 600,
        lockedBalance: 0,
        currency: 'COINS',
        updatedAt: new Date().toISOString(),
      },
    });
  }

  static getWallet(userId: string): UserWallet {
    const map = this.getWalletsMap();
    if (!map[userId]) {
      const settings = this.getSettings();
      const initialBonus = settings.startingBonusCoins || 100;

      const newWallet: UserWallet = {
        userId,
        balance: initialBonus,
        lockedBalance: 0,
        currency: 'COINS',
        updatedAt: new Date().toISOString(),
      };
      map[userId] = newWallet;
      saveToStorage(KEYS.WALLETS, map);

      // Record welcome starting bonus transaction
      if (initialBonus > 0) {
        this.addTransaction({
          id: `tx-bonus-${Date.now()}`,
          userId,
          type: 'starting_bonus',
          amount: initialBonus,
          status: 'completed',
          balanceBefore: 0,
          balanceAfter: initialBonus,
          referenceId: `START-BONUS-${Math.floor(1000 + Math.random() * 9000)}`,
          description: `Welcome bonus of ${initialBonus} free coins credited!`,
          createdAt: new Date().toISOString(),
        });
      }
    }
    return map[userId];
  }

  static saveWallet(wallet: UserWallet): void {
    const map = this.getWalletsMap();
    map[wallet.userId] = {
      ...wallet,
      updatedAt: new Date().toISOString(),
    };
    saveToStorage(KEYS.WALLETS, map);
  }

  // Transactions
  static getTransactions(userId?: string): WalletTransaction[] {
    const txs = loadFromStorage<WalletTransaction[]>(KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
    if (userId) {
      return txs.filter((t) => t.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return txs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static addTransaction(tx: WalletTransaction): void {
    const txs = this.getTransactions();
    // Idempotency: verify referenceId hasn't been credited already
    if (tx.referenceId && txs.some((t) => t.referenceId === tx.referenceId && t.status === 'completed')) {
      console.warn(`Idempotency protection: transaction ${tx.referenceId} already exists!`);
      return;
    }
    txs.unshift(tx);
    saveToStorage(KEYS.TRANSACTIONS, txs);
  }

  // Withdrawals
  static getWithdrawals(userId?: string): WithdrawalRequest[] {
    const list = loadFromStorage<WithdrawalRequest[]>(KEYS.WITHDRAWALS, INITIAL_WITHDRAWALS);
    if (userId) {
      return list.filter((w) => w.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static saveWithdrawals(list: WithdrawalRequest[]): void {
    saveToStorage(KEYS.WITHDRAWALS, list);
  }

  // Top-Up / Deposit Coins with Idempotency
  static creditDeposit(
    userId: string,
    coinsToCredit: number,
    priceInr: number,
    referenceId: string,
    packageName: string
  ): { success: boolean; newBalance: number; error?: string } {
    if (!Number.isFinite(coinsToCredit) || coinsToCredit <= 0) {
      return {
        success: false,
        newBalance: this.getWallet(userId).balance,
        error: 'Invalid deposit amount: Coins must be a positive integer.',
      };
    }

    const txs = this.getTransactions();
    if (referenceId && txs.some((t) => t.referenceId === referenceId && t.status === 'completed')) {
      return {
        success: false,
        newBalance: this.getWallet(userId).balance,
        error: 'Duplicate payment reference! Transaction already credited.',
      };
    }

    const wallet = this.getWallet(userId);
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + coinsToCredit;

    wallet.balance = balanceAfter;
    this.saveWallet(wallet);

    this.addTransaction({
      id: `tx-dep-${Date.now()}`,
      userId,
      type: 'deposit',
      amount: coinsToCredit,
      priceInr,
      status: 'completed',
      balanceBefore,
      balanceAfter,
      referenceId,
      description: `Coins Top-Up: ${packageName} (₹${priceInr} = ${coinsToCredit} Coins)`,
      createdAt: new Date().toISOString(),
    });

    return { success: true, newBalance: balanceAfter };
  }

  // Request Withdrawal
  static requestWithdrawal(
    userId: string,
    userName: string,
    userEmail: string,
    amountInr: number,
    payoutMethod: PayoutMethod,
    payoutDetails: WithdrawalRequest['payoutDetails']
  ): { success: boolean; error?: string; request?: WithdrawalRequest } {
    if (!Number.isFinite(amountInr) || amountInr <= 0) {
      return { success: false, error: 'Invalid withdrawal amount: Must be a positive number.' };
    }

    const settings = this.getSettings();
    if (amountInr < settings.minWithdrawalInr) {
      return { success: false, error: `Minimum withdrawal is ₹${settings.minWithdrawalInr}.` };
    }
    if (amountInr > settings.maxWithdrawalInr) {
      return { success: false, error: `Maximum withdrawal is ₹${settings.maxWithdrawalInr}.` };
    }

    const wallet = this.getWallet(userId);
    const coinsNeeded = amountInr; // 1 Coin = 1 INR

    if (wallet.balance < coinsNeeded) {
      return {
        success: false,
        error: `Insufficient balance! You have ${wallet.balance} coins available.`,
      };
    }

    // Atomically transfer from available balance to locked balance
    const balanceBefore = wallet.balance;
    wallet.balance -= coinsNeeded;
    wallet.lockedBalance += coinsNeeded;
    this.saveWallet(wallet);

    const refId = `WDR-REQ-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const newRequest: WithdrawalRequest = {
      id: `wdr-${Date.now()}`,
      userId,
      userName,
      userEmail,
      amountCoins: coinsNeeded,
      amountInr,
      payoutMethod,
      payoutDetails,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const withdrawals = this.getWithdrawals();
    withdrawals.unshift(newRequest);
    this.saveWithdrawals(withdrawals);

    // Ledger transaction
    this.addTransaction({
      id: `tx-wdr-${Date.now()}`,
      userId,
      type: 'withdrawal',
      amount: -coinsNeeded,
      priceInr: amountInr,
      status: 'pending',
      balanceBefore,
      balanceAfter: wallet.balance,
      referenceId: refId,
      description: `Withdrawal request to ${payoutMethod.toUpperCase()}: ₹${amountInr} (Under review)`,
      createdAt: new Date().toISOString(),
    });

    return { success: true, request: newRequest };
  }

  // Admin Approve Withdrawal
  static approveWithdrawal(
    requestId: string,
    adminNotes: string,
    payoutReferenceId: string,
    adminName: string
  ): { success: boolean; error?: string } {
    const withdrawals = this.getWithdrawals();
    const idx = withdrawals.findIndex((w) => w.id === requestId);
    if (idx === -1) return { success: false, error: 'Withdrawal request not found.' };

    const req = withdrawals[idx];
    if (req.status !== 'pending') {
      return { success: false, error: `Request already marked as ${req.status}.` };
    }

    const wallet = this.getWallet(req.userId);
    // Deduct locked balance
    wallet.lockedBalance = Math.max(0, wallet.lockedBalance - req.amountCoins);
    this.saveWallet(wallet);

    req.status = 'approved';
    req.adminNotes = adminNotes || 'Approved and payout released.';
    req.payoutReferenceId = payoutReferenceId || `PAY-UTR-${Date.now()}`;
    req.processedAt = new Date().toISOString();
    req.processedBy = adminName;
    withdrawals[idx] = req;
    this.saveWithdrawals(withdrawals);

    // Update corresponding transaction in ledger
    const txs = this.getTransactions();
    const tx = txs.find((t) => t.userId === req.userId && t.type === 'withdrawal' && t.status === 'pending');
    if (tx) {
      tx.status = 'completed';
      tx.description = `Withdrawal completed: ₹${req.amountInr} transferred (${req.payoutMethod.toUpperCase()}: ${req.payoutReferenceId})`;
      saveToStorage(KEYS.TRANSACTIONS, txs);
    }

    return { success: true };
  }

  // Admin Reject Withdrawal & Refund Coins
  static rejectWithdrawal(
    requestId: string,
    adminNotes: string,
    adminName: string
  ): { success: boolean; error?: string } {
    const withdrawals = this.getWithdrawals();
    const idx = withdrawals.findIndex((w) => w.id === requestId);
    if (idx === -1) return { success: false, error: 'Withdrawal request not found.' };

    const req = withdrawals[idx];
    if (req.status !== 'pending') {
      return { success: false, error: `Request already marked as ${req.status}.` };
    }

    const wallet = this.getWallet(req.userId);
    const balanceBefore = wallet.balance;
    // Release locked balance back to active balance!
    wallet.lockedBalance = Math.max(0, wallet.lockedBalance - req.amountCoins);
    wallet.balance += req.amountCoins;
    this.saveWallet(wallet);

    req.status = 'rejected';
    req.adminNotes = adminNotes || 'Declined. Coins refunded to wallet.';
    req.processedAt = new Date().toISOString();
    req.processedBy = adminName;
    withdrawals[idx] = req;
    this.saveWithdrawals(withdrawals);

    // Update pending transaction to rejected
    const txs = this.getTransactions();
    const tx = txs.find((t) => t.userId === req.userId && t.type === 'withdrawal' && t.status === 'pending');
    if (tx) {
      tx.status = 'rejected';
      tx.description = `Withdrawal declined: ₹${req.amountInr} refunded. Reason: ${req.adminNotes}`;
      saveToStorage(KEYS.TRANSACTIONS, txs);
    }

    // Add explicit refund transaction to ledger
    this.addTransaction({
      id: `tx-ref-${Date.now()}`,
      userId: req.userId,
      type: 'admin_adjustment',
      amount: req.amountCoins,
      status: 'completed',
      balanceBefore,
      balanceAfter: wallet.balance,
      referenceId: `REF-${req.id}`,
      description: `Refund for rejected withdrawal: +${req.amountCoins} coins returned. Reason: ${adminNotes}`,
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  }

  // Admin Manual Adjustment
  static manualAdjustment(
    userId: string,
    amountDelta: number,
    reason: string,
    adminName: string
  ): { success: boolean; newBalance: number; error?: string } {
    if (amountDelta === 0) return { success: false, newBalance: 0, error: 'Amount cannot be zero.' };

    const wallet = this.getWallet(userId);
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amountDelta;

    if (balanceAfter < 0) {
      return {
        success: false,
        newBalance: balanceBefore,
        error: `Cannot reduce balance below 0. User has ${balanceBefore} coins.`,
      };
    }

    wallet.balance = balanceAfter;
    this.saveWallet(wallet);

    this.addTransaction({
      id: `tx-adj-${Date.now()}`,
      userId,
      type: 'admin_adjustment',
      amount: amountDelta,
      status: 'completed',
      balanceBefore,
      balanceAfter,
      referenceId: `ADJ-${Date.now()}`,
      description: `Manual adjustment by ${adminName}: ${amountDelta > 0 ? '+' : ''}${amountDelta} coins. Reason: ${reason}`,
      createdAt: new Date().toISOString(),
    });

    return { success: true, newBalance: balanceAfter };
  }

  // Reserve Game Entry Fee
  static reserveGameEntry(
    userId: string,
    matchId: string,
    tableTitle: string,
    amountCoins: number
  ): { success: boolean; newBalance: number; error?: string } {
    if (!Number.isFinite(amountCoins) || amountCoins <= 0) {
      return { success: false, newBalance: 0, error: 'Invalid entry fee amount.' };
    }

    const wallet = this.getWallet(userId);
    if (wallet.balance < amountCoins) {
      return {
        success: false,
        newBalance: wallet.balance,
        error: `Insufficient balance! You need ₹${amountCoins} but have ₹${wallet.balance}.`,
      };
    }

    const balanceBefore = wallet.balance;
    wallet.balance -= amountCoins;
    wallet.lockedBalance = (wallet.lockedBalance || 0) + amountCoins;
    this.saveWallet(wallet);

    this.addTransaction({
      id: `tx-res-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      userId,
      type: 'game_fee',
      amount: -amountCoins,
      status: 'completed',
      balanceBefore,
      balanceAfter: wallet.balance,
      referenceId: `MATCH-RES-${matchId}`,
      description: `Ludo Entry Reserved: ${tableTitle} (₹${amountCoins})`,
      createdAt: new Date().toISOString(),
      metadata: { matchId, amountCoins, tableTitle },
    });

    return { success: true, newBalance: wallet.balance };
  }

  // Refund Game Entry Fee (on cancellation or abandonment)
  static refundGameEntry(
    userId: string,
    matchId: string,
    tableTitle: string,
    amountCoins: number,
    reason: string
  ): { success: boolean; newBalance: number; error?: string } {
    const wallet = this.getWallet(userId);
    const balanceBefore = wallet.balance;

    wallet.lockedBalance = Math.max(0, (wallet.lockedBalance || 0) - amountCoins);
    wallet.balance += amountCoins;
    this.saveWallet(wallet);

    this.addTransaction({
      id: `tx-ref-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      userId,
      type: 'game_reward',
      amount: amountCoins,
      status: 'completed',
      balanceBefore,
      balanceAfter: wallet.balance,
      referenceId: `MATCH-REF-${matchId}`,
      description: `Ludo Entry Refunded: ${tableTitle} (+₹${amountCoins}). Reason: ${reason}`,
      createdAt: new Date().toISOString(),
      metadata: { matchId, amountCoins, reason },
    });

    return { success: true, newBalance: wallet.balance };
  }

  // Settle Game Reward (Award prize to winner)
  static settleGameReward(
    userId: string,
    matchId: string,
    tableTitle: string,
    prizeCoins: number,
    originalEntryFee: number
  ): { success: boolean; newBalance: number } {
    const wallet = this.getWallet(userId);
    const balanceBefore = wallet.balance;

    // Clear reserved entry fee
    wallet.lockedBalance = Math.max(0, (wallet.lockedBalance || 0) - originalEntryFee);
    // Credit prize
    wallet.balance += prizeCoins;
    this.saveWallet(wallet);

    this.addTransaction({
      id: `tx-win-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      userId,
      type: 'game_reward',
      amount: prizeCoins,
      status: 'completed',
      balanceBefore,
      balanceAfter: wallet.balance,
      referenceId: `MATCH-WIN-${matchId}`,
      description: `🏆 Ludo Match Won! ${tableTitle} (+₹${prizeCoins} Prize)`,
      createdAt: new Date().toISOString(),
      metadata: { matchId, prizeCoins, originalEntryFee },
    });

    return { success: true, newBalance: wallet.balance };
  }

  // Settle Game Loss (Clear reserved entry fee for loser)
  static settleGameLoss(
    userId: string,
    matchId: string,
    originalEntryFee: number
  ): { success: boolean; newBalance: number } {
    const wallet = this.getWallet(userId);
    wallet.lockedBalance = Math.max(0, (wallet.lockedBalance || 0) - originalEntryFee);
    this.saveWallet(wallet);
    return { success: true, newBalance: wallet.balance };
  }
}
