import React, { useState, useEffect } from 'react';
import { RefreshCw, X, Sparkles } from 'lucide-react';

export const UpdateNotification: React.FC = () => {
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    // Listen for service worker updates
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // controller changed, new version available
      });
    }
  }, []);

  const handleUpdate = () => {
    window.location.reload();
  };

  if (!needRefresh) return null;

  return (
    <div className="fixed top-14 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="flex items-center justify-between gap-3 bg-slate-900 border border-emerald-500/50 text-white px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="text-left">
            <p className="text-xs font-bold text-white">New Update Available</p>
            <p className="text-[11px] text-slate-300">A fresh version of Cricket Arena is ready.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUpdate}
            className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-2.5 py-1 rounded-lg text-xs transition"
          >
            <RefreshCw className="w-3 h-3" />
            Reload
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
