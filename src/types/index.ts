export type PlayerRole = 'WK' | 'BAT' | 'AR' | 'BOWL';

export interface CricketTeam {
  id: string;
  name: string;
  shortName: string;
  code: string;
  logo: string;
  primaryColor: string;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  role: PlayerRole;
  credits: number;
  avatar?: string;
  matchesPlayed: number;
  totalRuns: number;
  totalWickets: number;
  battingAvg?: number;
  bowlingAvg?: number;
  strikeRate?: number;
  economy?: number;
}

export type TournamentStatus = 'upcoming' | 'live' | 'completed' | 'draft';
export type MatchFormat = 'T20' | 'ODI' | 'TEST' | 'T10';

export interface Tournament {
  id: string;
  title: string;
  format: MatchFormat;
  teamAId: string;
  teamBId: string;
  venue: string;
  startTime: string; // ISO date
  endTime: string;
  status: TournamentStatus;
  entryLimit: number;
  enrolledCount: number;
  bannerImage: string;
  isDemo: boolean;
  pointsConfigId?: string;
}

export interface PointsConfig {
  id: string;
  title: string;
  rules: {
    batting: {
      run: number;
      boundaryFour: number;
      six: number;
      duck: number;
      halfCentury: number;
      century: number;
      strikeRateAbove150: number;
      strikeRateBelow70: number;
    };
    bowling: {
      wicket: number;
      threeWickets: number;
      fiveWickets: number;
      maidenOver: number;
      dotBall: number;
      economyBelow6: number;
      economyAbove11: number;
    };
    fielding: {
      catch: number;
      stumping: number;
      runOutDirect: number;
      runOutInDirect: number;
      threeCatchesBonus: number;
    };
    multipliers: {
      captain: number;
      viceCaptain: number;
    };
  };
}

export interface VirtualTeam {
  id: string;
  tournamentId: string;
  userId: string;
  userName: string;
  teamName: string;
  playerIds: string[]; // exactly 11 players
  captainId: string; // 2x points
  viceCaptainId: string; // 1.5x points
  totalPoints: number;
  rank?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerMatchScore {
  playerId: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  oversBowled: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  dotBalls: number;
  calculatedPoints: number;
}

export interface TournamentLeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  userName: string;
  userId: string;
  captainName: string;
  viceCaptainName: string;
  totalPoints: number;
  pointsBreakdown?: Record<string, number>;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetType: 'tournament' | 'score' | 'points_rule' | 'team' | 'player' | 'cash_request' | 'user' | 'player_restriction' | 'wallet';
  targetId: string;
  details: string;
  timestamp: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  avatar?: string;
  avatarUrl?: string;
  joinedAt?: string;
  joinedTournamentsCount: number;
  totalFantasyPoints: number;
  createdTeamsCount: number;
}

// ==========================================
// LUDO TYPES
// ==========================================

export type LudoColor = 'red' | 'green' | 'yellow' | 'blue';

export interface LudoToken {
  id: number; // 0, 1, 2, 3
  color: LudoColor;
  step: number; // -1 = in yard/base, 0..50 = main track, 51..55 = home stretch, 56 = in home/finished
  score?: number; // Accumulated points recorded on this token
  reachedHome?: boolean; // Has 60-point home bonus already been awarded
}

export interface LudoGameState {
  playerCount: 2 | 4;
  players: LudoColor[];
  currentTurn: LudoColor;
  diceValue: number | null;
  hasRolled: boolean;
  consecutiveSixes: number;
  tokens: Record<LudoColor, LudoToken[]>;
  winners: LudoColor[];
  isGameOver: boolean;
  lastActionText: string;
  extraTurn: boolean;
  highlightedTokenIds: number[];
  scores?: Record<LudoColor, number>; // Authoritative live scores by color
}

export type LudoTournamentStatus = 'upcoming' | 'registration_open' | 'in_progress' | 'completed' | 'cancelled';
export type LudoMatchFormat = '2P' | '4P';

export interface LudoTournament {
  id: string;
  title: string;
  format: LudoMatchFormat;
  status: LudoTournamentStatus;
  maxParticipants: number;
  enrolledCount: number;
  startTime: string;
  rulesDescription: string;
  isDemo: boolean;
  roundsCount: number;
  winnerName?: string;
  bannerImage?: string;
}

export interface LudoTournamentParticipant {
  id: string;
  tournamentId: string;
  userId: string;
  userName: string;
  joinedAt: string;
  status: 'registered' | 'eliminated' | 'champion' | 'runner_up';
  points: number;
}

export interface LudoBracketMatch {
  id: string;
  tournamentId: string;
  round: number; // 1 = Quarterfinals, 2 = Semifinals, 3 = Finals
  roundName: string;
  playerNames: string[];
  winnerName?: string;
  status: 'pending' | 'in_progress' | 'completed';
  scheduledTime: string;
}

export interface LudoRoom {
  id: string;
  code: string;
  hostUserId: string;
  hostName: string;
  playerCount: 2 | 4;
  status: 'waiting' | 'in_progress' | 'completed';
  players: {
    userId: string;
    name: string;
    color: LudoColor;
    isReady: boolean;
  }[];
  createdAt: string;
}

export * from './wallet';
export * from './ludoCash';
