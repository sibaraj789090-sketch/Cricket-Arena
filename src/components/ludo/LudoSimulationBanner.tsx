import React from 'react';
import { AlertTriangle, ShieldCheck, Zap } from 'lucide-react';

interface LudoSimulationBannerProps {
  simulatedOutcome?: string;
  testTokenStake?: number;
}

export const LudoSimulationBanner: React.FC<LudoSimulationBannerProps> = ({
  simulatedOutcome = 'random',
  testTokenStake = 50,
}) => {
  return (
    <div className="w-full bg-gradient-to-r from-amber-950/90 via-amber-900/90 to-amber-950/90 border-2 border-amber-500 rounded-2xl p-3 shadow-2xl text-amber-200 animate-pulse">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wider uppercase text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/50">
                QA TEST SIMULATION
              </span>
              <span className="text-[11px] font-bold text-amber-400/90 uppercase">
                NOT A REAL MATCH
              </span>
            </div>
            <p className="text-[11px] text-amber-200/90 mt-0.5 font-medium">
              Isolated Test Tokens: <span className="font-mono font-bold text-white">{testTokenStake} TEST</span> • Zero Real Cash • Outcome Mode:{' '}
              <span className="font-bold uppercase text-white bg-amber-800/80 px-1.5 py-0.2 rounded">
                {simulatedOutcome.replace('_', ' ')}
              </span>
            </p>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end text-[10px] text-amber-300/80 font-mono">
          <span className="flex items-center gap-1 font-bold text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" /> Isolated Sandbox
          </span>
          <span>Balances Protected</span>
        </div>
      </div>
    </div>
  );
};
