import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 max-w-sm mx-auto">
      <div className="flex items-center justify-between gap-3 bg-amber-500/90 text-slate-950 px-3.5 py-2 rounded-xl shadow-xl backdrop-blur-sm border border-amber-300/40">
        <div className="flex items-center gap-2 text-xs font-bold">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Offline Mode — Cached data is being used.</span>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="p-1 rounded-lg bg-slate-950/20 hover:bg-slate-950/40 transition shrink-0"
          title="Retry"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
