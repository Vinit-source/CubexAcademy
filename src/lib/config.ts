/**
 * Tunable gameplay constants, overridable via VITE_-prefixed env vars (see
 * .env.example). Vite inlines `import.meta.env.VITE_*` at build time, so these
 * are resolved once here with safe numeric fallbacks. Only VITE_-prefixed vars
 * reach the client bundle.
 */

const num = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const CONFIG = {
  /** Cube face rotation animation speed, in radians per second (default ≈ 3π). */
  rotationSpeed: num(import.meta.env.VITE_ROTATION_SPEED, Math.PI * 3),
  /** Number of random moves in a freeplay scramble. */
  scrambleMoves: Math.max(1, Math.round(num(import.meta.env.VITE_SCRAMBLE_MOVES, 20))),
  /** Number of random moves used to set up a learning-mode puzzle. */
  learningScrambleMoves: Math.max(1, Math.round(num(import.meta.env.VITE_LEARNING_SCRAMBLE_MOVES, 25))),
};
