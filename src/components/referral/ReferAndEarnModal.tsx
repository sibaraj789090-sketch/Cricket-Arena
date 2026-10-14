import React, { useState, useEffect } from 'react';
import {
  X,
  Gift,
  Copy,
  Check,
  Share2,
  Users,
  Coins,
  Sparkles,
  ArrowRight,
  ExternalLink,
  MessageCircle,
  Send,
  ShieldCheck,
  Award,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ReferralStats } from '../../types';

interface ReferAndEarnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth?: (mode: 'login' | 'signup') => void;
}

export const ReferAndEarnModal: React.FC<ReferAndEarnModalProps> = ({
  isOpen,
  onClose,
  onOpenAuth,
}) => {
  const { user, isGuest, getReferralStats } = useAuth();

  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Fallback referral code if not yet loaded from server
  const myReferralCode = user?.referralCode || (user?.id ? `CRIC-${user.id.slice(-5).toUpperCase()}` : 'CRIC-ARENA');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cricketarena.app';
  const myInviteLink = stats?.inviteLink || `${origin}?ref=${myReferralCode}`;

  useEffect(() => {
    if (!isOpen || isGuest || !user?.id) return;

    let isMounted = true;
    setIsLoading(true);

    getReferralStats(user.id).then((data) => {
      if (isMounted) {
        setStats(data);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, user?.id, isGuest, getReferralStats]);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(myReferralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(myInviteLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const shareText = `🏏 Join Cricket Arena with my invite code *${myReferralCode}* to get ₹50 Welcome Bonus Credits instantly! Play Fantasy Cricket & Real Ludo Matches with Zero OTP verification.\n\nSign up here: ${myInviteLink}`;

  const handleShareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleShareTelegram = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(myInviteLink)}&text=${encodeURIComponent(
      `🏏 Join Cricket Arena with code ${myReferralCode} for ₹50 Bonus Credits!`
    )}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Cricket Arena - Refer & Earn ₹50',
          text: shareText,
          url: myInviteLink,
        });
      } catch {}
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#0c1322] border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 my-auto overflow-hidden">
        {/* Glow Accents */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 shadow-md">
            <Gift className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-full">
              Unlimited Rewards
            </span>
          </div>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
          Refer &amp; Earn Bonus Coins
        </h2>
        <p className="text-xs text-slate-300 mt-1">
          Earn <strong className="text-amber-400">₹50 Bonus Coins</strong> for every friend who joins.
          Your friend also gets <strong className="text-emerald-400">₹50 Welcome Bonus</strong>!
        </p>

        {/* Guest Mode Callout */}
        {isGuest ? (
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-amber-950/50 via-[#141b2d] to-slate-900 border border-amber-500/40">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-white">Sign In to Unlock Your Invite Link</h4>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  You are currently playing as a guest. Create your free account in under 30 seconds (No OTP) to get your personal referral code and earn unlimited cash rewards.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      onClose();
                      if (onOpenAuth) onOpenAuth('signup');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Register Free (No OTP)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      onClose();
                      if (onOpenAuth) onOpenAuth('login');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition cursor-pointer"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Dashboard Ribbon */}
            <div className="grid grid-cols-3 gap-2.5 mt-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-2.5 text-center">
                <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                  {stats?.referralsCount ?? (user?.referralsCount || 0)}
                </span>
                <p className="text-[10px] text-slate-400 font-medium">Friends Invited</p>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-2.5 text-center">
                <span className="text-base sm:text-lg font-black text-amber-400 font-mono">
                  ₹{stats?.totalBonusEarned ?? (user?.totalReferralEarnings || 0)}
                </span>
                <p className="text-[10px] text-slate-400 font-medium">Total Bonus Won</p>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-2.5 text-center">
                <span className="text-base sm:text-lg font-black text-white font-mono">
                  ₹50
                </span>
                <p className="text-[10px] text-slate-400 font-medium">Per Signup</p>
              </div>
            </div>

            {/* Referral Code & Link Box */}
            <div className="mt-4 space-y-2.5 bg-gradient-to-b from-[#131d33] to-[#0c1424] border border-amber-500/40 rounded-2xl p-3.5 sm:p-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Your Referral Code
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-slate-950/90 border border-slate-700 rounded-xl px-3.5 py-2 font-mono font-black text-base sm:text-lg tracking-widest text-amber-400">
                    {myReferralCode}
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs transition shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-slate-950" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-950" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Your Personal Invite Link
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    readOnly
                    value={myInviteLink}
                    className="flex-1 bg-slate-950/90 border border-slate-700 rounded-xl px-3 py-2 font-mono text-[11px] text-slate-300 truncate focus:outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-xs border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Instant Social Share Buttons */}
              <div className="pt-2 border-t border-slate-800/80">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Share Instantly:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={handleShareWhatsApp}
                    className="py-2 px-2.5 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    onClick={handleShareTelegram}
                    className="py-2 px-2.5 rounded-xl bg-[#0088cc]/20 hover:bg-[#0088cc]/30 text-[#38bdf8] border border-[#0088cc]/40 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Telegram</span>
                  </button>
                  <button
                    onClick={handleNativeShare}
                    className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share...</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Referral History / Invited Friends */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Referral History ({stats?.referrals?.length || 0})</span>
                </h4>
                <span className="text-[10px] text-slate-400">Instant credit per signup</span>
              </div>

              {stats && stats.referrals && stats.referrals.length > 0 ? (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {stats.referrals.map((ref) => (
                    <div
                      key={ref.id}
                      className="bg-slate-900/70 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                          {ref.refereeName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-white text-xs leading-none">
                            {ref.refereeName}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {ref.refereeIdentifier} • {new Date(ref.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          +₹{ref.bonusCoins} Won
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-4 text-center">
                  <Coins className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                  <p className="text-xs text-slate-400 font-medium">No referrals yet</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Share your invite link above on WhatsApp or social apps to start earning!
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* 3-Step Explainer */}
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
            How Refer &amp; Earn Works
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-900/60 border border-slate-800/70 rounded-xl p-2">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-black text-[11px] inline-flex items-center justify-center mb-1">
                1
              </span>
              <p className="text-[11px] font-bold text-white">Share Link</p>
              <p className="text-[9px] text-slate-400 mt-0.5 leading-snug">
                Send your invite link to friends
              </p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/70 rounded-xl p-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-[11px] inline-flex items-center justify-center mb-1">
                2
              </span>
              <p className="text-[11px] font-bold text-white">Friend Registers</p>
              <p className="text-[9px] text-slate-400 mt-0.5 leading-snug">
                Zero OTP, Gmail or Mobile login
              </p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/70 rounded-xl p-2">
              <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-black text-[11px] inline-flex items-center justify-center mb-1">
                3
              </span>
              <p className="text-[11px] font-bold text-white">Win ₹50 Each</p>
              <p className="text-[9px] text-slate-400 mt-0.5 leading-snug">
                Bonus coins added instantly
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
