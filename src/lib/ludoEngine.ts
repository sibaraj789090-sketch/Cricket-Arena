import { LudoColor, LudoGameState, LudoToken } from '../types';

// Track offset for each color on the 52-cell main loop
export const COLOR_OFFSETS: Record<LudoColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

// Colors in clockwise order
export const COLOR_ORDER: LudoColor[] = ['red', 'green', 'yellow', 'blue'];

// 8 Safe Squares (indices on the 52-cell track)
export const SAFE_CELL_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// 15x15 Board Coordinate mapping for the 52 perimeter track cells
export const TRACK_COORDINATES: [number, number][] = [
  [6, 1],  // 0: Red start (safe)
  [6, 2],  // 1
  [6, 3],  // 2
  [6, 4],  // 3
  [6, 5],  // 4
  [5, 6],  // 5
  [4, 6],  // 6
  [3, 6],  // 7
  [2, 6],  // 8: Star (safe)
  [1, 6],  // 9
  [0, 6],  // 10
  [0, 7],  // 11
  [0, 8],  // 12
  [1, 8],  // 13: Green start (safe)
  [2, 8],  // 14
  [3, 8],  // 15
  [4, 8],  // 16
  [5, 8],  // 17
  [6, 9],  // 18
  [6, 10], // 19
  [6, 11], // 20
  [6, 12], // 21: Star (safe)
  [6, 13], // 22
  [6, 14], // 23
  [7, 14], // 24
  [8, 14], // 25
  [8, 13], // 26: Yellow start (safe)
  [8, 12], // 27
  [8, 11], // 28
  [8, 10], // 29
  [8, 9],  // 30
  [9, 8],  // 31
  [10, 8], // 32
  [11, 8], // 33
  [12, 8], // 34: Star (safe)
  [13, 8], // 35
  [14, 8], // 36
  [14, 7], // 37
  [14, 6], // 38
  [13, 6], // 39: Blue start (safe)
  [12, 6], // 40
  [11, 6], // 41
  [10, 6], // 42
  [9, 6],  // 43
  [8, 5],  // 44
  [8, 4],  // 45
  [8, 3],  // 46
  [8, 2],  // 47: Star (safe)
  [8, 1],  // 48
  [8, 0],  // 49
  [7, 0],  // 50
  [6, 0],  // 51
];

// Colored home paths (steps 51 to 55) and home triangle center (step 56: [7, 7])
export const HOME_PATHS: Record<LudoColor, [number, number][]> = {
  red: [
    [7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 7]
  ],
  green: [
    [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [7, 7]
  ],
  yellow: [
    [7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 7]
  ],
  blue: [
    [13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [7, 7]
  ],
};

// Yard / Base spawn slots for 4 tokens
export const YARD_SLOTS: Record<LudoColor, [number, number][]> = {
  red: [
    [2, 2], [2, 3], [3, 2], [3, 3]
  ],
  green: [
    [2, 11], [2, 12], [3, 11], [3, 12]
  ],
  yellow: [
    [11, 11], [11, 12], [12, 11], [12, 12]
  ],
  blue: [
    [11, 2], [11, 3], [12, 2], [12, 3]
  ],
};

export function getGlobalTrackIndex(color: LudoColor, step: number): number | null {
  if (step < 0 || step > 50) return null;
  return (COLOR_OFFSETS[color] + step) % 52;
}

export function getTokenCoordinates(token: LudoToken): [number, number] {
  if (token.step === -1) {
    return YARD_SLOTS[token.color][token.id];
  }
  if (token.step <= 50) {
    const globalIdx = getGlobalTrackIndex(token.color, token.step)!;
    return TRACK_COORDINATES[globalIdx];
  }
  // Home stretch (51 to 56)
  const homeIdx = token.step - 51;
  return HOME_PATHS[token.color][Math.min(homeIdx, 5)];
}

// Initial Game Setup
export function createInitialLudoGame(playerCount: 2 | 4): LudoGameState {
  const players: LudoColor[] = playerCount === 2 ? ['red', 'yellow'] : ['red', 'green', 'yellow', 'blue'];

  const createTokens = (color: LudoColor): LudoToken[] => [
    { id: 0, color, step: -1, score: 0, reachedHome: false },
    { id: 1, color, step: -1, score: 0, reachedHome: false },
    { id: 2, color, step: -1, score: 0, reachedHome: false },
    { id: 3, color, step: -1, score: 0, reachedHome: false },
  ];

  const tokens: Record<LudoColor, LudoToken[]> = {
    red: createTokens('red'),
    green: createTokens('green'),
    yellow: createTokens('yellow'),
    blue: createTokens('blue'),
  };

  const initialScores: Record<LudoColor, number> = {
    red: 0,
    green: 0,
    yellow: 0,
    blue: 0,
  };

  return {
    playerCount,
    players,
    currentTurn: players[0],
    diceValue: null,
    hasRolled: false,
    consecutiveSixes: 0,
    tokens,
    winners: [],
    isGameOver: false,
    lastActionText: `${capitalize(players[0])}'s turn to roll!`,
    extraTurn: false,
    highlightedTokenIds: [],
    scores: initialScores,
  };
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Validation: Can token move with given dice roll?
export function canTokenMove(token: LudoToken, dice: number): boolean {
  if (token.step === 56) return false; // already in home
  if (token.step === -1) return dice === 6; // need 6 to leave yard
  return token.step + dice <= 56; // must not overshoot home 56
}

// Get all legal token IDs that current player can move
export function getLegalMoves(tokens: Record<LudoColor, LudoToken[]>, color: LudoColor, dice: number): number[] {
  const playerTokens = tokens[color];
  const legal: number[] = [];
  playerTokens.forEach((t) => {
    if (canTokenMove(t, dice)) {
      legal.push(t.id);
    }
  });
  return legal;
}

// Next turn calculation
export function getNextPlayer(current: LudoColor, players: LudoColor[], winners: LudoColor[]): LudoColor {
  const activePlayers = players.filter((p) => !winners.includes(p));
  if (activePlayers.length <= 1) return current;

  const currentIdx = players.indexOf(current);
  for (let i = 1; i <= players.length; i++) {
    const nextCandidate = players[(currentIdx + i) % players.length];
    if (!winners.includes(nextCandidate)) {
      return nextCandidate;
    }
  }
  return current;
}

// Web Audio sound synthesizer for responsive feedback
export function playLudoSound(type: 'dice' | 'move' | 'capture' | 'win' | 'six') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'dice') {
      // Noise / click rattling
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === 'move') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'capture') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'six' || type === 'win') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (e) {
    // Audio context may require prior user interaction
  }
}
