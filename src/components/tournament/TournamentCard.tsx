import React from 'react';
import { Calendar, MapPin, Users, CheckCircle, Trophy, Clock, Play } from 'lucide-react';
import { Tournament, CricketTeam } from '../../types';
import { useTournament } from '../../context/TournamentContext';

interface TournamentCardProps {
  tournament: Tournament;
  onOpenDetails: (tournament: Tournament) => void;
  onOpenCreateTeam: (tournament: Tournament) => void;
  onOpenLeaderboard: (tournament: Tournament) => void;
}

export const TournamentCard: React.FC<TournamentCardProps> = ({
  tournament,
  onOpenDetails,
  onOpenCreateTeam,
  onOpenLeaderboard,
}) => {
  const { cricketTeams, isJoined, getUserTeamForTournament } = useTournament();

  const teamA = cricketTeams.find((t) => t.id === tournament.teamAId);
  const teamB = cricketTeams.find((t) => t.id === tournament.teamBId);
  const joined = isJoined(tournament.id);
  const userTeam = getUserTeamForTournament(tournament.id);

  const fillPercentage = Math.min(
    100,
    Math.round((tournament.enrolledCount / tournament.entryLimit) * 100)
  );

  const getStatusBadge = () => {
    switch (tournament.status) {
      case 'live':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/40">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            LIVE MATCH
          </span>
        );
      case 'upcoming':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            UPCOMING
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            COMPLETED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-[#0f172a]/95 border border-slate-800 hover:border-slate-700/80 rounded-2xl overflow-hidden shadow-xl transition-all duration-200">
      {/* Top Banner Bar */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 px-4 py-2 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            {tournament.format}
          </span>
          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/40">
            ONLINE SKILL GAME
          </span>
          <span className="text-xs text-slate-300 font-medium truncate max-w-[170px] sm:max-w-xs">
            {tournament.title}
          </span>
        </div>
        <div>{getStatusBadge()}</div>
      </div>

      {/* Main Body */}
      <div className="p-4">
        {/* Teams Faceoff */}
        <div className="flex items-center justify-between my-2">
          {/* Team A */}
          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shadow">
              {teamA?.logo || '🏏'}
            </div>
            <div>
              <p className="font-teko text-2xl font-bold tracking-wide text-white leading-none">
                {teamA?.shortName || 'T1'}
              </p>
              <p className="text-[11px] text-slate-400 leading-none">{teamA?.name}</p>
            </div>
          </div>

          {/* VS Divider */}
          <div className="px-3 text-center">
            <span className="font-teko text-lg text-emerald-400 font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800">
              VS
            </span>
          </div>

          {/* Team B */}
          <div className="flex items-center gap-3 flex-1 justify-end text-right">
            <div>
              <p className="font-teko text-2xl font-bold tracking-wide text-white leading-none">
                {teamB?.shortName || 'T2'}
              </p>
              <p className="text-[11px] text-slate-400 leading-none">{teamB?.name}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shadow">
              {teamB?.logo || '🏏'}
            </div>
          </div>
        </div>

        {/* Venue & Date */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 truncate max-w-[200px]">
            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate">{tournament.venue}</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-slate-300 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{new Date(tournament.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        {/* Spots & Free Entry Tag */}
        <div className="mt-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              FREE ENTRY
            </span>
            <span className="text-slate-400 text-[11px]">
              {tournament.enrolledCount.toLocaleString()} / {tournament.entryLimit.toLocaleString()} spots
            </span>
          </div>
          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-300"
              style={{ width: `${fillPercentage}%` }}
            />
          </div>
        </div>

        {/* User Squad Status (if joined) */}
        {userTeam && (
          <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Squad: {userTeam.teamName}</span>
            </div>
            <span className="text-white font-mono font-bold">
              {userTeam.totalPoints} pts
            </span>
          </div>
        )}

        {/* Actions Footer */}
        <div className="mt-3 pt-2 flex items-center gap-2">
          {/* Join / Edit Squad Button */}
          {tournament.status !== 'completed' ? (
            <button
              onClick={() => onOpenCreateTeam(tournament)}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 px-3 rounded-xl text-xs transition shadow-md active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Trophy className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{userTeam ? 'Edit My XI' : 'Join Free & Pick XI'}</span>
            </button>
          ) : (
            <button
              onClick={() => onOpenLeaderboard(tournament)}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>View Results</span>
            </button>
          )}

          {/* Leaderboard Button */}
          <button
            onClick={() => onOpenLeaderboard(tournament)}
            className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 text-xs font-semibold transition"
            title="Leaderboard Rankings"
          >
            Leaderboard
          </button>

          {/* Details */}
          <button
            onClick={() => onOpenDetails(tournament)}
            className="px-2.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60 text-xs transition"
            title="Match Details"
          >
            Info
          </button>
        </div>
      </div>
    </div>
  );
};
