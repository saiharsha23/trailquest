/** Staggered rotation: team t starts at offset t*step, so positions rarely collide.
 * All teams finish at the single destination (final checkpoint).
 */
export function generateRoutes(stations: string[], teams: number, k: number, destination?: string): string[][] {
  const n = stations.length;
  if (k > n) throw new Error(`Need at least ${k} active stations (have ${n}).`);
  if (k < 1) return Array.from({ length: teams }, () => []);

  // Determine single destination station (defaults to the last station in the list)
  const dest = destination && stations.includes(destination) ? destination : stations[n - 1];

  if (k === 1) {
    return Array.from({ length: teams }, () => [dest]);
  }

  // Remaining pool of stations for intermediate checkpoints
  const pool = stations.filter((s) => s !== dest);
  const m = pool.length; // m = n - 1 >= k - 1
  const step = Math.max(1, Math.floor(m / Math.max(teams, 1)));

  return Array.from({ length: teams }, (_, t) => {
    const intermediate = Array.from({ length: k - 1 }, (_, p) => pool[(t * step + p) % m]);
    return [...intermediate, dest];
  });
}

export interface Conflict { position: number; station: string; teams: number[] }

/** Same station at the same checkpoint order for several teams = crowding risk.
 * If all teams share the same final checkpoint as the single destination, it is not flagged as a crowding conflict.
 */
export function findConflicts(routes: string[][]): Conflict[] {
  const out: Conflict[] = [];
  const len = Math.max(0, ...routes.map((r) => r.length));
  const isCommonDestination =
    len > 1 && routes.length > 1 && routes.every((r) => r.length === len && r[len - 1] === routes[0][len - 1]);
  const checkLen = isCommonDestination ? len - 1 : len;

  for (let p = 0; p < checkLen; p++) {
    const m = new Map<string, number[]>();
    routes.forEach((r, t) => r[p] && m.set(r[p], [...(m.get(r[p]) ?? []), t]));
    m.forEach((teams, station) => teams.length > 1 && out.push({ position: p + 1, station, teams }));
  }
  return out;
}
