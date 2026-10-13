import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Coins,
  AlertTriangle,
  Filter,
  Check,
  ShieldAlert,
  ArrowRight,
  Info,
} from 'lucide-react';
import { CashAdditionRequest } from '../../types/adminControl';
import { AdminDataStore } from '../../lib/adminDataStore';
import { WalletDataStore } from '../../lib/walletStorage';
import { useAuth } from '../../context/AuthContext';
import { adminFetch } from '../../lib/adminAuth';

export const AdminCashRequestsSection: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<CashAdditionRequest[]>(() =>
    AdminDataStore.getCashRequests()
  );
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Request for Action Modal
  const [selectedReq, setSelectedReq] = useState<CashAdditionRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [customApprovedAmount, setCustomApprovedAmount] = useState<number>(0);
  const [adminNote, setAdminNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const reloadRequests = () => {
    setRequests(AdminDataStore.getCashRequests());
  };

  useEffect(() => {
    reloadRequests();
  }, []);

  const filteredRequests = requests.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase().trim();
    return (
      r.id.toLowerCase().includes(q) ||
      r.userId.toLowerCase().includes(q) ||
      r.userName.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q)
    );
  });

  const handleOpenAction = (req: CashAdditionRequest, type: 'approve' | 'reject') => {
    setSelectedReq(req);
    setActionType(type);
    setCustomApprovedAmount(req.requestedAmount);
    setAdminNote('');
    setFeedbackMsg(null);
  };

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq || !actionType) return;

    // Self-approval prohibition
    if (user?.id && user.id === selectedReq.userId) {
      setFeedbackMsg({
        text: 'Administrative Violation: You cannot approve or reject your own cash request.',
        error: true,
      });
      return;
    }

    setIsProcessing(true);
    setFeedbackMsg(null);

    try {
      if (actionType === 'approve') {
        const result = await AdminDataStore.approveCashRequest({
          requestId: selectedReq.id,
          approvedAmount: customApprovedAmount,
          adminNote,
          adminId: user?.id || 'admin-master',
          adminName: user?.name || 'Administrator',
        });

        if (result.success) {
          // Sync with server API
          adminFetch('/api/admin/cash-requests/action', {
            method: 'POST',
            body: JSON.stringify({
              requestId: selectedReq.id,
              action: 'approve',
              approvedAmount: customApprovedAmount,
              adminNote,
              adminId: user?.id || 'admin-master',
              adminName: user?.name || 'Administrator',
            }),
          }).catch(() => {});

          setFeedbackMsg({
            text: `Successfully approved ₹${customApprovedAmount} cash coins for ${selectedReq.userName}. Wallet credited exactly once.`,
          });
          reloadRequests();
          setTimeout(() => {
            setSelectedReq(null);
            setActionType(null);
          }, 1800);
        } else {
          setFeedbackMsg({ text: result.error || 'Failed to approve request.', error: true });
        }
      } else {
        const result = await AdminDataStore.rejectCashRequest({
          requestId: selectedReq.id,
          adminNote,
          adminId: user?.id || 'admin-master',
          adminName: user?.name || 'Administrator',
        });

        if (result.success) {
          adminFetch('/api/admin/cash-requests/action', {
            method: 'POST',
            body: JSON.stringify({
              requestId: selectedReq.id,
              action: 'reject',
              adminNote,
              adminId: user?.id || 'admin-master',
              adminName: user?.name || 'Administrator',
            }),
          }).catch(() => {});

          setFeedbackMsg({
            text: `Cash request for ${selectedReq.userName} has been rejected with zero wallet balance modification.`,
          });
          reloadRequests();
          setTimeout(() => {
            setSelectedReq(null);
            setActionType(null);
          }, 1800);
        } else {
          setFeedbackMsg({ text: result.error || 'Failed to reject request.', error: true });
        }
      }
    } catch (err: any) {
      setFeedbackMsg({ text: err?.message || 'Action failed.', error: true });
    } finally {
      setIsProcessing(false);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length;

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase font-extrabold text-amber-400">Pending Requests</span>
            <p className="text-2xl font-black text-white font-mono mt-0.5">{pendingCount}</p>
          </div>
          <Clock className="w-6 h-6 text-amber-400" />
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase font-extrabold text-emerald-400">Approved (Credited)</span>
            <p className="text-2xl font-black text-white font-mono mt-0.5">{approvedCount}</p>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
        </div>

        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase font-extrabold text-rose-400">Rejected (Unchanged)</span>
            <p className="text-2xl font-black text-white font-mono mt-0.5">{rejectedCount}</p>
          </div>
          <XCircle className="w-6 h-6 text-rose-400" />
        </div>
      </div>

      {/* Policy Reminder */}
      <div className="p-3 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-xs text-blue-300 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-cyan-200">
            Strict Manual Review &amp; Exactly-Once Execution Policy
          </p>
          <p className="text-[11px] text-slate-300 mt-0.5">
            Users submit requests without automated crediting. Approvals credit virtual coins through an atomic server function with an immutable audit entry. Repeated clicks and duplicate requests are rejected.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['pending', 'all', 'approved', 'rejected'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition shrink-0 cursor-pointer ${
                statusFilter === tab
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              {tab === 'all' ? 'All Requests' : tab}
              {tab === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full text-[10px] font-black">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search UID, username, reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
          />
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-500">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30 text-emerald-400" />
            <p className="text-xs font-semibold">No cash addition requests found.</p>
          </div>
        ) : (
          filteredRequests.map((req) => {
            const isPending = req.status === 'pending';
            const userWallet = WalletDataStore.getWallet(req.userId);

            return (
              <div
                key={req.id}
                className={`p-4 rounded-2xl border transition ${
                  isPending
                    ? 'bg-[#0f1d38]/90 border-amber-500/30 shadow-lg'
                    : req.status === 'approved'
                    ? 'bg-slate-900/80 border-emerald-500/20'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black text-white">
                        ₹{req.requestedAmount} Coins
                      </span>
                      <span
                        className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full border ${
                          isPending
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : req.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                        }`}
                      >
                        {req.status}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        ID: {req.id}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1">
                      <span className="font-semibold text-white flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-cyan-400" />
                        {req.userName}
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        UID: <strong className="text-slate-200">{req.userId}</strong>
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        Current Balance: <strong className="text-amber-400">₹{userWallet.balance}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-[11px] text-slate-400 block font-mono">
                      {new Date(req.createdAt).toLocaleString()}
                    </span>
                    {req.processedAt && (
                      <span className="text-[10px] text-slate-500 block">
                        Handled by {req.processedByName || 'Admin'} on {new Date(req.processedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3">
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Reason / Proof Submitted:
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
                      {req.reason}
                    </p>
                  </div>

                  {req.adminNote && (
                    <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-800/40 text-xs text-cyan-300 mb-3">
                      <strong>Internal Admin Note:</strong> {req.adminNote}
                    </div>
                  )}

                  {/* Actions for Pending Requests */}
                  {isPending ? (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleOpenAction(req, 'approve')}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approve &amp; Credit</span>
                      </button>

                      <button
                        onClick={() => handleOpenAction(req, 'reject')}
                        className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject Request</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        Decision finalized by {req.processedByName || 'Admin'}. Wallet balance immutable.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Decision Modal */}
      {selectedReq && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4">
          <div className="bg-[#0b1222] border border-blue-900/80 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                {actionType === 'approve' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Approve Cash Addition</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-400" />
                    <span>Reject Cash Addition</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => {
                  setSelectedReq(null);
                  setActionType(null);
                }}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Player:</span>
                <span className="font-bold text-white">{selectedReq.userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">UID:</span>
                <span className="font-mono text-slate-300">{selectedReq.userId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Balance:</span>
                <span className="font-mono text-amber-400 font-bold">
                  ₹{WalletDataStore.getWallet(selectedReq.userId).balance}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Requested Amount:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  ₹{selectedReq.requestedAmount}
                </span>
              </div>
            </div>

            <form onSubmit={handleExecuteAction} className="space-y-3">
              {actionType === 'approve' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Confirmed Credit Amount (INR / Coins)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={customApprovedAmount}
                    onChange={(e) => setCustomApprovedAmount(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-emerald-400"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Will be credited immediately to player&apos;s wallet via secure server transaction.
                  </p>
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Internal Admin Note (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder={
                    actionType === 'approve'
                      ? 'e.g. Verified payment slip ref 99482. Approved.'
                      : 'e.g. Invalid transaction reference. Duplicate entry.'
                  }
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 resize-none"
                />
              </div>

              {feedbackMsg && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-semibold ${
                    feedbackMsg.error
                      ? 'bg-rose-950/50 text-rose-300 border border-rose-500/40'
                      : 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {feedbackMsg.text}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReq(null);
                    setActionType(null);
                  }}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition"
                >
                  Close
                </button>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition shadow cursor-pointer ${
                    actionType === 'approve'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-rose-500 hover:bg-rose-400 text-white'
                  }`}
                >
                  {isProcessing
                    ? 'Processing...'
                    : actionType === 'approve'
                    ? `Confirm & Credit ₹${customApprovedAmount}`
                    : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
