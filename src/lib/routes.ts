/** Staggered rotation: team t starts at offset t*step, so positions rarely collide. */
export function generateRoutes(stations: string[], teams: number, k: number): string[][] {
  const n = stations.length;
  if (k > n) throw new Error(`Need at least ${k} active stations (have ${n}).`);
  const step = Math.max(1, Math.floor(n / Math.max(teams, 1)));
  return Array.from({ length: teams }, (_, t) => Array.from({ length: k }, (_, p) => stations[(t * step + p) % n]));
}
export interface Conflict { position: number; station: string; teams: number[] }
/** Same station at the same checkpoint order for several teams = crowding risk. */
export function findConflicts(routes: string[][]): Conflict[] {
  const out: Conflict[] = []; const len = Math.max(0, ...routes.map((r) => r.length));
  for (let p = 0; p < len; p++) { const m = new Map<string, number[]>();
    routes.forEach((r, t) => r[p] && m.set(r[p], [...(m.get(r[p]) ?? []), t]));
    m.forEach((teams, station) => teams.length > 1 && out.push({ position: p + 1, station, teams })); }
  return out;
}
