import { create } from 'zustand';
import solver from 'rubiks-cube-solver';
import { expandHalfTurns, translateSolverSequence, toBasicFaceSegments, formatMoves, type FaceLetter } from './lib/cube-engine';

export type Stage = 'cross' | 'f2l' | 'oll' | 'pll';

/** Static teaching content for each CFOP stage (the moves are computed per solve). */
export const STAGES: Record<Stage, { name: string; description: string; goal: string }> = {
  cross: {
    name: 'The Cross',
    description:
      'The foundation. Solve four edges around one center to form a cross, each edge matching its neighbouring centers.',
    goal: 'Build the first-layer cross — four edges lined up with their centers. Everything is built on top of this.',
  },
  f2l: {
    name: 'First Two Layers (F2L)',
    description:
      'Pair each corner with its matching edge and insert them together into a slot. Done four times, this completes the first two layers.',
    goal: 'Fill the four corner–edge slots so the entire bottom two layers are solid.',
  },
  oll: {
    name: 'Orient Last Layer (OLL)',
    description:
      'A single algorithm that twists and flips the last-layer pieces so the whole top face becomes one solid color.',
    goal: 'Make the entire last-layer face one color (orientation only — positions come next).',
  },
  pll: {
    name: 'Permute Last Layer (PLL)',
    description:
      'The final algorithm. Cycle the last-layer corners and edges into their correct positions.',
    goal: 'Slot every last-layer piece into place — the cube is solved.',
  },
};

export const STAGE_ORDER: Stage[] = ['cross', 'f2l', 'oll', 'pll'];

/** One playable step of a computed solution. */
export interface SolutionStep {
  stage: Stage;
  /** Short label, e.g. "Cross — Edge 2", "F2L — Pair 3", "OLL", "PLL". */
  label: string;
  /** Raw rubiks-cube-solver notation for this step (provenance; may contain
   *  wide/slice moves). Playback uses `drill`, not this. */
  moves: string;
  /** Basic-face-only human notation (wide/slice rewritten away), for display. */
  human: string;
  /**
   * The canonical *drilled* sequence: `human` with every 180° turn split into
   * two quarter turns, so each move is one key press. Progress bars, key hints,
   * move matching and "Play step" all read this so they never desync.
   */
  drill: string;
}

/**
 * Compute a real CFOP solution for a facelet string and flatten it into an
 * ordered list of playable steps. Playing every step in order genuinely solves
 * whatever state the cube is in.
 */
export const buildSolution = (facelets: string): SolutionStep[] => {
  const solution = solver(facelets, { partitioned: true }) as {
    cross: string[];
    f2l: string[];
    oll: string;
    pll: string;
  };

  // Gather the raw (solver-notation) steps, then rewrite the whole solution into
  // basic face turns only (no wide/slice — those can't be keyed on WASDQE). The
  // rewrite threads one orientation across all steps, so it must see them
  // together; segment boundaries are preserved so each step keeps its own moves.
  const raw: { stage: Stage; label: string; moves: string }[] = [];
  const add = (stage: Stage, label: string, moves: string) => {
    if (moves && moves.trim()) raw.push({ stage, label, moves });
  };

  solution.cross.forEach((m, i) => add('cross', `Cross — Edge ${i + 1}`, m));
  solution.f2l.forEach((m, i) => add('f2l', `F2L — Pair ${i + 1}`, m));
  add('oll', 'OLL', solution.oll);
  add('pll', 'PLL', solution.pll);

  const basicSegments = toBasicFaceSegments(raw.map((r) => translateSolverSequence(r.moves)));

  return raw.map((r, i) => {
    const basic = basicSegments[i];
    return {
      stage: r.stage,
      label: r.label,
      moves: r.moves, // raw solver notation (provenance)
      human: formatMoves(basic),
      drill: formatMoves(expandHalfTurns(basic)),
    };
  });
};

export type AppMode = 'learning' | 'freeplay';

interface AppState {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  bestTime: number | null;
  setBestTime: (time: number) => void;

  // Timer
  timerRunning: boolean;
  timerStart: number | null;
  timerCurrent: number;
  startTimer: () => void;
  stopTimer: () => void;
  resetTimer: () => void;
  updateTimer: () => void;

  // Learning progress
  learnedStages: Stage[];
  toggleStageLearned: (stage: Stage) => void;

  // Academy modes: Standard (bars only) | Tutorial (also shows keys + vibrates).
  tutorialMode: boolean;
  setTutorialMode: (v: boolean) => void;

  // Computed solution for the current learning puzzle
  solutionSteps: SolutionStep[];
  currentStepIndex: number;
  setSolution: (steps: SolutionStep[]) => void;
  setCurrentStep: (index: number) => void;
  advanceStep: () => void;

  // Fire-once event emitted when a stage is *auto-mastered* by finishing its last
  // drill step (not when a "Stages Mastered" chip is toggled manually). The camera
  // director latches `masteredStage` and flies once per `masteredPulse` bump.
  // Mirrors the `wrongPulse` pattern below.
  masteredStage: Stage | null;
  masteredPulse: number;

