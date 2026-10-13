import React, { useState } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { LudoColor } from '../../types';
import { LudoQuickMessage } from '../../types/ludoCash';
import { capitalize } from '../../lib/ludoEngine';

export const PRESET_QUICK_MESSAGES = [
  // Greetings & Sportsmanship
  { text: 'Good luck! 🍀', category: 'sportsmanship' },
  { text: 'Nice move! 👏', category: 'sportsmanship' },
  { text: 'Well played! 🔥', category: 'sportsmanship' },
  { text: 'Thanks! 🙏', category: 'sportsmanship' },
  { text: 'Hello! 👋', category: 'sportsmanship' },
  { text: 'GG! 🤝', category: 'sportsmanship' },

  // Match Situations & Banter
  { text: 'Need a 6! 🎲', category: 'banter' },
  { text: 'Hurry up! ⏳', category: 'banter' },
  { text: 'Oops! 😅', category: 'banter' },
  { text: 'Safe on Star! 🛡️', category: 'banter' },
  { text: 'King move! 👑', category: 'banter' },
  { text: 'What a roll! 😱', category: 'banter' },
];

interface LudoQuickChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
  recentMessages?: LudoQuickMessage[];
  currentUserId?: string;
  isSending?: boolean;
}

export const LudoQuickChatModal: React.FC<LudoQuickChatModalProps> = ({
  isOpen,
  onClose,
  onSend,
  recentMessages = [],
  currentUserId,
  isSending = false,
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'history'>('presets');
  const [lastSentText, setLastSentText] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectMessage = (text: string) => {
    if (isSending) return;
    setLastSentText(text);
    onSend(text);
    setTimeout(() => {
      onClose();
    }, 250);
  };

  const getColorBadge = (color: LudoColor) => {
    switch (color) {
      case 'red':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'green':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'yellow':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'blue':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#0c1322] border border-amber-500/40 rounded-3xl p-4 shadow-2xl space-y-3.5 text-slate-100 max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <MessageSquare className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                Quick Messages
              </h3>
              <p className="text-[10px] text-slate-400">
                Tap any message to send instantly to opponents
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'presets'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Quick Send</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Chat Log ({recentMessages.length})</span>
          </button>
        </div>

        {/* Content Body */}
        {activeTab === 'presets' ? (
          <div className="overflow-y-auto pr-1 space-y-3 flex-1 max-h-[50vh]">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                Sportsmanship & Greetings
              </span>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_QUICK_MESSAGES.filter((m) => m.category === 'sportsmanship').map((msg) => (
                  <button
                    key={msg.text}
                    type="button"
                    onClick={() => handleSelectMessage(msg.text)}
                    disabled={isSending}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold text-left transition border flex items-center justify-between active:scale-95 cursor-pointer ${
                      lastSentText === msg.text
                        ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                        : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 hover:border-amber-500/40 text-slate-200 hover:text-white'
                    }`}
                  >
                    <span className="truncate">{msg.text}</span>
                    <Send className="w-3 h-3 text-slate-500 shrink-0 ml-1 opacity-70" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                Game Reactions & Banter
              </span>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_QUICK_MESSAGES.filter((m) => m.category === 'banter').map((msg) => (
                  <button
                    key={msg.text}
                    type="button"
                    onClick={() => handleSelectMessage(msg.text)}
                    disabled={isSending}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold text-left transition border flex items-center justify-between active:scale-95 cursor-pointer ${
                      lastSentText === msg.text
                        ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                        : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 hover:border-amber-500/40 text-slate-200 hover:text-white'
                    }`}
                  >
                    <span className="truncate">{msg.text}</span>
                    <Send className="w-3 h-3 text-slate-500 shrink-0 ml-1 opacity-70" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto pr-1 space-y-2 flex-1 max-h-[50vh]">
            {recentMessages.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No messages yet. Send a quick message to your opponents!
              </div>
            ) : (
              recentMessages.map((msg) => {
                const isMe = msg.senderId === currentUserId;
                return (
                  <div
                    key={msg.id}
                    className={`p-2 rounded-xl border flex flex-col gap-0.5 text-xs ${
                      isMe
                        ? 'bg-emerald-950/40 border-emerald-500/30 ml-4'
                        : 'bg-slate-900/80 border-slate-800 mr-4'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`px-1.5 py-0.2 rounded border font-bold ${getColorBadge(msg.senderColor)}`}>
                        {isMe ? 'You' : msg.senderName} ({capitalize(msg.senderColor)})
                      </span>
                      <span className="text-slate-500 font-mono text-[9px]">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-white mt-0.5 pl-0.5">{msg.text}</p>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Footer info note */}
        <div className="pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-500 text-center shrink-0">
          Messages appear as animated speech bubbles above player dice.
        </div>
      </div>
    </div>
  );
};

/**
 * Animated speech bubble attached to a player's dice slot.
 * Automatically fades after 3.5 seconds.
 */
interface LudoSpeechBubbleProps {
  message: LudoQuickMessage | null;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const LudoSpeechBubble: React.FC<LudoSpeechBubbleProps> = ({ message, position }) => {
  if (!message) return null;

  const getBorderColor = (color: LudoColor) => {
    switch (color) {
      case 'red':
        return 'border-rose-500 bg-[#160b13]/95 shadow-rose-950/60 text-rose-200';
      case 'green':
        return 'border-emerald-500 bg-[#081812]/95 shadow-emerald-950/60 text-emerald-200';
      case 'yellow':
        return 'border-amber-400 bg-[#191507]/95 shadow-amber-950/60 text-amber-200';
      case 'blue':
        return 'border-blue-500 bg-[#081424]/95 shadow-blue-950/60 text-blue-200';
    }
  };

  // Tail positioning styles based on corner position
  const getTailPosition = () => {
    switch (position) {
      case 'top-left':
        return 'top-full left-4 -mt-1 border-t-slate-800';
      case 'top-right':
        return 'top-full right-4 -mt-1 border-t-slate-800';
      case 'bottom-left':
        return 'bottom-full left-4 -mb-1 border-b-slate-800';
      case 'bottom-right':
        return 'bottom-full right-4 -mb-1 border-b-slate-800';
    }
  };

  return (
    <div
      className={`absolute z-40 pointer-events-none transition-all duration-300 transform scale-100 ${
        position === 'top-left'
          ? 'top-full left-0 mt-1'
          : position === 'top-right'
          ? 'top-full right-0 mt-1'
          : position === 'bottom-left'
          ? 'bottom-full left-0 mb-1'
          : 'bottom-full right-0 mb-1'
      }`}
    >
      <div
        className={`relative px-2.5 py-1.5 rounded-2xl border-2 shadow-xl backdrop-blur-md max-w-[170px] sm:max-w-[200px] animate-bounce-short ${getBorderColor(
          message.senderColor
        )}`}
      >
        <div className="flex items-center gap-1 leading-none mb-0.5">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              message.senderColor === 'red'
                ? 'bg-rose-500'
                : message.senderColor === 'green'
                ? 'bg-emerald-500'
                : message.senderColor === 'yellow'
                ? 'bg-amber-400'
                : 'bg-blue-500'
            }`}
          />
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-300 truncate max-w-[120px]">
            {message.senderName}
          </span>
        </div>
        <p className="text-xs sm:text-sm font-black text-white leading-tight drop-shadow">
          {message.text}
        </p>
      </div>
    </div>
  );
};
