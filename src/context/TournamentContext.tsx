import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Tournament,
  CricketTeam,
  Player,
  VirtualTeam,
  AuditLog,
  PointsConfig,
  TournamentStatus,
} from '../types';
import { CricketDataStore } from '../lib/storage';
import { useAuth } from './AuthContext';

interface TournamentContextType {
  tournaments: Tournament[];
  cricketTeams: CricketTeam[];
  players: Player[];
  pointsConfig: PointsConfig;
  virtualTeams: VirtualTeam[];
  auditLogs: AuditLog[];
  joinedTournamentIds: string[];
  isJoined: (tournamentId: string) => boolean;
  getUserTeamForTournament: (tournamentId: string) => VirtualTeam | undefined;
  joinTournament: (tournamentId: string) => { success: boolean; error?: string };
  createOrUpdateVirtualTeam: (
    tournamentId: string,
    teamName: string,
    playerIds: string[],
    captainId: string,
    viceCaptainId: string
  ) => { success: boolean; error?: string; team?: VirtualTeam };
  // Admin Operations
  adminCreateTournament: (data: Omit<Tournament, 'id' | 'enrolledCount'>) => void;
  adminUpdateTournamentStatus: (tournamentId: string, status: TournamentStatus) => void;
  adminUpdatePlayerScores: (
    tournamentId: string,
    playerScores: Record<string, number>,
    notes?: string
  ) => Promise<{ success: boolean; message?: string }>;
  adminUpdatePointsConfig: (config: PointsConfig) => void;
  adminAddPlayer: (player: Omit<Player, 'id'>) => void;
  refreshData: () => void;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin } = useAuth();

  const [tournaments, setTournaments] = useState<Tournament[]>(() => CricketDataStore.getTournaments());
  const [cricketTeams, setCricketTeams] = useState<CricketTeam[]>(() => CricketDataStore.getCricketTeams());
  const [players, setPlayers] = useState<Player[]>(() => CricketDataStore.getPlayers());
  const [pointsConfig, setPointsConfig] = useState<PointsConfig>(() => CricketDataStore.getPointsConfig());
  const [virtualTeams, setVirtualTeams] = useState<VirtualTeam[]>(() => CricketDataStore.getVirtualTeams());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => CricketDataStore.getAuditLogs());
  const [joinedTournamentIds, setJoinedTournamentIds] = useState<string[]>(() =>
    CricketDataStore.getJoinedTournamentIds()
  );

  const refreshData = () => {
    setTournaments(CricketDataStore.getTournaments());
    setCricketTeams(CricketDataStore.getCricketTeams());
    setPlayers(CricketDataStore.getPlayers());
    setPointsConfig(CricketDataStore.getPointsConfig());
    setVirtualTeams(CricketDataStore.getVirtualTeams());
    setAuditLogs(CricketDataStore.getAuditLogs());
    setJoinedTournamentIds(CricketDataStore.getJoinedTournamentIds());
  };

  const isJoined = (tournamentId: string) => {
    return joinedTournamentIds.includes(tournamentId);
  };

  const getUserTeamForTournament = (tournamentId: string) => {
    if (!user) return undefined;
    return virtualTeams.find((vt) => vt.tournamentId === tournamentId && vt.userId === user.id);
  };

  const joinTournament = (tournamentId: string): { success: boolean; error?: string } => {
    if (!user) {
      return { success: false, error: 'Please log in to join tournaments.' };
    }

    const tournament = tournaments.find((t) => t.id === tournamentId);
    if (!tournament) {
      return { success: false, error: 'Tournament not found.' };
    }

    if (tournament.status === 'completed') {
      return { success: false, error: 'Tournament has already finished.' };
    }

    if (tournament.enrolledCount >= tournament.entryLimit) {
      return { success: false, error: 'Tournament entry limit reached.' };
    }

    const success = CricketDataStore.joinTournament(tournamentId, user.id);
    if (success) {
      setJoinedTournamentIds(CricketDataStore.getJoinedTournamentIds());
      setTournaments(CricketDataStore.getTournaments());
      return { success: true };
    }

    return { success: false, error: 'You have already joined this free tournament.' };
  };

  const createOrUpdateVirtualTeam = (
    tournamentId: string,
    teamName: string,
    playerIds: string[],
    captainId: string,
    viceCaptainId: string
  ): { success: boolean; error?: string; team?: VirtualTeam } => {
    if (!user) {
      return { success: false, error: 'Please log in to create a team.' };
    }

    const tournament = tournaments.find((t) => t.id === tournamentId);
    if (!tournament) {
      return { success: false, error: 'Tournament not found.' };
    }

    if (tournament.status === 'completed') {
      return { success: false, error: 'Tournament has ended. Team changes locked.' };
    }

    const res = CricketDataStore.validateAndCreateVirtualTeam(
      tournamentId,
      user.id,
      user.name,
      teamName,
      playerIds,
      captainId,
      viceCaptainId
    );

    if (res.success) {
      refreshData();
    }

    return res;
  };

  // ADMIN OPERATIONS
  const adminCreateTournament = (data: Omit<Tournament, 'id' | 'enrolledCount'>) => {
    if (!isAdmin) {
      alert('Unauthorized: Only administrators can create tournaments.');
      return;
    }

    const newTournament: Tournament = {
      ...data,
      id: `tour-${Date.now()}`,
      enrolledCount: 0,
    };

    const updated = [newTournament, ...tournaments];
    CricketDataStore.saveTournaments(updated);
    setTournaments(updated);

    // Audit Log
    const newLog = CricketDataStore.addAuditLog({
      adminId: user?.id || 'admin-master',
      adminName: user?.name || 'Administrator',
      action: 'TOURNAMENT_CREATED',
      targetType: 'tournament',
      targetId: newTournament.id,
      details: `Created new tournament: "${newTournament.title}" (${newTournament.format})`,
    });
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const adminUpdateTournamentStatus = (tournamentId: string, status: TournamentStatus) => {
    if (!isAdmin) return;

    const updated = tournaments.map((t) => (t.id === tournamentId ? { ...t, status } : t));
    CricketDataStore.saveTournaments(updated);
    setTournaments(updated);

    const targetTour = tournaments.find((t) => t.id === tournamentId);
    const newLog = CricketDataStore.addAuditLog({
      adminId: user?.id || 'admin-master',
      adminName: user?.name || 'Administrator',
      action: 'TOURNAMENT_STATUS_CHANGED',
      targetType: 'tournament',
      targetId: tournamentId,
      details: `Status changed to ${status.toUpperCase()} for "${targetTour?.title || tournamentId}"`,
    });
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const adminUpdatePlayerScores = async (
    tournamentId: string,
    playerScores: Record<string, number>,
    notes?: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!isAdmin) {
      return { success: false, message: 'Unauthorized: Admin role required.' };
    }

    // 1. Recalculate virtual teams points locally
    CricketDataStore.recalculateTournamentScores(tournamentId, playerScores);

    // 2. Add audit log
    const newLog = CricketDataStore.addAuditLog({
      adminId: user?.id || 'admin-master',
      adminName: user?.name || 'Administrator',
      action: 'SCORE_UPDATE',
      targetType: 'score',
      targetId: tournamentId,
      details: notes || `Scores updated for ${Object.keys(playerScores).length} players. Leaderboard recalculated.`,
    });

    // 3. Optional server sync
    try {
      await fetch('/api/admin/scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
          'x-admin-key': 'cricket-arena-master-2026',
        },
        body: JSON.stringify({
          tournamentId,
          playerScores,
          adminName: user?.name || 'Administrator',
        }),
      });
    } catch (err) {
      console.warn('Server sync skipped in offline/preview mode', err);
    }

    refreshData();
    return { success: true, message: 'Scores and leaderboard updated successfully!' };
  };

  const adminUpdatePointsConfig = (config: PointsConfig) => {
    if (!isAdmin) return;

    CricketDataStore.savePointsConfig(config);
    setPointsConfig(config);

    const newLog = CricketDataStore.addAuditLog({
      adminId: user?.id || 'admin-master',
      adminName: user?.name || 'Administrator',
      action: 'POINTS_RULE_MODIFIED',
      targetType: 'points_rule',
      targetId: config.id,
      details: `Points rule configuration modified: ${config.title}`,
    });
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const adminAddPlayer = (playerData: Omit<Player, 'id'>) => {
    if (!isAdmin) return;

    const newPlayer: Player = {
      ...playerData,
      id: `p-${Date.now()}`,
    };

    const updated = [newPlayer, ...players];
    CricketDataStore.savePlayers(updated);
    setPlayers(updated);

    const newLog = CricketDataStore.addAuditLog({
      adminId: user?.id || 'admin-master',
      adminName: user?.name || 'Administrator',
      action: 'PLAYER_ADDED',
      targetType: 'player',
      targetId: newPlayer.id,
      details: `Added new cricketer: ${newPlayer.name} (${newPlayer.role}, ${newPlayer.credits} Cr)`,
    });
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  return (
    <TournamentContext.Provider
      value={{
        tournaments,
        cricketTeams,
        players,
        pointsConfig,
        virtualTeams,
        auditLogs,
        joinedTournamentIds,
        isJoined,
        getUserTeamForTournament,
        joinTournament,
        createOrUpdateVirtualTeam,
        adminCreateTournament,
        adminUpdateTournamentStatus,
        adminUpdatePlayerScores,
        adminUpdatePointsConfig,
        adminAddPlayer,
        refreshData,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
};

export const useTournament = () => {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return context;
};
