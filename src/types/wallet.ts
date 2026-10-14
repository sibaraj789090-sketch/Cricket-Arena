export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'starting_bonus'
  | 'referral_bonus'
  | 'game_fee'
  | 'game_reward'
  | 'admin_adjustment';

export type TransactionStatus = 'completed' | 'pending' | 'rejected' | 'failed';

export interface CoinPackage {
  id: string;
  title: string;
  coins: number;
  bonusCoins: number;
  priceInr: number;
  badge?: string;
  isActive: boolean;
  displayOrder: number;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number; // positive for credits, negative for debits
  priceInr?: number;
  status: TransactionStatus;
  balanceBefore: number;
  balanceAfter: number;
  referenceId: string;
  description: string;
  createdAt: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected';
export type PayoutMethod = 'upi' | 'bank_transfer';

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amountCoins: number;
  amountInr: number;
  payoutMethod: PayoutMethod;
  payoutDetails: {
    upiId?: string;
    accountHolderName?: string;
    bankAccountNumber?: string;
    ifscCode?: string;
    bankName?: string;
  };
  status: WithdrawalStatus;
  adminNotes?: string;
  payoutReferenceId?: string;
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
}

export type PaymentOrderStatus = 'created' | 'pending' | 'completed' | 'failed' | 'cancelled';

export interface PaymentOrder {
  id: string;
  userId: string;
  packageId: string;
  amountInr: number;
  coinsAwarded: number;
  status: PaymentOrderStatus;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletSettings {
  topUpEnabled: boolean;
  minDepositInr: number; // default 100
  maxDepositInr: number; // default 100000
  minWithdrawalInr: number; // default 110
  maxWithdrawalInr: number; // default 50000
  startingBonusCoins: number; // default 100
  coinToInrRate: number; // 1 Coin = 1 INR
}

export interface UserWallet {
  userId: string;
  balance: number;
  lockedBalance: number;
  currency: string;
  updatedAt: string;
}
