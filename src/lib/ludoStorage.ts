import {
  LudoTournament,
  LudoTournamentParticipant,
  LudoBracketMatch,
  LudoRoom,
  LudoTournamentStatus,
  LudoMatchFormat,
} from '../types';

const LUDO_STORAGE_KEYS = {
  TOURNAMENTS: 'cricket_arena_ludo_tournaments',
  PARTICIPANTS: 'cricket_arena_ludo_participants',
  BRACKETS: 'cricket_arena_ludo_brackets',
  ROOMS: 'cricket_arena_ludo_rooms',
  USER_REGISTRATIONS: 'cricket_arena_ludo_user_joined',
};

// Initial Demo Ludo Tournaments
export const INITIAL_LUDO_TOURNAMENTS: LudoTournament[] = [
  {
    id: 'ludo-tour-1',
    title: 'Ludo Arena Grand Championship',
    format: '4P',
    status: 'registration_open',
    maxParticipants: 16,
    enrolledCount: 12,
    startTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    rulesDescription: 'Standard 4-Player knockout. Winner of each table advances to the Grand Final. Extra turn on 6, home, and captures.',
    isDemo: true,
    roundsCount: 2,
    bannerImage: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'ludo-tour-2',
    title: 'Super Ludo Duo Duel (2-Player Knockout)',
    format: '2P',
    status: 'in_progress',
    maxParticipants: 8,
    enrolledCount: 8,
    startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    rulesDescription: 'Fast 1v1 single elimination bracket. Red vs Yellow diagonal faceoff. 3 rounds to champion glory.',
    isDemo: true,
    roundsCount: 3,
    bannerImage: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'ludo-tour-3',
    title: 'Weekend Star Tournament',
    format: '4P',
    status: 'upcoming',
    maxParticipants: 32,
    enrolledCount: 18,
    startTime: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    rulesDescription: 'Quarterfinals, Semifinals, and Grand Final. Free entry, points-based trophy ranking.',
    isDemo: true,
    roundsCount: 3,
    bannerImage: 'https://images.unsplash.com/photo-1543857778-c4a1a3e0b2eb?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'ludo-tour-completed',
    title: 'Classic Masters Ludo Cup 2026',
    format: '4P',
    status: 'completed',
    maxParticipants: 16,
    enrolledCount: 16,
    startTime: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    rulesDescription: 'Tournament completed. Verified champion crowned with 1000 skill points.',
    isDemo: true,
    roundsCount: 2,
    winnerName: 'Aman_DiceKing',
  },
];

// Initial Demo Bracket Matches
export const INITIAL_BRACKET_MATCHES: LudoBracketMatch[] = [
  {
    id: 'match-qf-1',
    tournamentId: 'ludo-tour-2',
    round: 1,
    roundName: 'Quarterfinal 1',
    playerNames: ['Aman Sharma', 'Rahul Verma'],
    winnerName: 'Aman Sharma',
    status: 'completed',
    scheduledTime: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
    id: 'match-qf-2',
    tournamentId: 'ludo-tour-2',
    round: 1,
    roundName: 'Quarterfinal 2',
    playerNames: ['Priya Patel', 'Karan Johar'],
    winnerName: 'Priya Patel',
    status: 'completed',
    scheduledTime: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
    id: 'match-sf-1',
    tournamentId: 'ludo-tour-2',
    round: 2,
    roundName: 'Semifinal 1',
    playerNames: ['Aman Sharma', 'Priya Patel'],
    winnerName: undefined,
    status: 'in_progress',
    scheduledTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'match-f-1',
    tournamentId: 'ludo-tour-2',
    round: 3,
    roundName: 'Grand Final',
    playerNames: ['TBD (Winner SF1)', 'TBD (Winner SF2)'],
    winnerName: undefined,
    status: 'pending',
    scheduledTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  },
];

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
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

export class LudoDataStore {
  static getTournaments(): LudoTournament[] {
    return loadFromStorage<LudoTournament[]>(LUDO_STORAGE_KEYS.TOURNAMENTS, INITIAL_LUDO_TOURNAMENTS);
  }

  static saveTournaments(tournaments: LudoTournament[]): void {
    saveToStorage(LUDO_STORAGE_KEYS.TOURNAMENTS, tournaments);
  }

  static getBracketMatches(): LudoBracketMatch[] {
    return loadFromStorage<LudoBracketMatch[]>(LUDO_STORAGE_KEYS.BRACKETS, INITIAL_BRACKET_MATCHES);
  }

  static saveBracketMatches(matches: LudoBracketMatch[]): void {
    saveToStorage(LUDO_STORAGE_KEYS.BRACKETS, matches);
  }

