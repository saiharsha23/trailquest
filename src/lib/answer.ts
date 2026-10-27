/** Case-insensitive, trim-only matching. Internal spaces and punctuation are preserved. */
export const normalizeAnswer = (s: string) => s.trim().toLowerCase();
export const isCorrect = (input: string, accepted: string[]) =>
  accepted.some((a) => normalizeAnswer(a) === normalizeAnswer(input));
