import React from 'react';
import { LudoColor, LudoGameState, LudoToken } from '../../types';
import {
  TRACK_COORDINATES,
  HOME_PATHS,
  YARD_SLOTS,
  SAFE_CELL_INDICES,
  getGlobalTrackIndex,
} from '../../lib/ludoEngine';
import { Star, ArrowRight, ArrowDown, ArrowLeft, ArrowUp, Crown } from 'lucide-react';

interface LudoBoardProps {
  gameState: LudoGameState;
  onSelectToken: (tokenId: number) => void;
}

export const LudoBoard: React.FC<LudoBoardProps> = ({ gameState, onSelectToken }) => {
  const { currentTurn, hasRolled, tokens, highlightedTokenIds } = gameState;

  // Rich theme colors
  const colorThemes: Record<
    LudoColor,
    {
      main: string;
      light: string;
      dark: string;
      border: string;
      glow: string;
      tokenGradient: string;
    }
  > = {
    red: {
      main: '#e11d48',
      light: '#fda4af',
      dark: '#9f1239',
      border: '#be123c',
      glow: 'rgba(225, 29, 72, 0.8)',
      tokenGradient: 'radial-gradient(circle at 35% 35%, #ff4d6d, #e11d48 60%, #9f1239)',
    },
    green: {
      main: '#16a34a',
      light: '#86efac',
      dark: '#14532d',
      border: '#15803d',
      glow: 'rgba(22, 163, 74, 0.8)',
      tokenGradient: 'radial-gradient(circle at 35% 35%, #4ade80, #16a34a 60%, #14532d)',
    },
    yellow: {
      main: '#eab308',
      light: '#fef08a',
      dark: '#854d0e',
      border: '#ca8a04',
      glow: 'rgba(234, 179, 8, 0.8)',
      tokenGradient: 'radial-gradient(circle at 35% 35%, #fde047, #eab308 60%, #854d0e)',
    },
    blue: {
      main: '#2563eb',
      light: '#93c5fd',
      dark: '#1e3a8a',
      border: '#1d4ed8',
      glow: 'rgba(37, 99, 235, 0.8)',
      tokenGradient: 'radial-gradient(circle at 35% 35%, #60a5fa, #2563eb 60%, #1e3a8a)',
    },
  };

  // Find tokens present at specific grid cell [row, col]
  const getTokensAt = (row: number, col: number): LudoToken[] => {
    const list: LudoToken[] = [];

    (Object.keys(tokens) as LudoColor[]).forEach((color) => {
      tokens[color].forEach((tok) => {
        if (tok.step === -1) {
          const slot = YARD_SLOTS[color][tok.id];
          if (slot[0] === row && slot[1] === col) list.push(tok);
        } else if (tok.step <= 50) {
          const globalIdx = getGlobalTrackIndex(color, tok.step);
          if (globalIdx !== null) {
            const coord = TRACK_COORDINATES[globalIdx];
            if (coord[0] === row && coord[1] === col) list.push(tok);
          }
        } else if (tok.step <= 55) {
          const homeIdx = tok.step - 51;
          const coord = HOME_PATHS[color][homeIdx];
          if (coord[0] === row && coord[1] === col) list.push(tok);
        }
      });
    });

    return list;
  };

  // Count tokens inside home triangle (step === 56)
  const getHomeTokens = (color: LudoColor): LudoToken[] => {
    return tokens[color].filter((t) => t.step === 56);
  };

  // Cell type determination
  const getCellType = (r: number, c: number) => {
    // 4 Yards (6x6 corners)
    if (r < 6 && c < 6) return { type: 'yard', color: 'red' as LudoColor };
    if (r < 6 && c > 8) return { type: 'yard', color: 'green' as LudoColor };
    if (r > 8 && c < 6) return { type: 'yard', color: 'blue' as LudoColor };
    if (r > 8 && c > 8) return { type: 'yard', color: 'yellow' as LudoColor };

    // Center 3x3 Home Triangle area
    if (r >= 6 && r <= 8 && c >= 6 && c <= 8) {
      return { type: 'center' };
    }

    // Home Colored Paths (5 cells each)
    if (r === 7 && c >= 1 && c <= 5) return { type: 'home-path', color: 'red' as LudoColor, dir: 'right' };
    if (c === 7 && r >= 1 && r <= 5) return { type: 'home-path', color: 'green' as LudoColor, dir: 'down' };
    if (r === 7 && c >= 9 && c <= 13) return { type: 'home-path', color: 'yellow' as LudoColor, dir: 'left' };
    if (c === 7 && r >= 9 && r <= 13) return { type: 'home-path', color: 'blue' as LudoColor, dir: 'up' };

    // Starting cells (Track Entry)
    if (r === 6 && c === 1) return { type: 'start', color: 'red' as LudoColor };
    if (r === 1 && c === 8) return { type: 'start', color: 'green' as LudoColor };
    if (r === 8 && c === 13) return { type: 'start', color: 'yellow' as LudoColor };
    if (r === 13 && c === 6) return { type: 'start', color: 'blue' as LudoColor };

    // Safe Star cells on track
    if ((r === 2 && c === 6) || (r === 6 && c === 12) || (r === 12 && c === 8) || (r === 8 && c === 2)) {
      return { type: 'star' };
    }

    // Regular track cells
    return { type: 'track' };
  };

  // Yard inner circle determination
  const isYardSlot = (r: number, c: number, color: LudoColor) => {
    return YARD_SLOTS[color].some((slot) => slot[0] === r && slot[1] === c);
  };

  return (
    <div className="w-full max-w-[360px] sm:max-w-[390px] mx-auto aspect-square p-2 bg-gradient-to-b from-[#0e172e] to-[#080d1a] rounded-3xl shadow-[0_15px_35px_rgba(0,0,0,0.6)] border-2 border-slate-700/60 select-none flex items-center justify-center">
      {/* Authentic Board Grid 15x15 */}
      <div className="relative w-full h-full grid grid-cols-15 grid-rows-15 gap-[1px] bg-slate-950 p-[2px] rounded-2xl shadow-inner border border-slate-800 overflow-hidden">
        {Array.from({ length: 15 }).map((_, r) =>
          Array.from({ length: 15 }).map((_, c) => {
            const cell = getCellType(r, c);
            const tokensHere = getTokensAt(r, c);

            // Skip rendering inside the 3x3 center individually since we render an authentic central SVG overlay
            if (cell.type === 'center') {
              // Only render the center container once at [6, 6]
              if (r === 6 && c === 6) {
                return (
                  <div
                    key="center-home-triangle"
                    className="relative w-full h-full overflow-hidden bg-slate-900 border border-slate-950 shadow-inner z-10"
                    style={{ gridColumn: '7 / span 3', gridRow: '7 / span 3' }}
                  >
                    {/* SVG 4 Triangles pointing to center */}
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      {/* Top Triangle: Green */}
                      <polygon points="0,0 100,0 50,50" fill={colorThemes.green.main} />
                      {/* Right Triangle: Yellow */}
                      <polygon points="100,0 100,100 50,50" fill={colorThemes.yellow.main} />
                      {/* Bottom Triangle: Blue */}
                      <polygon points="0,100 100,100 50,50" fill={colorThemes.blue.main} />
                      {/* Left Triangle: Red */}
                      <polygon points="0,0 0,100 50,50" fill={colorThemes.red.main} />

                      {/* Subtle dividers */}
                      <line x1="0" y1="0" x2="100" y2="100" stroke="#000000" strokeWidth="1.5" />
                      <line x1="100" y1="0" x2="0" y2="100" stroke="#000000" strokeWidth="1.5" />
                    </svg>

                    {/* Central Gold Emblem */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 border border-amber-600 shadow-md flex items-center justify-center">
                        <Crown className="w-3.5 h-3.5 text-amber-900" />
                      </div>
                    </div>

                    {/* Tokens in Home (step 56) */}
                    {(['red', 'green', 'yellow', 'blue'] as LudoColor[]).map((col) => {
                      const homeToks = getHomeTokens(col);
                      if (homeToks.length === 0) return null;

                      // Positioning badges near each color's apex
                      const posClass: Record<LudoColor, string> = {
                        red: 'left-1 top-1/2 -translate-y-1/2',
                        green: 'top-1 left-1/2 -translate-x-1/2',
                        yellow: 'right-1 top-1/2 -translate-y-1/2',
                        blue: 'bottom-1 left-1/2 -translate-x-1/2',
                      };

                      return (
                        <div
                          key={`home-toks-${col}`}
                          className={`absolute ${posClass[col]} flex items-center gap-0.5 bg-black/60 px-1 py-0.5 rounded-full border border-white/40 shadow-lg`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-white"
                            style={{ backgroundColor: colorThemes[col].main }}
                          />
                          <span className="text-[9px] font-black text-white leading-none">
                            {homeToks.length}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              }
              return null; // The other cells of 3x3 are handled by col-span-3 row-span-3
            }

            // Cell background & contents
            let bgStyle = 'bg-white';
            let cellContent: React.ReactNode = null;

            if (cell.type === 'yard') {
              const col = cell.color!;
              const isSlot = isYardSlot(r, c, col);

              if (isSlot) {
                // Sunken token holding bay
                bgStyle = 'bg-white shadow-inner';
                cellContent = (
                  <div
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-dashed opacity-50 flex items-center justify-center pointer-events-none"
                    style={{ borderColor: colorThemes[col].main }}
                  />
                );
              } else {
                // Yard colored body
                bgStyle =
                  col === 'red'
                    ? 'bg-rose-600'
                    : col === 'green'
                    ? 'bg-emerald-600'
                    : col === 'yellow'
                    ? 'bg-amber-500'
                    : 'bg-blue-600';
              }
            } else if (cell.type === 'home-path') {
              const col = cell.color!;
              bgStyle =
                col === 'red'
                  ? 'bg-rose-500 text-rose-950'
                  : col === 'green'
                  ? 'bg-emerald-500 text-emerald-950'
                  : col === 'yellow'
                  ? 'bg-amber-400 text-amber-950'
                  : 'bg-blue-500 text-blue-950';

              // Directional arrow icon
              if (cell.dir === 'right') cellContent = <ArrowRight className="w-2 h-2 opacity-50 mx-auto" />;
              if (cell.dir === 'down') cellContent = <ArrowDown className="w-2 h-2 opacity-50 mx-auto" />;
              if (cell.dir === 'left') cellContent = <ArrowLeft className="w-2 h-2 opacity-50 mx-auto" />;
              if (cell.dir === 'up') cellContent = <ArrowUp className="w-2 h-2 opacity-50 mx-auto" />;
            } else if (cell.type === 'start') {
              const col = cell.color!;
              bgStyle =
                col === 'red'
                  ? 'bg-rose-500'
                  : col === 'green'
                  ? 'bg-emerald-500'
                  : col === 'yellow'
                  ? 'bg-amber-400'
                  : 'bg-blue-500';
              cellContent = <Star className="w-2.5 h-2.5 text-white fill-white mx-auto shadow-sm" />;
            } else if (cell.type === 'star') {
              bgStyle = 'bg-slate-100';
              cellContent = <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500 mx-auto" />;
            } else {
              // Regular track cell
              bgStyle = 'bg-slate-100/95';
            }

            return (
              <div
                key={`cell-${r}-${c}`}
                style={{ gridColumn: `${c + 1} / span 1`, gridRow: `${r + 1} / span 1` }}
                className={`relative flex items-center justify-center ${bgStyle} border border-slate-900/10 transition-colors`}
              >
                {cellContent}

                {/* Render tokens on this cell */}
                {tokensHere.length > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center p-0.5">
                    {tokensHere.map((tok, idx) => {
                      const isLegal =
                        tok.color === currentTurn &&
                        hasRolled &&
                        highlightedTokenIds.includes(tok.id);

                      const theme = colorThemes[tok.color];

                      return (
                        <button
                          key={`tok-${tok.color}-${tok.id}`}
                          type="button"
                          disabled={!isLegal}
                          onClick={() => onSelectToken(tok.id)}
                          style={{
                            background: theme.tokenGradient,
                            borderColor: isLegal ? '#ffffff' : theme.dark,
                            boxShadow: isLegal
                              ? `0 0 12px 3px ${theme.glow}, 0 4px 8px rgba(0,0,0,0.6)`
                              : '0 2px 4px rgba(0,0,0,0.4)',
                          }}
                          className={`relative rounded-full w-full h-full max-w-[17px] max-h-[17px] sm:max-w-[20px] sm:max-h-[20px] border-2 flex items-center justify-center transition-transform select-none ${
                            isLegal
                              ? 'cursor-pointer scale-110 sm:scale-125 animate-bounce z-40 ring-2 ring-white ring-offset-1 ring-offset-slate-900'
                              : 'opacity-95 z-20 hover:scale-105'
                          } ${tokensHere.length > 1 ? '-ml-1.5 first:ml-0' : ''}`}
                          title={`${tok.color.toUpperCase()} Token ${tok.id + 1} (${
                            tok.step === -1 ? 'Yard' : `Step ${tok.step}`
                          })`}
                        >
                          {/* Inner glossy gem center */}
                          <div className="w-1.5 h-1.5 rounded-full bg-white/95 shadow-sm" />

                          {/* Multiple tokens counter badge if clustered */}
                          {tokensHere.length > 1 && idx === tokensHere.length - 1 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-black/80 text-white font-mono text-[8px] font-black rounded-full px-1 border border-white/50 leading-none">
                              {tokensHere.length}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
