import React from 'react';
import { X, MapPin, Calendar, Users, Trophy, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Tournament } from '../../types';
import { useTournament } from '../../context/TournamentContext';

interface TournamentDetailsModalProps {
  tournament: Tournament | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateTeam: (tournament: Tournament) => void;
  onOpenLeaderboard: (tournament: Tournament) => void;
}

export const TournamentDetailsModal: React.FC<TournamentDetailsModalProps> = ({
  tournament,
  isOpen,
  onClose,
  onOpenCreateTeam,
  onOpenLeaderboard,
}) => {
  const { cricketTeams, players, pointsConfig } = useTournament();

  if (!isOpen || !tournament) return null;

  const teamA = cricketTeams.find((t) => t.id === tournament.teamAId);
  const teamB = cricketTeams.find((t) => t.id === tournament.teamBId);

  const teamAPlayers = players.filter((p) => p.teamId === tournament.teamAId);
  const teamBPlayers = players.filter((p) => p.teamId === tournament.teamBId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0b1329] border border-slate-700/80 rounded-2xl max-w-xl w-full p-4 sm:p-5 text-slate-100 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {tournament.format} Match Details
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white mt-1">
              {tournament.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Match Details Card */}
        <div className="space-y-3 text-xs text-slate-300 max-h-[60vh] overflow-y-auto pr-1">
          {/* Match Location & Time */}
          <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-slate-300">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><strong>Stadium:</strong> {tournament.venue}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Schedule:</strong> {new Date(tournament.startTime).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Users className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Participants:</strong> {tournament.enrolledCount} enrolled (Limit: {tournament.entryLimit})
              </span>
            </div>
          </div>

          {/* Teams Rosters Preview */}
          <div className="grid grid-cols-2 gap-2">
            {/* Team A */}
            <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800">
              <h4 className="font-bold text-white text-xs mb-1.5 flex items-center gap-1.5">
                <span>{teamA?.logo}</span>
                <span>{teamA?.name} ({teamAPlayers.length})</span>
              </h4>
              <div className="space-y-1">
                {teamAPlayers.slice(0, 6).map((p) => (
                  <div key={p.id} className="flex justify-between text-[11px] text-slate-300">
                    <span className="truncate">{p.name}</span>
                    <span className="font-mono text-emerald-400">{p.credits}Cr</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Team B */}
            <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800">
              <h4 className="font-bold text-white text-xs mb-1.5 flex items-center gap-1.5">
                <span>{teamB?.logo}</span>
                <span>{teamB?.name} ({teamBPlayers.length})</span>
              </h4>
              <div className="space-y-1">
                {teamBPlayers.slice(0, 6).map((p) => (
                  <div key={p.id} className="flex justify-between text-[11px] text-slate-300">
                    <span className="truncate">{p.name}</span>
                    <span className="font-mono text-emerald-400">{p.credits}Cr</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fair Play Notice */}
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-emerald-300 text-xs">Zero Cash &amp; Free Entry Policy</h4>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Participation in this tournament is 100% free. Fantasy rankings are strictly for cricket knowledge, skills, and entertainment. No deposit or real-money wagering is supported.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-800 pt-3 mt-3 flex items-center justify-between gap-2">
          <button
            onClick={() => {
              onClose();
              onOpenLeaderboard(tournament);
            }}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Leaderboard
          </button>
          <button
            onClick={() => {
              onClose();
              onOpenCreateTeam(tournament);
            }}
            className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition shadow-md"
          >
            Create My XI →
          </button>
        </div>
      </div>
    </div>
  );
};
