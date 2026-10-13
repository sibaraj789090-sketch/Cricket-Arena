import React, { useState, useMemo } from 'react';
import { X, Check, AlertCircle, Eye, List, Crown, ShieldAlert } from 'lucide-react';
import { Tournament, Player, PlayerRole } from '../../types';
import { useTournament } from '../../context/TournamentContext';
import { useAuth } from '../../context/AuthContext';
import { PitchView } from './PitchView';

interface CreateTeamModalProps {
  tournament: Tournament;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateTeamModal: React.FC<CreateTeamModalProps> = ({
  tournament,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { players, cricketTeams, getUserTeamForTournament, createOrUpdateVirtualTeam } = useTournament();
  const { user } = useAuth();

  const existingTeam = useMemo(
    () => getUserTeamForTournament(tournament.id),
    [getUserTeamForTournament, tournament.id]
  );

  // Available players for this match (Team A and Team B)
  const availablePlayers = useMemo(() => {
    return players.filter(
      (p) => p.teamId === tournament.teamAId || p.teamId === tournament.teamBId
    );
  }, [players, tournament.teamAId, tournament.teamBId]);

  // Squad State
  const [teamName, setTeamName] = useState<string>(
    existingTeam ? existingTeam.teamName : `${user?.name?.split(' ')[0] || 'My'} XI`
  );
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(
    existingTeam ? existingTeam.playerIds : []
  );
  const [captainId, setCaptainId] = useState<string>(existingTeam ? existingTeam.captainId : '');
  const [viceCaptainId, setViceCaptainId] = useState<string>(
    existingTeam ? existingTeam.viceCaptainId : ''
  );
  const [activeRoleTab, setActiveRoleTab] = useState<PlayerRole>('WK');
  const [viewMode, setViewMode] = useState<'list' | 'pitch'>('list');
  const [step, setStep] = useState<'squad' | 'cvc'>('squad'); // squad selection vs Captain/VC selection
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  // Selected squad players
  const squad = availablePlayers.filter((p) => selectedPlayerIds.includes(p.id));

  // Calculations
  const totalCreditsUsed = squad.reduce((sum, p) => sum + p.credits, 0);
  const remainingCredits = Math.round((100 - totalCreditsUsed) * 10) / 10;

  const teamACount = squad.filter((p) => p.teamId === tournament.teamAId).length;
  const teamBCount = squad.filter((p) => p.teamId === tournament.teamBId).length;

  const wkCount = squad.filter((p) => p.role === 'WK').length;
  const batCount = squad.filter((p) => p.role === 'BAT').length;
  const arCount = squad.filter((p) => p.role === 'AR').length;
  const bowlCount = squad.filter((p) => p.role === 'BOWL').length;

  const teamAInfo = cricketTeams.find((t) => t.id === tournament.teamAId);
  const teamBInfo = cricketTeams.find((t) => t.id === tournament.teamBId);

  // Toggle selection
  const handleTogglePlayer = (player: Player) => {
    setErrorMessage('');
    const isSelected = selectedPlayerIds.includes(player.id);

    if (isSelected) {
      setSelectedPlayerIds((prev) => prev.filter((id) => id !== player.id));
      if (captainId === player.id) setCaptainId('');
      if (viceCaptainId === player.id) setViceCaptainId('');
      return;
    }

    // Constraint validations before adding
    if (selectedPlayerIds.length >= 11) {
      setErrorMessage('You can only select exactly 11 cricketers.');
      return;
    }

    if (totalCreditsUsed + player.credits > 100) {
      setErrorMessage(`Not enough credits! This player requires ${player.credits} Cr.`);
      return;
    }

    const teamCount = squad.filter((p) => p.teamId === player.teamId).length;
    if (teamCount >= 7) {
      setErrorMessage(`Maximum 7 players allowed from a single team.`);
      return;
    }

    setSelectedPlayerIds((prev) => [...prev, player.id]);
  };

  const handleProceedToCVC = () => {
    setErrorMessage('');
    if (selectedPlayerIds.length !== 11) {
      setErrorMessage(`Select 11 players to continue. Currently: ${selectedPlayerIds.length}/11`);
      return;
    }
    if (wkCount < 1 || wkCount > 4) {
      setErrorMessage('Squad must have between 1 and 4 Wicket-Keepers (WK).');
      return;
    }
    if (batCount < 3 || batCount > 6) {
      setErrorMessage('Squad must have between 3 and 6 Batters (BAT).');
      return;
    }
    if (arCount < 1 || arCount > 4) {
      setErrorMessage('Squad must have between 1 and 4 All-Rounders (AR).');
      return;
    }
    if (bowlCount < 3 || bowlCount > 6) {
      setErrorMessage('Squad must have between 3 and 6 Bowlers (BOWL).');
      return;
    }
    if (totalCreditsUsed > 100) {
      setErrorMessage('Credit limit exceeded! Max 100 credits allowed.');
      return;
    }

    setStep('cvc');
  };

  const handleSubmitSquad = async () => {
    setErrorMessage('');
    if (!captainId || !viceCaptainId) {
      setErrorMessage('Please select both Captain and Vice-Captain.');
      return;
    }
    if (captainId === viceCaptainId) {
      setErrorMessage('Captain and Vice-Captain must be different players.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Server validation attempt
      try {
        await fetch('/api/teams/validate-and-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tournamentId: tournament.id,
            userId: user?.id,
            teamName,
            playerIds: selectedPlayerIds,
            captainId,
            viceCaptainId,
            squadCredits: totalCreditsUsed,
          }),
        });
      } catch (e) {
        console.warn('Server offline validation fallback', e);
      }

      // 2. Save in persistent store
      const res = createOrUpdateVirtualTeam(
        tournament.id,
        teamName,
        selectedPlayerIds,
        captainId,
        viceCaptainId
      );

      if (res.success) {
        setIsSubmitting(false);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || 'Failed to save virtual squad.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error creating virtual squad.');
      setIsSubmitting(false);
    }
  };

