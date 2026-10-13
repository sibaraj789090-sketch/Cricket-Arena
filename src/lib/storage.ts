import {
  Tournament,
  CricketTeam,
  Player,
  VirtualTeam,
  AuditLog,
  PointsConfig,
  PlayerMatchScore,
  UserProfile,
} from '../types';
import {
  INITIAL_CRICKET_TEAMS,
  INITIAL_PLAYERS,
  INITIAL_TOURNAMENTS,
  INITIAL_LEADERBOARD,
  INITIAL_AUDIT_LOGS,
  DEMO_USER_PROFILE,
} from './initialData';
import { DEFAULT_POINTS_CONFIG, calculatePlayerScore } from './pointsCalculator';
import { supabase, isSupabaseConfigured } from './supabase';

const KEYS = {
  TOURNAMENTS: 'cricket_arena_tournaments',
  TEAMS: 'cricket_arena_cricket_teams',
  PLAYERS: 'cricket_arena_players',
  VIRTUAL_TEAMS: 'cricket_arena_virtual_teams',
  AUDIT_LOGS: 'cricket_arena_audit_logs',
  POINTS_CONFIG: 'cricket_arena_points_config',
  SCORES: 'cricket_arena_match_scores',
  USER_PROFILE: 'cricket_arena_user_profile',
  JOINED_TOURNAMENTS: 'cricket_arena_joined_tournaments',
};

