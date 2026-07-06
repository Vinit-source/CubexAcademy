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

There are no tests. "Verifying" a change means running the app and exercising the cube; `npm run lint` only catches type errors.

## Environment notes

- `@` is aliased to the repo root (see `vite.config.ts` and `tsconfig.json` `paths`), so imports like `@/src/...` resolve from root.
- `DISABLE_HMR=true` disables both HMR and file watching. This is set by AI Studio to stop flicker during agent edits — leave the `vite.config.ts` watch/hmr logic alone unless intentionally changing that behavior.
- `.env.example` documents `GEMINI_API_KEY` and `APP_URL`, injected at runtime by AI Studio. **Note:** `@google/genai` is a dependency and `metadata.json` claims a Gemini capability, but no code in `src/` currently calls Gemini. Don't assume an AI backend exists.

## Architecture

Single-page app. `src/main.tsx` → `App.tsx` mounts one `<Canvas>` containing the cube; all 2D UI (panels, timer, controls) lives in `UI.tsx` and is composed *around* the Canvas via `children`.

Three coordinating pieces:

1. **`src/store.ts` (Zustand)** — global app state: mode (`learning` | `freeplay`), timer, best time, learned-algorithm ids, current algorithm index, and `isRotating`. The list of teachable `algorithms` (name, move string, description) is a hardcoded const here.

2. **`src/components/Cube.tsx` (`RubiksCube`)** — the engine. Key design decisions:
   - The cube is **27 pieces stored in a ref** (`pieces.current`), each with a `position` (Vector3), `quaternion`, and a 6-element `materials` array ordered `[R, L, U, D, F, B]`. Non-visible inner faces use a shared `CORE` (black) material.
   - Moves are **queued** (`moveQueue`) and animated one at a time inside `useFrame`, interpolating `progress` toward π/2 (or π for `2` turns) at `ROTATION_SPEED`. During animation, on-face pieces are rendered at a *temporary* rotated transform; when a move completes, the rotation is baked into each piece's `position`/`quaternion` and **positions are rounded to integers** to kill floating-point drift.
   - Re-renders during animation are forced with a dummy `setRender(r => r+1)` counter — state lives in refs, not React state, so React must be nudged each frame.
   - **Exposes an imperative API via `useImperativeHandle`:** `executeMove(moveStr)` (space-separated standard notation, e.g. `"R U R' U'"`, where `'` = counter-clockwise and `2` = 180°) and `reset()`. `App.tsx` calls these through `cubeRef`.
   - `checkSolved()` verifies each visible face's material matches the expected material for its current outward normal.
   - **Gotcha — rotation sign mapping:** the clockwise/counter-clockwise sign per face is duplicated in two places (the `getAngleSign`/inline-`sign` used for the finalized bake, and the inline `sign` used for the live display transform). They must stay in sync. `getAngle` and `getAngleSign` also contain dead/experimental code and exploratory comments — treat the actual behavior in `useFrame` and the render loop as source of truth, not those helpers.

3. **`src/components/UI.tsx`** — all HUD panels in a CSS grid, plus two global input paths: a `keydown` listener (R/L/U/D/F/B, Shift = inverse) and on-screen/touch buttons, both funneling through `onExecuteMove`. Inputs are gated by `isRotating`. The solve timer runs on a `setInterval` here but its start/stop *logic* lives in `App.tsx`'s move callbacks.

**Timer flow is split intentionally:** `App.tsx`'s `handleMoveStart`/`handleMoveEnd` decide *when* to start/stop the timer (freeplay only, ignoring scramble moves via the `isScrambling` ref), while `store.ts` holds the timer state and `UI.tsx` drives the tick. Scrambling generates 20 random moves and routes them through the same `executeMove` queue.

`RobotHand` (`Hands.tsx`) is purely decorative — box-geometry hands that twist in sync with the active R/L move's `progress`.

## Conventions

- Styling is **Tailwind v4** via `@tailwindcss/vite` (`src/index.css` is just `@import "tailwindcss"`). Use the `cn()` helper in `src/lib/utils.ts` (clsx + tailwind-merge) for conditional classes.
- Icons come from `lucide-react`.
- Cube move strings use standard Rubik's notation; parsing lives in `executeMove` (first char = face, presence of `'` or `2` = modifier).
