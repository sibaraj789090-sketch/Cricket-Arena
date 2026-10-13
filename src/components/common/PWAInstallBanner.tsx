import React, { useState } from 'react';
import { Download, X, Smartphone, Share } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (isInstalled || dismissed) return null;

  return (
    <>
      {isInstallable && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border-b border-emerald-500/30 px-4 py-2.5">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-base shrink-0 shadow-sm">
                🏏
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Install Cricket Arena App</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1 rounded">Fast & Light</span>
                </p>
                <p className="text-[11px] text-slate-300">
                  Instant match scores, offline view, and one-tap home screen access.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={install}
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-extrabold transition shadow-md active:scale-95 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>INSTALL</span>
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="p-1 text-slate-400 hover:text-white transition rounded cursor-pointer"
                aria-label="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {isIOS && !isInstallable && (
        <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 text-left">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-xs text-slate-300">
                Install on iPhone: Tap <Share className="w-3.5 h-3.5 inline mx-0.5 text-blue-400" /> Share then &quot;Add to Home Screen&quot;.
              </p>
            </div>
            <button
              onClick={() => setShowIOSModal(true)}
              className="text-[11px] font-semibold text-emerald-400 hover:underline shrink-0"
            >
              How-To
            </button>
          </div>
        </div>
      )}

      {/* iOS Instructions Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-6 max-w-sm w-full text-slate-100 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-emerald-400" />
              Install on iOS Safari
            </h3>
            <ol className="text-xs text-slate-300 space-y-2.5 my-4 list-decimal list-inside">
              <li>Open Safari browser and tap the <strong>Share</strong> icon in the bottom menu bar.</li>
              <li>Scroll down the share sheet and select <strong>&quot;Add to Home Screen&quot;</strong>.</li>
              <li>Tap <strong>Add</strong> in the top right corner.</li>
            </ol>
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
