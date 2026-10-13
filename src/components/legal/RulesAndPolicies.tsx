import React, { useState } from 'react';
import { ShieldCheck, Award, Info, Mail, BookOpen, AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import { useTournament } from '../../context/TournamentContext';

interface RulesAndPoliciesProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSection?: 'rules' | 'points' | 'terms' | 'privacy' | 'contact';
}

export const RulesAndPolicies: React.FC<RulesAndPoliciesProps> = ({
  isOpen,
  onClose,
  defaultSection = 'rules',
}) => {
  const [activeTab, setActiveTab] = useState<'rules' | 'points' | 'terms' | 'privacy' | 'contact'>(
    defaultSection
  );
  const { pointsConfig } = useTournament();

  if (!isOpen) return null;

  const { batting, bowling, fielding, multipliers } = pointsConfig.rules;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0b1329] border border-slate-700/80 rounded-2xl max-w-2xl w-full p-4 sm:p-6 text-slate-100 shadow-2xl my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              Rules, Fair Play &amp; Platform Policies
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 mb-4 overflow-x-auto">
          {[
            { id: 'rules', label: 'Squad Rules' },
            { id: 'points', label: 'Points System' },
            { id: 'terms', label: 'Fair Play Terms' },
            { id: 'privacy', label: 'Privacy' },
            { id: 'contact', label: 'Contact' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="text-xs text-slate-300 max-h-[55vh] overflow-y-auto pr-1 space-y-4">
          {activeTab === 'rules' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl">
                <h3 className="font-bold text-emerald-400 text-sm mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Virtual Cricket Team Selection Rules
                </h3>
                <p className="text-slate-300 leading-relaxed">
                  Every user creates a fantasy squad of exactly 11 cricketers within the 100.0 credit budget.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-200">
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-bold block mb-0.5">Wicket-Keepers (WK)</span>
                  <p className="text-[11px] text-slate-400">Select 1 to 4 keepers</p>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-bold block mb-0.5">Batters (BAT)</span>
                  <p className="text-[11px] text-slate-400">Select 3 to 6 batters</p>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-bold block mb-0.5">All-Rounders (AR)</span>
                  <p className="text-[11px] text-slate-400">Select 1 to 4 all-rounders</p>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-bold block mb-0.5">Bowlers (BOWL)</span>
                  <p className="text-[11px] text-slate-400">Select 3 to 6 bowlers</p>
                </div>
              </div>

              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <h4 className="font-bold text-white text-xs">Crucial Guidelines:</h4>
                <p>• <strong>Max 7 Players Per Team:</strong> You can select at most 7 players from any single competing cricket team.</p>
                <p>• <strong>Captain:</strong> Receives <strong className="text-emerald-400">{multipliers.captain}x</strong> Fantasy Points.</p>
                <p>• <strong>Vice-Captain:</strong> Receives <strong className="text-emerald-400">{multipliers.viceCaptain}x</strong> Fantasy Points.</p>
                <p>• <strong>Match Lock:</strong> Squad submissions are locked once match play begins.</p>
              </div>
            </div>
          )}

          {activeTab === 'points' && (
            <div className="space-y-3">
              <p className="text-slate-400">
                Official scoring matrix for {pointsConfig.title}:
              </p>

              {/* Batting points table */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-3">
                <h4 className="font-bold text-emerald-400 mb-2">Batting Points</h4>
                <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-[11px]">
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span>Each Run</span>
                    <span className="font-bold text-white">+{batting.run} pt</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span>Boundary (4)</span>
                    <span className="font-bold text-white">+{batting.boundaryFour} pt</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span>Six (6)</span>
                    <span className="font-bold text-white">+{batting.six} pts</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span>Half-Century (50)</span>
                    <span className="font-bold text-white">+{batting.halfCentury} pts</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span>Century (100)</span>
                    <span className="font-bold text-white">+{batting.century} pts</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span>Duck (Dismissed for 0)</span>
                    <span className="font-bold text-rose-400">{batting.duck} pts</span>
                  </div>
                </div>
              </div>

              {/* Bowling points table */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-3">
                <h4 className="font-bold text-emerald-400 mb-2">Bowling Points</h4>
                <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-[11px]">
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span>Wicket (Excl. Run Out)</span>
                    <span className="font-bold text-white">+{bowling.wicket} pts</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span>Maiden Over</span>
                    <span className="font-bold text-white">+{bowling.maidenOver} pts</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span>3 Wicket Haul Bonus</span>
                    <span className="font-bold text-white">+{bowling.threeWickets} pts</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span>5 Wicket Haul Bonus</span>
                    <span className="font-bold text-white">+{bowling.fiveWickets} pts</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span>Dot Ball</span>
                    <span className="font-bold text-white">+{bowling.dotBall} pt</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span>Economy &lt; 6.0 RPO</span>
                    <span className="font-bold text-white">+{bowling.economyBelow6} pts</span>
                  </div>
                </div>
              </div>

              {/* Fielding points table */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-3">
                <h4 className="font-bold text-emerald-400 mb-2">Fielding Points</h4>
                <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-[11px]">
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span>Catch</span>
                    <span className="font-bold text-white">+{fielding.catch} pts</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span>Stumping</span>
                    <span className="font-bold text-white">+{fielding.stumping} pts</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span>Run Out (Direct Hit)</span>
                    <span className="font-bold text-white">+{fielding.runOutDirect} pts</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span>3 Catches Bonus</span>
                    <span className="font-bold text-white">+{fielding.threeCatchesBonus} pts</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-200">
                <h4 className="font-bold text-sm mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Coins Wallet, Deposits &amp; Withdrawal Policy
                </h4>
                <p className="leading-relaxed">
                  Cricket Arena provides a virtual Coin Wallet for in-app participation. All financial operations follow verified server-side validation and auditable ledger accounting.
                </p>
              </div>

              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-xs">Wallet &amp; Payment Guidelines:</h4>
                <p>1. <strong>Deposit Limits:</strong> Minimum deposit is <strong>₹100</strong> and maximum single deposit is <strong>₹1,00,000</strong>. Verified via secure server payment order verification.</p>
                <p>2. <strong>Withdrawal Policy:</strong> Minimum withdrawal is <strong>₹110</strong> and maximum withdrawal is <strong>₹50,000</strong>. Requests are reviewed and processed by authorized administrators to your verified UPI ID or Bank Account.</p>
                <p>3. <strong>Idempotency &amp; Protection:</strong> Coins are credited exactly once per verified payment gateway reference. Duplicate requests and negative balances are mathematically prevented.</p>
                <p>4. <strong>No Speculation:</strong> In-game coins are not an investment, cryptocurrency, or speculative asset.</p>
                <p>5. <strong>Fair Play &amp; Anti-Fraud:</strong> Automated bots, chargeback manipulation, and unauthorized exploits result in account suspension and ledger reversal.</p>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-2.5 bg-slate-900 p-3.5 rounded-xl border border-slate-800">
              <h4 className="font-bold text-white text-xs mb-1">Privacy Policy</h4>
              <p>• We collect only basic authentication details (email address and username) required to save your virtual teams.</p>
              <p>• We do not sell or monetize personal user data with third-party advertisers.</p>
              <p>• PWA service workers cache only static scripts and icon assets for offline rendering; private personal credentials and profile records are never cached insecurely in public storage.</p>
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="space-y-3 bg-slate-900 p-3.5 rounded-xl border border-slate-800">
              <h4 className="font-bold text-white text-xs mb-1 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-emerald-400" />
                Contact Cricket Arena Support
              </h4>
              <p className="text-slate-300 leading-relaxed">
                Have questions regarding fantasy points calculation, tournament schedules, or technical issues? Feel free to reach out to our team.
              </p>
              <div className="p-2.5 bg-[#070b14] rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-300">
                Email: support@cricketarena.app<br />
                Response time: Within 24-48 business hours
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-3 mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
