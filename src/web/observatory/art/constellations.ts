/**
 * Real constellations, in the order a child's stars fill them. Each star is placed on a 0–100 square, and each line
 * joins two stars by their index. The shapes are simplified for small children but recognisable.
 */
export interface ConstellationPattern {
  name: string;
  stars: [number, number][];
  lines: [number, number][];
}

export const constellations: ConstellationPattern[] = [
  { name: "Cassiopeia", stars: [[8, 35], [30, 65], [50, 40], [70, 68], [92, 32]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { name: "Cygnus the Swan", stars: [[50, 8], [50, 42], [50, 88], [15, 35], [85, 48]], lines: [[0, 1], [1, 2], [3, 1], [1, 4]] },
  {
    name: "Little Dipper",
    stars: [[10, 20], [26, 30], [40, 42], [55, 52], [72, 50], [88, 66], [70, 72]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
  {
    name: "Big Dipper",
    stars: [[10, 30], [28, 36], [44, 46], [60, 52], [64, 75], [90, 78], [88, 54]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
  {
    name: "Orion the Hunter",
    stars: [[28, 12], [72, 18], [42, 50], [50, 52], [58, 54], [30, 88], [74, 86]],
    lines: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]],
  },
  {
    name: "Lyra the Harp",
    stars: [[50, 10], [40, 40], [62, 44], [36, 80], [58, 86]],
    lines: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4]],
  },
  { name: "Southern Cross", stars: [[50, 8], [50, 92], [18, 46], [82, 40]], lines: [[0, 1], [2, 3]] },
  {
    name: "Leo the Lion",
    stars: [[22, 18], [12, 30], [14, 46], [26, 60], [32, 44], [30, 28], [62, 48], [88, 60], [66, 74]],
    lines: [[0, 1], [1, 5], [5, 4], [4, 3], [4, 6], [6, 7], [7, 8], [8, 3]],
  },
  {
    name: "Gemini the Twins",
    stars: [[30, 10], [28, 45], [20, 88], [58, 12], [58, 48], [52, 90]],
    lines: [[0, 1], [1, 2], [3, 4], [4, 5], [0, 3], [1, 4]],
  },
  {
    name: "Scorpius the Scorpion",
    stars: [[20, 14], [26, 24], [34, 34], [42, 46], [48, 60], [50, 74], [60, 86], [76, 90], [86, 78]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8]],
  },
  {
    name: "Pegasus the Horse",
    stars: [[30, 30], [70, 30], [70, 70], [30, 70], [92, 86], [8, 14]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [0, 5]],
  },
  {
    name: "Taurus the Bull",
    stars: [[50, 62], [40, 50], [30, 40], [58, 50], [66, 40], [16, 18], [84, 16]],
    lines: [[0, 1], [1, 2], [2, 5], [0, 3], [3, 4], [4, 6]],
  },
];

/** How many stars the whole sky holds, once round. */
export const starsInTheSky = constellations.reduce((sum, pattern) => sum + pattern.stars.length, 0);

/**
 * How a child's lifetime stars fill the sky: constellations fill in order, and once every one is full the sky starts
 * again as a new round (drawn in gold), so it never runs out. Spending doesn't count, so the sky only grows.
 */
export function skyFor(earned: number): { round: number; constellations: (ConstellationPattern & { filled: number })[] } {
  // A full sky stays full until the next star arrives, which starts the next round.
  const round = earned === 0 ? 0 : Math.floor((earned - 1) / starsInTheSky);
  let left = earned - round * starsInTheSky;
  return {
    round,
    constellations: constellations.map((pattern) => {
      const filled = Math.min(pattern.stars.length, left);
      left -= filled;
      return { ...pattern, filled };
    }),
  };
}
