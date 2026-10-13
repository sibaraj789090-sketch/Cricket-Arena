import React, { useState } from 'react';
import {
  Trophy,
  Users,
  Calendar,
  Clock,
  CheckCircle,
  Play,
  Award,
  ShieldCheck,
  ChevronRight,
  Flame,
  Info,
  Medal,
} from 'lucide-react';
import {
  LudoTournament,
  LudoBracketMatch,
  LudoTournamentStatus,
} from '../../types';
import { LudoDataStore } from '../../lib/ludoStorage';
import { useAuth } from '../../context/AuthContext';

interface LudoTournamentViewProps {
  onStartPracticeMatch: () => void;
}

export const LudoTournamentView: React.FC<LudoTournamentViewProps> = ({ onStartPracticeMatch }) => {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<LudoTournament[]>(() =>
    LudoDataStore.getTournaments()
  );
  const [brackets, setBrackets] = useState<LudoBracketMatch[]>(() =>
    LudoDataStore.getBracketMatches()
  );
  const [activeTab, setActiveTab] = useState<
    'registration_open' | 'upcoming' | 'in_progress' | 'completed'
  >('registration_open');
  const [selectedTournament, setSelectedTournament] = useState<LudoTournament | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; error?: boolean } | null>(
    null
  );

  const registeredIds = user ? LudoDataStore.getRegisteredTournamentIds(user.id) : [];

  const handleRegister = (tour: LudoTournament) => {
    if (!user) {
      setFeedbackMessage({ text: 'Please sign in or use guest account to register.', error: true });
      return;
    }

    const res = LudoDataStore.registerForTournament(tour.id, user.id, user.name);
    if (res.success) {
      setTournaments(LudoDataStore.getTournaments());
      setFeedbackMessage({ text: `Successfully registered for "${tour.title}"! Entry is 100% free.` });
    } else {
      setFeedbackMessage({ text: res.error || 'Registration failed.', error: true });
    }

    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const filteredTournaments = tournaments.filter((t) => {
    if (activeTab === 'registration_open') return t.status === 'registration_open';
    if (activeTab === 'upcoming') return t.status === 'upcoming';
    if (activeTab === 'in_progress') return t.status === 'in_progress';
    if (activeTab === 'completed') return t.status === 'completed';
    return true;
  });

  // Get bracket matches for selected or active tournament
  const activeBracketTourId = selectedTournament?.id || 'ludo-tour-2';
  const tourBrackets = brackets.filter((b) => b.tournamentId === activeBracketTourId);

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-950 via-[#0f172a] to-emerald-950 border border-emerald-500/30 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500 text-slate-950 uppercase">
                FREE PLAY
              </span>
              <span className="text-xs text-amber-300 font-semibold">Skill Championship</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white mt-1">
              Ludo Arena Tournaments
            </h2>
            <p className="text-xs text-slate-300">
              Compete in 2-Player &amp; 4-Player single elimination brackets. Win skill points and championship badges!
            </p>
          </div>
          <button
            onClick={onStartPracticeMatch}
            className="hidden sm:flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-2 rounded-xl text-xs transition shadow shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Play Local Match</span>
          </button>
        </div>
      </div>

      {feedbackMessage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            feedbackMessage.error
              ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
              : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
          }`}
        >
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Navigation Filter Tabs */}
      <div className="flex items-center gap-1 bg-[#0f172a] p-1.5 rounded-2xl border border-slate-800 overflow-x-auto">
        {[
          { id: 'registration_open', label: '🟢 Open For Entry' },
          { id: 'in_progress', label: '🔴 In Progress (Brackets)' },
          { id: 'upcoming', label: '⏳ Upcoming' },
          { id: 'completed', label: '🏁 Completed' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tournaments List */}
      <div className="space-y-3">
        {filteredTournaments.length === 0 ? (
          <div className="bg-[#0f172a] border border-slate-800 p-8 rounded-2xl text-center text-xs text-slate-400">
            No tournaments found in this status category.
          </div>
        ) : (
          filteredTournaments.map((tour) => {
            const isRegistered = registeredIds.includes(tour.id);

            return (
              <div
                key={tour.id}
                className="bg-[#0f172a] border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-xl transition space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono">
                      {tour.format} FORMAT
                    </span>
                    <span className="text-[9px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 px-1.5 py-0.2 rounded font-bold">
                      ONLINE SKILL GAME
                    </span>
                    <span className="text-xs text-slate-300 font-medium">{tour.title}</span>
                  </div>

                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    Championship
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {tour.rulesDescription}
                </p>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{tour.enrolledCount} / {tour.maxParticipants} Joined</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{tour.roundsCount} Knockout Rounds</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 justify-end">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>{new Date(tour.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                {/* Winner announcement if completed */}
                {tour.winnerName && (
                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center gap-2 text-xs text-amber-300 font-bold">
                    <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Champion: {tour.winnerName} (+1,000 Points)</span>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-1 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedTournament(tour)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                  >
                    View Brackets
                  </button>

                  {tour.status === 'registration_open' && (
                    <button
                      onClick={() => handleRegister(tour)}
                      disabled={isRegistered || tour.enrolledCount >= tour.maxParticipants}
                      className={`px-4 py-1.5 rounded-xl font-bold text-xs transition shadow ${
                        isRegistered
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      }`}
                    >
                      {isRegistered ? 'Registered ✓' : 'Register Free'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Single Elimination Tournament Brackets Display */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Single-Elimination Knockout Brackets
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            {selectedTournament?.title || 'Super Ludo Duo Duel'}
          </span>
        </div>

        <div className="space-y-2.5 text-xs">
          {tourBrackets.map((match) => (
            <div
              key={match.id}
              className="bg-slate-900/90 rounded-xl border border-slate-800 p-3 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-emerald-400">
                    {match.roundName}
                  </span>
                  <span className={`text-[10px] font-semibold ${
                    match.status === 'completed' ? 'text-slate-400' : 'text-amber-400 animate-pulse'
                  }`}>
                    {match.status.toUpperCase()}
                  </span>
                </div>
                <p className="font-bold text-white">
                  {match.playerNames.join(' vs ')}
                </p>
              </div>

              {match.winnerName ? (
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Advanced:</span>
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {match.winnerName}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">In Play</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
