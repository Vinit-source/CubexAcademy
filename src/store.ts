import { create } from 'zustand';

export type Algorithm = {
  id: string;
  name: string;
  moves: string;
  description: string;
  /** What this step is trying to achieve in the overall solve. */
  goal: string;
};

// The learning path is an ordered, layer-by-layer beginner's solve. Played in
// order from the start position (see LEARNING_START), each step completes one
// real stage and the final step leaves the cube solved. The stages use only
// standard face notation (R L U D F B, with ' and 2) — everything the engine
// in Cube.tsx understands.
export const algorithms: Algorithm[] = [
  {
    id: '1',
    name: 'The Cross',
    moves: "F R' D'",
    description: 'The foundation. Line up four edges of one colour around a center to form a cross on the bottom face.',
    goal: 'Build the cross on the bottom layer — four edges matching their center. The whole solve is built on top of this.',
  },
  {
    id: '2',
    name: 'First Layer',
    moves: "R U R' U'",
    description: "The right-hand trigger R U R' U'. Repeated, it drops a corner from the top into its slot without disturbing the layer below.",
    goal: 'Seat the bottom-layer corners so the entire first face is solid.',
  },
  {
    id: '3',
    name: 'Second Layer',
    moves: "U R U' R' U' F' U F",
    description: "Sends a top-layer edge down into the middle row so it sits between two centers.",
    goal: 'Place the middle-layer edges — the first two layers are now complete.',
  },
  {
    id: '4',
    name: 'Last-Layer Cross',
    moves: "F R U R' U' F'",
    description: "F R U R' U' F' flips the top edges upward. Apply it until a cross appears on the top face.",
    goal: 'Orient the last-layer edges to form a cross on the top face.',
  },
  {
    id: '5',
    name: 'Orient Corners (Sune)',
    moves: "R U R' U R U2 R'",
    description: "Sune twists the last corners so the top colour points upward.",
    goal: 'Orient the last-layer corners so the whole top face is one solid colour.',
  },
  {
    id: '6',
    name: 'Permute (T-Perm)',
    moves: "R U R' U' R' F R2 U' R' U' R U R' F'",
    description: "T-Perm swaps two adjacent corners and two edges to drop the final pieces home.",
    goal: 'Slot the last pieces into place — the cube is solved.',
  },
];

/**
 * Invert a space-separated move sequence (reverse order, invert each move).
 * A move and its inverse compose to identity in the Cube.tsx engine, so
 * applying LEARNING_START and then every stage in order returns the cube to
 * solved — that is the guarantee behind the guided solve.
 */
export function invertMoves(seq: string): string {
  return seq
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reverse()
    .map((m) => (m.endsWith('2') ? m : m.endsWith("'") ? m.slice(0, -1) : m + "'"))
    .join(' ');
}

/** Start position for the learning path: the inverse of the full solve. */
export const LEARNING_START = invertMoves(algorithms.map((a) => a.moves).join(' '));

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

  // Learning Progress
  learnedAlgorithms: string[];
  markLearned: (id: string) => void;
  currentAlgorithmIndex: number;
  setCurrentAlgorithm: (index: number) => void;

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

  learnedAlgorithms: [],
  markLearned: (id) => set((state) => ({ 
    learnedAlgorithms: state.learnedAlgorithms.includes(id) 
      ? state.learnedAlgorithms 
      : [...state.learnedAlgorithms, id] 
  })),
  currentAlgorithmIndex: 0,
  setCurrentAlgorithm: (index) => set({ currentAlgorithmIndex: index }),

  isRotating: false,
  setIsRotating: (isRotating) => set({ isRotating }),
}));
