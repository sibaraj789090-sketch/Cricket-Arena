import React, { useState } from 'react';
import { Trophy, Medal, Crown, Eye, X, Shield, ArrowUp, ArrowDown } from 'lucide-react';
import { Tournament, VirtualTeam } from '../../types';
import { useTournament } from '../../context/TournamentContext';
import { useAuth } from '../../context/AuthContext';
import { PitchView } from '../team/PitchView';

interface LeaderboardViewProps {
  initialTournamentId?: string;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ initialTournamentId }) => {
  const { tournaments, virtualTeams, players, cricketTeams } = useTournament();
  const { user } = useAuth();

  const [selectedTourId, setSelectedTourId] = useState<string>(
    initialTournamentId || tournaments[0]?.id || ''
  );
  const [inspectedTeam, setInspectedTeam] = useState<VirtualTeam | null>(null);

  const activeTournament = tournaments.find((t) => t.id === selectedTourId) || tournaments[0];

  // Teams for selected tournament sorted by totalPoints desc
  const leaderboard = virtualTeams
    .filter((vt) => vt.tournamentId === activeTournament?.id)
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((team, idx) => ({ ...team, rank: idx + 1 }));

  const userEntry = leaderboard.find((vt) => vt.userId === user?.id);

  // Inspected team player objects
  const inspectedSquad = inspectedTeam
    ? players.filter((p) => inspectedTeam.playerIds.includes(p.id))
    : [];

  return (
    <div className="space-y-4">
      {/* Tournament Selector */}
      <div className="bg-[#0f172a] p-3 rounded-2xl border border-slate-800 shadow">
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
          Select Tournament Leaderboard
        </label>
        <select
          value={selectedTourId}
          onChange={(e) => setSelectedTourId(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
        >
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} ({t.status.toUpperCase()})
            </option>
          ))}
        </select>
      </div>

      {/* Points & Standings Notice */}
      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
        <span>Verified Leaderboard • Match Engine Points Audited</span>
        <span className="text-[10px] bg-emerald-950/80 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-800/40">
          ONLINE SKILL GAME
        </span>
      </div>

      {/* User's Current Rank Card (if participated) */}
      {userEntry && (
        <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/40 p-3.5 rounded-2xl shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 font-black text-lg flex items-center justify-center shadow">
              #{userEntry.rank}
            </div>
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>{userEntry.teamName} (Your Squad)</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1 rounded">You</span>
              </p>
              <p className="text-[11px] text-slate-300">
                Captain: {players.find((p) => p.id === userEntry.captainId)?.name}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="font-mono text-base font-extrabold text-emerald-400">
              {userEntry.totalPoints} pts
            </span>
            <button
              onClick={() => setInspectedTeam(userEntry)}
              className="block text-[11px] text-slate-400 hover:text-white underline mt-0.5 ml-auto"
            >
              View Lineup
            </button>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Live Fantasy Standings ({leaderboard.length} Teams)
            </h3>
          </div>
          <span className="text-[11px] text-emerald-400 font-semibold">100% Free Entry</span>
        </div>

        {leaderboard.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No virtual teams created yet for this tournament. Be the first to join!
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60 text-xs">
            {leaderboard.map((team) => {
              const isCurrentUser = team.userId === user?.id;
              const captain = players.find((p) => p.id === team.captainId);
              const viceCaptain = players.find((p) => p.id === team.viceCaptainId);

              const getMedalColor = (rank: number) => {
                if (rank === 1) return 'text-amber-400';
                if (rank === 2) return 'text-slate-300';
                if (rank === 3) return 'text-amber-600';
                return 'text-slate-500';
              };

              return (
                <div
                  key={team.id}
                  onClick={() => setInspectedTeam(team)}
                  className={`p-3 flex items-center justify-between hover:bg-slate-800/50 cursor-pointer transition ${
                    isCurrentUser ? 'bg-emerald-950/20' : ''
                  }`}
                >
                  {/* Rank & Team Details */}
                  <div className="flex items-center gap-3">
                    <div className="w-7 text-center font-bold">
                      {team.rank && team.rank <= 3 ? (
                        <Medal className={`w-5 h-5 mx-auto ${getMedalColor(team.rank)}`} />
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">#{team.rank}</span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-white text-xs">{team.teamName}</p>
                        {isCurrentUser && (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded font-bold">
                            YOU
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        by {team.userName} • C: <span className="text-slate-300">{captain?.name.split(' ').slice(-1)[0]}</span> | VC: <span className="text-slate-300">{viceCaptain?.name.split(' ').slice(-1)[0]}</span>
                      </p>
                    </div>
                  </div>

                  {/* Points & Action */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-mono text-xs font-black text-emerald-400">
                        {team.totalPoints.toFixed(1)}
                      </p>
                      <p className="text-[10px] text-slate-400 leading-none">PTS</p>
                    </div>
                    <Eye className="w-4 h-4 text-slate-500 hover:text-white" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inspect Rival Squad Modal */}
      {inspectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#0b1329] border border-slate-700/80 rounded-2xl max-w-lg w-full p-4 text-slate-100 shadow-2xl my-auto flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                  Rank #{inspectedTeam.rank || '—'}
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  {inspectedTeam.teamName}
                </h3>
                <p className="text-xs text-slate-400">
                  Manager: {inspectedTeam.userName} • Total: {inspectedTeam.totalPoints} pts
                </p>
              </div>
              <button
                onClick={() => setInspectedTeam(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              <PitchView
                selectedPlayers={inspectedSquad}
                teams={cricketTeams}
                captainId={inspectedTeam.captainId}
                viceCaptainId={inspectedTeam.viceCaptainId}
              />
            </div>

            <div className="pt-3 mt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setInspectedTeam(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 font-bold rounded-xl text-xs text-slate-200"
              >
                Close Lineup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