  // Whether the auto camera tour plays when a stage is mastered (toggled from the
  // canvas settings popover). Off = mastering a stage never moves the camera.
  cameraAnimationsEnabled: boolean;
  setCameraAnimationsEnabled: (v: boolean) => void;

  // Manual-drill progress within the current step: how many of the step's moves
  // the user has correctly performed. `wrongPulse` increments on a wrong move so
  // the UI can flash the bar red (and the cube can shake in Tutorial mode).
  actionIndex: number;
  advanceAction: () => void;
  resetAction: () => void;
  wrongPulse: number;
  flagWrong: () => void;

  // Fire-once event for "snap the camera to look straight at this face"
  // (pressed via the I/J/K/L/U/O view keys). The StageCameraDirector latches
  // `faceView` and flies once per `faceViewPulse` bump — same pattern as
  // `masteredPulse`, so the keypress in UI.tsx can reach the camera inside the
  // Canvas without prop-drilling.
  faceView: FaceLetter | null;
  faceViewPulse: number;
  requestFaceView: (face: FaceLetter) => void;

  // Cube control
  isRotating: boolean;
  setIsRotating: (isRotating: boolean) => void;
}

export const useStore = create<AppState>((set, get) => ({
  mode: 'learning',
  setMode: (mode) => set({ mode }),
  bestTime: null,
  setBestTime: (time) => set({ bestTime: time }),

  timerRunning: false,
  timerStart: null,
  timerCurrent: 0,
  startTimer: () => {
    set({ timerRunning: true, timerStart: Date.now() - get().timerCurrent, timerCurrent: get().timerCurrent });
  },
  stopTimer: () => set({ timerRunning: false }),
  resetTimer: () => set({ timerRunning: false, timerStart: null, timerCurrent: 0 }),
  updateTimer: () => {
    if (get().timerRunning && get().timerStart) {
      set({ timerCurrent: Date.now() - get().timerStart! });
    }
  },

  learnedStages: [],
  toggleStageLearned: (stage) =>
    set((state) => ({
      learnedStages: state.learnedStages.includes(stage)
        ? state.learnedStages.filter((s) => s !== stage)
        : [...state.learnedStages, stage],
    })),

  tutorialMode: false,
  setTutorialMode: (v) => set({ tutorialMode: v }),

  solutionSteps: [],
  currentStepIndex: 0,
  masteredStage: null,
  masteredPulse: 0,
  cameraAnimationsEnabled: true,
  setCameraAnimationsEnabled: (v) => set({ cameraAnimationsEnabled: v }),
  setSolution: (steps) => set({ solutionSteps: steps, currentStepIndex: 0, actionIndex: 0 }),
  setCurrentStep: (index) => set({ currentStepIndex: index, actionIndex: 0 }),
  // Advances up to one-past-the-last step; that terminal index is the cube's
  // "solved" state in the UI (no step highlighted). Completing the final step of
  // a stage auto-marks that stage mastered, so "Stages Mastered" reflects real
  // progress as you play through a solve (manual toggling still works too).
  advanceStep: () =>
    set((state) => {
      const { solutionSteps, currentStepIndex, learnedStages } = state;
      const completed = solutionSteps[currentStepIndex];
      const nextIndex = Math.min(currentStepIndex + 1, solutionSteps.length);
      let stages = learnedStages;
      // Emit the mastery event only when a stage is newly finished via the drill,
      // so the camera flies once per stage (and never on a manual chip toggle).
      let masteredStage = state.masteredStage;
      let masteredPulse = state.masteredPulse;
      if (completed) {
        const next = solutionSteps[nextIndex];
        const stageFinished = !next || next.stage !== completed.stage;
        if (stageFinished) {
          // Mark the stage mastered (once); fire the camera pulse *every* time a
          // stage is finished, so re-solving after another scramble replays the
          // tour rather than going quiet once every stage has been seen.
          if (!learnedStages.includes(completed.stage)) stages = [...learnedStages, completed.stage];
          masteredStage = completed.stage;
          masteredPulse = state.masteredPulse + 1;
        }
      }
      return { currentStepIndex: nextIndex, learnedStages: stages, actionIndex: 0, masteredStage, masteredPulse };
    }),

  actionIndex: 0,
  advanceAction: () => set((state) => ({ actionIndex: state.actionIndex + 1 })),
  resetAction: () => set({ actionIndex: 0 }),
  wrongPulse: 0,
  flagWrong: () => set((state) => ({ wrongPulse: state.wrongPulse + 1 })),

  faceView: null,
  faceViewPulse: 0,
  requestFaceView: (face) => set((state) => ({ faceView: face, faceViewPulse: state.faceViewPulse + 1 })),

  isRotating: false,
  setIsRotating: (isRotating) => set({ isRotating }),
}));
