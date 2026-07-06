import { create } from 'zustand';

export type Algorithm = {
  id: string;
  name: string;
  moves: string;
  description: string;
};

export const algorithms: Algorithm[] = [
  { id: '1', name: 'Right Hand Algorithm', moves: 'R U R\' U\'', description: 'The most fundamental sequence. Master this first.' },
  { id: '2', name: 'Left Hand Algorithm', moves: 'L\' U\' L U', description: 'The mirror of the right hand algorithm.' },
  { id: '3', name: 'Sune', moves: 'R U R\' U R U2 R\'', description: 'Used for orienting the last layer corners.' },
  { id: '4', name: 'T-Perm', moves: 'R U R\' U\' R\' F R2 U\' R\' U\' R U R\' F\'', description: 'Used to swap two adjacent corners and two opposite edges.' },
];

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
