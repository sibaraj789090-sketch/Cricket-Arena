import React from 'react';
import { X } from 'lucide-react';
import { AuthView } from './AuthView';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
  onSuccessRedirect?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onSuccessRedirect,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-md my-auto">
        {/* Floating Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-400 hover:text-white transition shadow-lg border border-slate-700/60 cursor-pointer"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <AuthView
          initialMode={initialMode}
          onSuccess={() => {
            onClose();
            if (onSuccessRedirect) onSuccessRedirect();
          }}
          onCancel={onClose}
        />
      </div>
    </div>
  );
};
