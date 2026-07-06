import { create } from 'zustand';
import solver from 'rubiks-cube-solver';
import { solverToHuman } from './lib/cube-engine';

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
  /** Moves in rubiks-cube-solver notation (fed to cube.executeSolution). */
  moves: string;
  /** Same moves in human notation, for display. */
  human: string;
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

  const steps: SolutionStep[] = [];
  const push = (stage: Stage, label: string, moves: string) => {
    if (moves && moves.trim()) steps.push({ stage, label, moves, human: solverToHuman(moves) });
  };

  solution.cross.forEach((m, i) => push('cross', `Cross — Edge ${i + 1}`, m));
  solution.f2l.forEach((m, i) => push('f2l', `F2L — Pair ${i + 1}`, m));
  push('oll', 'OLL', solution.oll);
  push('pll', 'PLL', solution.pll);
  return steps;
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

  // Computed solution for the current learning puzzle
  solutionSteps: SolutionStep[];
  currentStepIndex: number;
  setSolution: (steps: SolutionStep[]) => void;
  setCurrentStep: (index: number) => void;
  advanceStep: () => void;

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

  solutionSteps: [],
  currentStepIndex: 0,
  setSolution: (steps) => set({ solutionSteps: steps, currentStepIndex: 0 }),
  setCurrentStep: (index) => set({ currentStepIndex: index }),
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
      if (completed) {
        const next = solutionSteps[nextIndex];
        const stageFinished = !next || next.stage !== completed.stage;
        if (stageFinished && !learnedStages.includes(completed.stage)) {
          stages = [...learnedStages, completed.stage];
        }
      }
      return { currentStepIndex: nextIndex, learnedStages: stages };
    }),

  isRotating: false,
  setIsRotating: (isRotating) => set({ isRotating }),
}));
