import { PointsConfig, PlayerMatchScore, PlayerRole } from '../types';

export const DEFAULT_POINTS_CONFIG: PointsConfig = {
  id: 'standard-t20-v1',
  title: 'Standard T20 Fantasy System',
  rules: {
    batting: {
      run: 1,
      boundaryFour: 1,
      six: 2,
      duck: -2,
      halfCentury: 8,
      century: 16,
      strikeRateAbove150: 4,
      strikeRateBelow70: -2,
    },
    bowling: {
      wicket: 25,
      threeWickets: 4,
      fiveWickets: 16,
      maidenOver: 12,
      dotBall: 1,
      economyBelow6: 6,
      economyAbove11: -4,
    },
    fielding: {
      catch: 8,
      stumping: 12,
      runOutDirect: 12,
      runOutInDirect: 6,
      threeCatchesBonus: 4,
    },
    multipliers: {
      captain: 2.0,
      viceCaptain: 1.5,
    },
  },
};

export function calculatePlayerScore(
  stats: Partial<PlayerMatchScore>,
  role: PlayerRole = 'BAT',
  config: PointsConfig = DEFAULT_POINTS_CONFIG
): number {
  const { batting, bowling, fielding } = config.rules;
  let points = 0;

  const runs = stats.runs || 0;
  const fours = stats.fours || 0;
  const sixes = stats.sixes || 0;
  const balls = stats.ballsFaced || 0;
  const isOut = stats.isOut || false;

  // Batting calculations
  points += runs * batting.run;
  points += fours * batting.boundaryFour;
  points += sixes * batting.six;

  if (runs >= 100) {
    points += batting.century;
  } else if (runs >= 50) {
    points += batting.halfCentury;
  }

  // Duck penalty (for non-pure bowlers)
  if (isOut && runs === 0 && role !== 'BOWL') {
    points += batting.duck;
  }

  // Strike Rate bonus (minimum 10 balls faced)
  if (balls >= 10) {
    const sr = (runs / balls) * 100;
    if (sr > 150) {
      points += batting.strikeRateAbove150;
    } else if (sr < 70) {
      points += batting.strikeRateBelow70;
    }
  }

  // Bowling calculations
  const wickets = stats.wickets || 0;
  const maidens = stats.maidens || 0;
  const overs = stats.oversBowled || 0;
  const runsConceded = stats.runsConceded || 0;
  const dotBalls = stats.dotBalls || 0;

  points += wickets * bowling.wicket;
  points += maidens * bowling.maidenOver;
  points += dotBalls * bowling.dotBall;

  if (wickets >= 5) {
    points += bowling.fiveWickets;
  } else if (wickets >= 3) {
    points += bowling.threeWickets;
  }

  // Economy bonus/penalty (min 2 overs)
  if (overs >= 2) {
    const econ = runsConceded / overs;
    if (econ < 6.0) {
      points += bowling.economyBelow6;
    } else if (econ > 11.0) {
      points += bowling.economyAbove11;
    }
  }

  // Fielding
  const catches = stats.catches || 0;
  const stumpings = stats.stumpings || 0;
  const runOuts = stats.runOuts || 0;

  points += catches * fielding.catch;
  if (catches >= 3) {
    points += fielding.threeCatchesBonus;
  }
  points += stumpings * fielding.stumping;
  points += runOuts * fielding.runOutDirect;

  return Math.round(points);
}