  static getRegisteredTournamentIds(userId: string): string[] {
    const all = loadFromStorage<Record<string, string[]>>(LUDO_STORAGE_KEYS.USER_REGISTRATIONS, {});
    return all[userId] || ['ludo-tour-2'];
  }

  static registerForTournament(tournamentId: string, userId: string, userName: string): { success: boolean; error?: string } {
    const tournaments = this.getTournaments();
    const tour = tournaments.find((t) => t.id === tournamentId);

    if (!tour) return { success: false, error: 'Tournament not found.' };
    if (tour.status === 'completed' || tour.status === 'cancelled') {
      return { success: false, error: 'Tournament is no longer accepting entries.' };
    }
    if (tour.enrolledCount >= tour.maxParticipants) {
      return { success: false, error: 'Tournament is full! Participant limit reached.' };
    }

    const userJoined = this.getRegisteredTournamentIds(userId);
    if (userJoined.includes(tournamentId)) {
      return { success: false, error: 'You are already registered for this tournament!' };
    }

    // Save registration
    userJoined.push(tournamentId);
    const all = loadFromStorage<Record<string, string[]>>(LUDO_STORAGE_KEYS.USER_REGISTRATIONS, {});
    all[userId] = userJoined;
    saveToStorage(LUDO_STORAGE_KEYS.USER_REGISTRATIONS, all);

    // Increment count
    tour.enrolledCount += 1;
    this.saveTournaments(tournaments);

    return { success: true };
  }

  // Admin methods
  static adminCreateTournament(data: Omit<LudoTournament, 'id' | 'enrolledCount'>): LudoTournament {
    const list = this.getTournaments();
    const newTour: LudoTournament = {
      ...data,
      id: `ludo-tour-${Date.now()}`,
      enrolledCount: 0,
    };
    list.unshift(newTour);
    this.saveTournaments(list);
    return newTour;
  }

  static adminUpdateTournamentStatus(tournamentId: string, status: LudoTournamentStatus, winnerName?: string): void {
    const list = this.getTournaments();
    const tour = list.find((t) => t.id === tournamentId);
    if (tour) {
      tour.status = status;
      if (winnerName) tour.winnerName = winnerName;
      this.saveTournaments(list);
    }
  }

  // Online Multiplayer Room Preparation
  static getRooms(): LudoRoom[] {
    return loadFromStorage<LudoRoom[]>(LUDO_STORAGE_KEYS.ROOMS, [
      {
        id: 'room-1',
        code: 'LUDO-7021',
        hostUserId: 'user-rohit99',
        hostName: 'Aman Sharma',
        playerCount: 4,
        status: 'waiting',
        players: [
          { userId: 'user-rohit99', name: 'Aman Sharma', color: 'red', isReady: true },
          { userId: 'user-vikas45', name: 'Vikas Kumar', color: 'yellow', isReady: true },
        ],
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  static createRoom(hostUserId: string, hostName: string, playerCount: 2 | 4): LudoRoom {
    const rooms = this.getRooms();
    const code = `LUDO-${Math.floor(1000 + Math.random() * 9000)}`;
    const newRoom: LudoRoom = {
      id: `room-${Date.now()}`,
      code,
      hostUserId,
      hostName,
      playerCount,
      status: 'waiting',
      players: [
        { userId: hostUserId, name: hostName, color: 'red', isReady: true },
      ],
      createdAt: new Date().toISOString(),
    };
    rooms.unshift(newRoom);
    saveToStorage(LUDO_STORAGE_KEYS.ROOMS, rooms);
    return newRoom;
  }

  static joinRoom(code: string, userId: string, userName: string): { success: boolean; room?: LudoRoom; error?: string } {
    const rooms = this.getRooms();
    const room = rooms.find((r) => r.code.toUpperCase() === code.trim().toUpperCase());

    if (!room) return { success: false, error: 'Room code not found.' };
    if (room.players.length >= room.playerCount) {
      return { success: false, error: 'Room is already full.' };
    }
    if (room.players.some((p) => p.userId === userId)) {
      return { success: true, room };
    }

    const assignedColors: ('red' | 'green' | 'yellow' | 'blue')[] = room.playerCount === 2
      ? ['red', 'yellow']
      : ['red', 'green', 'yellow', 'blue'];

    const nextColor = assignedColors[room.players.length];
    room.players.push({
      userId,
      name: userName,
      color: nextColor,
      isReady: true,
    });

    if (room.players.length === room.playerCount) {
      room.status = 'in_progress';
    }

    saveToStorage(LUDO_STORAGE_KEYS.ROOMS, rooms);
    return { success: true, room };
  }
}
