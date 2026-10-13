import { CoinPackage, WalletSettings, UserWallet, WalletTransaction, WithdrawalRequest } from '../types/wallet';

export const DEFAULT_WALLET_SETTINGS: WalletSettings = {
  topUpEnabled: true,
  minDepositInr: 100,
  maxDepositInr: 100000,
  minWithdrawalInr: 110,
  maxWithdrawalInr: 50000,
  startingBonusCoins: 100,
  coinToInrRate: 1, // 1 Coin = ₹1
};

export const INITIAL_COIN_PACKAGES: CoinPackage[] = [
  {
    id: 'pkg-100',
    title: 'Starter Pack',
    coins: 100,
    bonusCoins: 0,
    priceInr: 100,
    badge: 'Min Deposit',
    isActive: true,
    displayOrder: 1,
  },
  {
    id: 'pkg-250',
    title: 'Popular Booster',
    coins: 250,
    bonusCoins: 25,
    priceInr: 250,
    badge: 'Popular (+10%)',
    isActive: true,
    displayOrder: 2,
  },
  {
    id: 'pkg-500',
    title: 'Pro Player Pack',
    coins: 500,
    bonusCoins: 100,
    priceInr: 500,
    badge: 'Best Value (+20%)',
    isActive: true,
    displayOrder: 3,
  },
  {
    id: 'pkg-1000',
    title: 'Champion Stash',
    coins: 1000,
    bonusCoins: 300,
    priceInr: 1000,
    badge: 'Hot Deal (+30%)',
    isActive: true,
    displayOrder: 4,
  },
  {
    id: 'pkg-2500',
    title: 'Arena Legend Vault',
    coins: 2500,
    bonusCoins: 1000,
    priceInr: 2500,
    badge: 'Huge Bonus (+40%)',
    isActive: true,
    displayOrder: 5,
  },
  {
    id: 'pkg-5000',
    title: 'Grand Master Chest',
    coins: 5000,
    bonusCoins: 2500,
    priceInr: 5000,
    badge: 'Mega Value (+50%)',
    isActive: true,
    displayOrder: 6,
  },
];

export const INITIAL_TRANSACTIONS: WalletTransaction[] = [
  {
    id: 'tx-welcome-001',
    userId: 'user-demo-1',
    type: 'starting_bonus',
    amount: 100,
    status: 'completed',
    balanceBefore: 0,
    balanceAfter: 100,
    referenceId: 'BONUS-INIT-001',
    description: 'Welcome starting bonus credited to your wallet',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'tx-topup-002',
    userId: 'user-demo-1',
    type: 'deposit',
    amount: 500,
    priceInr: 500,
    status: 'completed',
    balanceBefore: 100,
    balanceAfter: 600,
    referenceId: 'PAY-ORD-948122',
    description: 'Purchased Pro Player Pack (500 + 100 Bonus Coins)',
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

export const INITIAL_WITHDRAWALS: WithdrawalRequest[] = [
  {
    id: 'wdr-sample-1',
    userId: 'user-demo-1',
    userName: 'Aarav Sharma',
    userEmail: 'aarav.sharma@example.com',
    amountCoins: 200,
    amountInr: 200,
    payoutMethod: 'upi',
    payoutDetails: {
      upiId: 'aarav@okhdfcbank',
      accountHolderName: 'Aarav Sharma',
    },
    status: 'approved',
    adminNotes: 'Verified and payout released via UPI RRN #482910394819',
    payoutReferenceId: 'UPI-RRN-482910394819',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    processedAt: new Date(Date.now() - 2 * 86400000 + 3600000).toISOString(),
    processedBy: 'Official Arena Finance Admin',
  },
];
