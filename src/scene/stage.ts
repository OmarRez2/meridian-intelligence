import type { Sky, Rig } from './Sky';

/** Shared handle to the persistent sky so pages can direct the camera. */
export const stage: { sky: Sky | null } = { sky: null };

export function direct(rig: Partial<Rig>, snap = false) {
  const s = stage.sky;
  if (!s) return;
  Object.assign(s.target, rig);
  if (snap || s.reduced) s.snap();
}

/** Resting composition used behind analytical pages: the instrument seen from high above, far away. */
export const AMBIENT: Partial<Rig> = { p: 0, dist: 44, elev: 1.05, azim: 0.3, lookY: 0, plateX: 0, draw: 1, lines: 0.6, warp: 0, fade: 1, shiftY: 0, stars: 0.4, focus: 0 };

/**
 * Each page keeps the same instrument in the background but sees it from its own angle, so moving
 * between pages feels like walking around one object rather than swapping wallpapers.
 *  - Overview: the territory sky, low and wide, as in the homepage's first chapter
 *  - Observatory: straight down onto the dial, far away and quiet
 *  - Journey: the refinement strata seen edge-on
 *  - Insights: the dial, close and oblique
 *  - Analytics Lab: the dial from high above, turned the other way
 *  - Decision Simulator: the dial lower and closer; it turns a little with the scenario's profit change
 *  - Engineering: the network routes from above
 *  - Team: the constellations, high
 */
export const ROUTE_RIGS: Record<string, Partial<Rig>> = {
  overview: { ...AMBIENT, p: 0, dist: 40, elev: 0.5, azim: -0.5, lookY: 3, stars: 0.8 },
  hub: { ...AMBIENT, p: 3, dist: 46, elev: 1.25, azim: 0.3, lines: 0.5, stars: 0 },
  journey: { ...AMBIENT, p: 2, dist: 40, elev: 0.18, azim: 0.4, lookY: 4.5, stars: 0 },
  insights: { ...AMBIENT, p: 3, dist: 36, elev: 0.6, azim: 0.9, lookY: 2, stars: 0 },
  lab: { ...AMBIENT, p: 3, dist: 50, elev: 1.2, azim: -0.7, lines: 0.4, stars: 0 },
  sim: { ...AMBIENT, p: 3, dist: 38, elev: 0.85, azim: -1.4, lookY: 1.5, lines: 0.5, stars: 0.15 },
  engineering: { ...AMBIENT, p: 1, dist: 42, elev: 1.1, azim: -0.2, stars: 0 },
  team: { ...AMBIENT, p: 0, dist: 34, elev: 0.75, azim: 0.6, lookY: 4, stars: 1 },
};
export const rigFor = (route: string): Partial<Rig> => ROUTE_RIGS[route] ?? AMBIENT;

/** Set by the homepage just before it navigates to the Observatory, so the warp plays instead of the plain veil. */
export const transitionFlags = { warped: false };
