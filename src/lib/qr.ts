/** QR may hold a bare token or a URL such as https://site/play?t=TOKEN. Only the token is used. */
export function extractToken(raw: string): string {
  const v = raw.trim();
  try { const u = new URL(v); return (u.searchParams.get("t") ?? u.pathname.split("/").filter(Boolean).pop() ?? "").trim(); } catch { return v; }
}
const MESSAGES: Record<string, string> = {
  invalid_qr: "That QR code isn't one of your team's checkpoints. Check the team name on the card.",
  out_of_sequence: "Not that one yet. Solve your current checkpoint first, then look for the next.",
  game_not_live: "The game isn't running right now. Wait for the organiser.",
  scan_first: "Scan this checkpoint's QR code first.",
  rate_limited: "Too many tries in a row. Take a breath and try again in a minute.",
  invalid_code: "That team code wasn't recognised. Check it with your organiser.",
  time_up: "Time is up for your team. Please see the organiser.",
  hints_off: "Hints are switched off for this game.",
  no_hint_lives_left: "All 2 hint lives have been used! No more hints can be revealed for your team.",
  not_signed_in: "Please reload the page and try again.",
  not_a_team_member: "Join your team first.",
};
export const friendly = (m?: string) => Object.entries(MESSAGES).find(([k]) => m?.includes(k))?.[1] ?? "Something went wrong. Please try again.";
