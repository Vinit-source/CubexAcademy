# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CubeX Academy (a.k.a. "Cubify") — an interactive 3D Rubik's cube built with React 19 + Three.js (via react-three-fiber) to teach solving algorithms. Scaffolded as a Google AI Studio app; deploys to Cloud Run.

## Commands

- `npm run dev` — Vite dev server on port 3000, host 0.0.0.0
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the built bundle
- `npm run lint` — **type-check only** (`tsc --noEmit`); there is no ESLint and no test suite
- `npm run clean` — remove `dist` and `server.js`

There is no test *suite*, but the cube math lives in a pure module (`src/lib/cube-engine.ts`) that can be round-tripped in Node: `npx tsx <script>.ts` — **run from the repo root** so `node_modules` (incl. `rubiks-cube-solver`) resolves; a scratchpad path won't. Round-trip pattern: solved → scramble → `getFacelets` → `solver()` → `translateSolverSequence` → `applyMove` → assert `isSolved`. `npm run lint` only catches type errors.

## Environment notes

- `@` is aliased to the repo root (see `vite.config.ts` and `tsconfig.json` `paths`), so imports like `@/src/...` resolve from root.
- `DISABLE_HMR=true` disables both HMR and file watching. This is set by AI Studio to stop flicker during agent edits — leave the `vite.config.ts` watch/hmr logic alone unless intentionally changing that behavior.
- `.env.example` documents `GEMINI_API_KEY` and `APP_URL`, injected at runtime by AI Studio. **Note:** `@google/genai` is a dependency and `metadata.json` claims a Gemini capability, but no code in `src/` currently calls Gemini. Don't assume an AI backend exists.

## Architecture

Single-page app. `src/main.tsx` → `App.tsx` mounts one `<Canvas>` containing the cube; all 2D UI (panels, timer, controls) lives in `UI.tsx` and is composed *around* the Canvas via `children`.

Three coordinating pieces:

1. **`src/store.ts` (Zustand)** — global app state: mode (`learning` | `freeplay`), timer, best time, `learnedStages`, `isRotating`, and the **computed solution** (`solutionSteps` + `currentStepIndex`). `STAGES` is a static teaching catalog (name/description/goal per CFOP stage); `buildSolution(facelets)` calls `rubiks-cube-solver` and flattens its `{cross[4], f2l[4], oll, pll}` output into ordered `SolutionStep`s. The learning path is a **real solve of whatever the cube is scrambled to** — not a canned sequence.

2. **`src/lib/cube-engine.ts`** — the pure, framework-free cube math (source of truth, Node-testable). 27 `Piece`s each with `position` (Vector3), `quaternion`, and a 6-slot `colors` array ordered `[R, L, U, D, F, B]` (`null` = inner core). Exports `applyMove` (the single bake path — rotates the move's layer and **rounds positions to integers** to kill float drift), `isOnMove`/`resolveMove` (generalized layer selection: outer faces **plus** wide `r`/`l`/… and slices `M`/`E`/`S`), `progressAngle`/`finalAngle` (rotation driven by **one** `FACE_SIGN` map — no more duplicated sign logic), `getFacelets`/`isSolved`, and notation helpers (`parseMoves`, `translateSolverSequence`, `formatMoves`).

3. **`src/components/Cube.tsx` (`RubiksCube`)** — R3F rendering + the animation queue only (delegates all math to `cube-engine`). Moves are **queued** (`moveQueue`) and animated one at a time in `useFrame` at `ROTATION_SPEED`; a completed move is baked via `applyMove`. Re-renders are forced with a dummy `setRender(r => r+1)` since state lives in refs. Maps each piece's `colors` → Three materials (with glowing `HIGHLIGHT_MATERIALS` for the actively-turning layer; a `RotationArrow` glyph shows turn direction). **Imperative API** (`useImperativeHandle`, called via `cubeRef`): `executeMove(str)` (human notation), `executeSolution(str)` (solver notation), `getFacelets()`, `applyInstant(str)`, `reset()`.

4. **`src/components/UI.tsx`** — all HUD panels in a CSS grid, plus two global input paths: a `keydown` listener (WASD+Q/E → faces, Shift = inverse) and on-screen/touch buttons, both funneling through `onExecuteMove`. Inputs are gated by `isRotating`. The learning panels render from `solutionSteps`/`currentStepIndex`; "Play Step" calls `onExecuteSolution`. The solve timer runs on a `setInterval` here but its start/stop *logic* lives in `App.tsx`'s move callbacks.

**Timer flow is split intentionally:** `App.tsx`'s `handleMoveStart`/`handleMoveEnd` decide *when* to start/stop the timer (freeplay only, ignoring scramble moves via the `isScrambling` ref), while `store.ts` holds the timer state and `UI.tsx` drives the tick. **Freeplay** scramble = 20 animated random moves through the `executeMove` queue. **Learning** scramble (`setupLearning`) applies 25 random moves *instantly* (`applyInstant`), then `buildSolution(getFacelets())` computes the guided steps; Reset retries the same scramble.

`RobotHand` (`Hands.tsx`) is purely decorative — box-geometry hands that twist in sync with the active R/L move's `progress`.

## Conventions

- Styling is **Tailwind v4** via `@tailwindcss/vite`. `src/index.css` holds the **design system**: an `@theme` token layer ("Tactile Puzzle" — plum base, `brand` violet, the six `face-*` cube colors mirrored from `scene-config.ts`, `font-display`/`font-body`/`font-mono`) plus `@layer components` classes — notably `.panel` (surface tile) and `.keycap` (the signature pressable button). Prefer the semantic token utilities (`bg-surface`, `text-muted`, `bg-brand`, `text-face-green`) and `.panel`/`.keycap`/`.chip` over raw `slate-`/`indigo-` palette classes. Use the `cn()` helper in `src/lib/utils.ts` (clsx + tailwind-merge) for conditional classes. Fonts load from CDN via `@import` with system fallbacks.
- Icons come from `lucide-react`.
- Cube move strings use standard Rubik's notation; parsing lives in `cube-engine.ts` (`parseMoves`), not the component.
- **`rubiks-cube-solver` notation is quirky** (handled by `translateSolverToken`): `prime` suffix instead of `'`; lowercase = wide/double-layer (`bprime`); but middle slices come back UPPERCASE with UPPERCASE `PRIME` (`SPRIME`), and half-slice turns as `MPRIME2`. Match the modifier case-insensitively; a `2` always wins over a stray `prime` (180° is its own inverse). Its default orientation (front=green, up=white, right=red) matches this app's colors.