// Safe JSON parse with fallback
function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`Error loading key ${key}`, err);
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Error saving key ${key}`, err);
  }
}

export class CricketDataStore {
  // Tournaments
  static getTournaments(): Tournament[] {
    return loadFromStorage<Tournament[]>(KEYS.TOURNAMENTS, INITIAL_TOURNAMENTS);
  }

  static saveTournaments(tournaments: Tournament[]): void {
    saveToStorage(KEYS.TOURNAMENTS, tournaments);
  }

  // Cricket Teams
  static getCricketTeams(): CricketTeam[] {
    return loadFromStorage<CricketTeam[]>(KEYS.TEAMS, INITIAL_CRICKET_TEAMS);
  }

  static saveCricketTeams(teams: CricketTeam[]): void {
    saveToStorage(KEYS.TEAMS, teams);
  }

  // Players
  static getPlayers(): Player[] {
    return loadFromStorage<Player[]>(KEYS.PLAYERS, INITIAL_PLAYERS);
  }

  static savePlayers(players: Player[]): void {
    saveToStorage(KEYS.PLAYERS, players);
  }

  // Points Config
  static getPointsConfig(): PointsConfig {
    return loadFromStorage<PointsConfig>(KEYS.POINTS_CONFIG, DEFAULT_POINTS_CONFIG);
  }

  static savePointsConfig(config: PointsConfig): void {
    saveToStorage(KEYS.POINTS_CONFIG, config);
  }

  // Virtual Teams / Leaderboard
  static getVirtualTeams(): VirtualTeam[] {
    return loadFromStorage<VirtualTeam[]>(KEYS.VIRTUAL_TEAMS, INITIAL_LEADERBOARD);
  }

  static saveVirtualTeams(teams: VirtualTeam[]): void {
    saveToStorage(KEYS.VIRTUAL_TEAMS, teams);
  }

  // Audit Logs
  static getAuditLogs(): AuditLog[] {
    return loadFromStorage<AuditLog[]>(KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
  }

  static addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const logs = this.getAuditLogs();
    const newEntry: AuditLog = {
      ...log,
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newEntry);
    saveToStorage(KEYS.AUDIT_LOGS, logs.slice(0, 100)); // retain last 100
    return newEntry;
  }

  // Joined Tournaments for Current User
  static getJoinedTournamentIds(): string[] {
    return loadFromStorage<string[]>(KEYS.JOINED_TOURNAMENTS, ['tour-ind-aus-live']);
  }

  static joinTournament(tournamentId: string, userId: string): boolean {
    const joined = this.getJoinedTournamentIds();
    if (joined.includes(tournamentId)) return false;

    joined.push(tournamentId);
    saveToStorage(KEYS.JOINED_TOURNAMENTS, joined);

    // Increase enrolled count
    const tournaments = this.getTournaments();
    const tourIndex = tournaments.findIndex((t) => t.id === tournamentId);
    if (tourIndex !== -1) {
      tournaments[tourIndex].enrolledCount += 1;
      this.saveTournaments(tournaments);
    }
    return true;
  }

  // Virtual Team creation with strict server/client validations
  static validateAndCreateVirtualTeam(
    tournamentId: string,
    userId: string,
    userName: string,
    teamName: string,
    playerIds: string[],
    captainId: string,
    viceCaptainId: string
  ): { success: boolean; error?: string; team?: VirtualTeam } {
    if (!teamName || teamName.trim().length < 3) {
      return { success: false, error: 'Team name must be at least 3 characters long.' };
    }

    if (playerIds.length !== 11) {
      return { success: false, error: 'Virtual team must contain exactly 11 players.' };
    }

    if (!captainId || !viceCaptainId) {
      return { success: false, error: 'Please select both Captain and Vice-Captain.' };
    }

    if (captainId === viceCaptainId) {
      return { success: false, error: 'Captain and Vice-Captain cannot be the same player.' };
    }

    if (!playerIds.includes(captainId) || !playerIds.includes(viceCaptainId)) {
      return { success: false, error: 'Captain and Vice-Captain must be in your 11-player squad.' };
    }

    const allPlayers = this.getPlayers();
    const squad = allPlayers.filter((p) => playerIds.includes(p.id));

    if (squad.length !== 11) {
      return { success: false, error: 'Some selected players could not be found.' };
    }

    // Budget check: max 100 credits
    const totalCredits = squad.reduce((sum, p) => sum + p.credits, 0);
    if (totalCredits > 100) {
      return {
        success: false,
        error: `Credits exceeded! Total used: ${totalCredits.toFixed(1)} / 100 max.`,
      };
    }

    // Role checks
    const wkCount = squad.filter((p) => p.role === 'WK').length;
    const batCount = squad.filter((p) => p.role === 'BAT').length;
    const arCount = squad.filter((p) => p.role === 'AR').length;
    const bowlCount = squad.filter((p) => p.role === 'BOWL').length;

    if (wkCount < 1 || wkCount > 4) {
      return { success: false, error: 'You must select 1 to 4 Wicket-Keepers (WK).' };
    }
    if (batCount < 3 || batCount > 6) {
      return { success: false, error: 'You must select 3 to 6 Batters (BAT).' };
    }
    if (arCount < 1 || arCount > 4) {
      return { success: false, error: 'You must select 1 to 4 All-Rounders (AR).' };
    }
    if (bowlCount < 3 || bowlCount > 6) {
      return { success: false, error: 'You must select 3 to 6 Bowlers (BOWL).' };
    }

    // Max 7 players from any single team
    const teamCounts: Record<string, number> = {};
    for (const p of squad) {
      teamCounts[p.teamId] = (teamCounts[p.teamId] || 0) + 1;
      if (teamCounts[p.teamId] > 7) {
        return {
          success: false,
          error: 'Maximum 7 players allowed from a single cricket team.',
        };
      }
    }

    // Save team
    const virtualTeams = this.getVirtualTeams();
    const existingIndex = virtualTeams.findIndex(
      (vt) => vt.tournamentId === tournamentId && vt.userId === userId
    );

    const now = new Date().toISOString();
    let newTeam: VirtualTeam;

    if (existingIndex !== -1) {
      newTeam = {
        ...virtualTeams[existingIndex],
        teamName: teamName.trim(),
        playerIds,
        captainId,
        viceCaptainId,
        updatedAt: now,
      };
      virtualTeams[existingIndex] = newTeam;
    } else {
      newTeam = {
        id: `vt-${Date.now()}`,
        tournamentId,
        userId,
        userName,
        teamName: teamName.trim(),
        playerIds,
        captainId,
        viceCaptainId,
        totalPoints: 0,
        createdAt: now,
        updatedAt: now,
      };
      virtualTeams.push(newTeam);
    }

    // Ensure user is marked joined
    this.joinTournament(tournamentId, userId);
    this.saveVirtualTeams(virtualTeams);

    return { success: true, team: newTeam };
  }

  // Recalculate leaderboard points for a tournament when player match scores are updated
  static recalculateTournamentScores(
    tournamentId: string,
    playerScores: Record<string, number>
  ): VirtualTeam[] {
    const virtualTeams = this.getVirtualTeams();
    const pointsConfig = this.getPointsConfig();
    const capMult = pointsConfig.rules.multipliers.captain || 2.0;
    const vcMult = pointsConfig.rules.multipliers.viceCaptain || 1.5;

    const tourTeams = virtualTeams.filter((vt) => vt.tournamentId === tournamentId);

    tourTeams.forEach((team) => {
      let total = 0;
      team.playerIds.forEach((pid) => {
        const rawPoints = playerScores[pid] || 0;
        if (pid === team.captainId) {
          total += rawPoints * capMult;
        } else if (pid === team.viceCaptainId) {
          total += rawPoints * vcMult;
        } else {
          total += rawPoints;
        }
      });
      team.totalPoints = Math.round(total * 10) / 10;
    });

    // Rank teams by total points descending
    tourTeams.sort((a, b) => b.totalPoints - a.totalPoints);
    tourTeams.forEach((team, idx) => {
      team.rank = idx + 1;
    });

    // Update main storage
    const otherTeams = virtualTeams.filter((vt) => vt.tournamentId !== tournamentId);
    const updated = [...otherTeams, ...tourTeams];
    this.saveVirtualTeams(updated);

    return tourTeams;
  }
}