  const filteredPlayers = availablePlayers.filter((p) => p.role === activeRoleTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#0b1329] border border-slate-700/80 rounded-2xl max-w-xl w-full p-4 sm:p-5 text-slate-100 shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-2">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>{existingTeam ? 'Edit Virtual Squad' : 'Build Your Dream XI'}</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold">
                100.0 Cr Budget
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {teamAInfo?.shortName} vs {teamBInfo?.shortName} • {tournament.format}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Squad Status Header */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 mb-3">
          <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
            <div className="flex items-center gap-2">
              <span className="text-white">Selected:</span>
              <span className={`px-2 py-0.5 rounded ${
                selectedPlayerIds.length === 11 ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-800 text-emerald-400'
              }`}>
                {selectedPlayerIds.length} / 11
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Credits Left:</span>
              <span className={`font-mono ${remainingCredits < 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}`}>
                {remainingCredits.toFixed(1)} Cr
              </span>
            </div>
          </div>

          {/* Role Counts Indicator */}
          <div className="grid grid-cols-4 gap-1 text-[11px] text-center font-medium">
            <div className={`p-1 rounded ${wkCount >= 1 && wkCount <= 4 ? 'bg-emerald-950/60 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
              WK: {wkCount} <span className="text-[9px] opacity-70">(1-4)</span>
            </div>
            <div className={`p-1 rounded ${batCount >= 3 && batCount <= 6 ? 'bg-emerald-950/60 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
              BAT: {batCount} <span className="text-[9px] opacity-70">(3-6)</span>
            </div>
            <div className={`p-1 rounded ${arCount >= 1 && arCount <= 4 ? 'bg-emerald-950/60 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
              AR: {arCount} <span className="text-[9px] opacity-70">(1-4)</span>
            </div>
            <div className={`p-1 rounded ${bowlCount >= 3 && bowlCount <= 6 ? 'bg-emerald-950/60 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
              BOWL: {bowlCount} <span className="text-[9px] opacity-70">(3-6)</span>
            </div>
          </div>

          {/* Team balance indicator */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-800">
            <span>{teamAInfo?.shortName}: {teamACount}/7</span>
            <span>{teamBInfo?.shortName}: {teamBCount}/7</span>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="bg-rose-950/50 border border-rose-500/40 text-rose-300 px-3 py-2 rounded-xl text-xs flex items-center gap-2 mb-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: Squad Selection */}
        {step === 'squad' && (
          <>
            {/* View switcher & Role tabs */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 flex-1">
                {(['WK', 'BAT', 'AR', 'BOWL'] as PlayerRole[]).map((role) => (
                  <button
                    key={role}
                    onClick={() => setActiveRoleTab(role)}
                    className={`flex-1 py-1 text-xs font-bold rounded-lg transition ${
                      activeRoleTab === role
                        ? 'bg-emerald-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>

              {/* Pitch vs List Toggle */}
              <button
                onClick={() => setViewMode(viewMode === 'list' ? 'pitch' : 'list')}
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-emerald-400 border border-slate-700 transition"
              >
                {viewMode === 'list' ? <Eye className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
                <span>{viewMode === 'list' ? 'Pitch View' : 'List View'}</span>
              </button>
            </div>

            {/* Main Content Area */}
            {viewMode === 'pitch' ? (
              <div className="overflow-y-auto flex-1 pr-1">
                <PitchView
                  selectedPlayers={squad}
                  teams={cricketTeams}
                  captainId={captainId}
                  viceCaptainId={viceCaptainId}
                  onRemovePlayer={(pid) => handleTogglePlayer(players.find((p) => p.id === pid)!)}
                />
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 pr-1 space-y-1.5 min-h-[260px]">
                {filteredPlayers.map((player) => {
                  const isSelected = selectedPlayerIds.includes(player.id);
                  const playerTeam = cricketTeams.find((t) => t.id === player.teamId);

                  return (
                    <div
                      key={player.id}
                      onClick={() => handleTogglePlayer(player)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition select-none ${
                        isSelected
                          ? 'bg-emerald-950/40 border-emerald-500/60 shadow-md'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={player.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80'}
                          alt={player.name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-700"
                        />
                        <div>
                          <p className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>{player.name}</span>
                            <span className="text-[10px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                              {playerTeam?.shortName}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {player.matchesPlayed} matches • {player.totalRuns} runs • {player.totalWickets} wkts
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          {player.credits} Cr
                        </span>
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs transition ${
                            isSelected ? 'bg-emerald-500 text-slate-950' : 'border border-slate-600 text-slate-400'
                          }`}
                        >
                          {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '+'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Actions for Step 1 */}
            <div className="pt-3 mt-2 border-t border-slate-800 flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Team Name:
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="ml-2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white max-w-[140px]"
                />
              </div>

              <button
                onClick={handleProceedToCVC}
                disabled={selectedPlayerIds.length !== 11}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:pointer-events-none text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition shadow-lg active:scale-95"
              >
                Choose Captain &amp; VC →
              </button>
            </div>
          </>
        )}

        {/* STEP 2: Captain & Vice-Captain Selection */}
        {step === 'cvc' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 mb-3 text-xs">
              <div className="flex items-center gap-2 text-amber-300 font-bold mb-1">
                <Crown className="w-4 h-4" />
                Assign Leadership Multipliers
              </div>
              <p className="text-slate-300 text-[11px]">
                • <strong>Captain (C):</strong> Earns <span className="text-emerald-400 font-bold">2.0x</span> Fantasy Points.<br />
                • <strong>Vice-Captain (VC):</strong> Earns <span className="text-blue-400 font-bold">1.5x</span> Fantasy Points.
              </p>
            </div>

            {/* Selected squad list for C/VC */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-1.5 min-h-[260px]">
              {squad.map((player) => {
                const isCap = captainId === player.id;
                const isVC = viceCaptainId === player.id;
                const team = cricketTeams.find((t) => t.id === player.teamId);

                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src={player.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80'}
                        alt={player.name}
                        className="w-8 h-8 rounded-full object-cover border border-slate-700"
                      />
                      <div>
                        <p className="text-xs font-bold text-white">{player.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {team?.shortName} • {player.role}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Captain Selector */}
                      <button
                        onClick={() => {
                          setCaptainId(player.id);
                          if (viceCaptainId === player.id) setViceCaptainId('');
                        }}
                        className={`w-9 h-9 rounded-xl text-xs font-extrabold transition flex items-center justify-center ${
                          isCap
                            ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300'
                            : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                        }`}
                        title="Select as Captain (2x)"
                      >
                        C
                      </button>

                      {/* Vice Captain Selector */}
                      <button
                        onClick={() => {
                          setViceCaptainId(player.id);
                          if (captainId === player.id) setCaptainId('');
                        }}
                        className={`w-9 h-9 rounded-xl text-xs font-extrabold transition flex items-center justify-center ${
                          isVC
                            ? 'bg-blue-400 text-slate-950 shadow-md ring-2 ring-blue-300'
                            : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                        }`}
                        title="Select as Vice-Captain (1.5x)"
                      >
                        VC
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions for Step 2 */}
            <div className="pt-3 mt-2 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => setStep('squad')}
                className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-2 rounded-xl bg-slate-800"
              >
                ← Back to Squad
              </button>

              <button
                onClick={handleSubmitSquad}
                disabled={!captainId || !viceCaptainId || isSubmitting}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:pointer-events-none text-slate-950 font-extrabold px-5 py-2 rounded-xl text-xs transition shadow-lg active:scale-95"
              >
                {isSubmitting ? 'Saving Squad...' : 'Save & Join Tournament'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
