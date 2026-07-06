/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { BookOpen } from 'lucide-react';
import { RubiksCube } from './components/Cube';
import { UI } from './components/UI';
import { GuideModal } from './components/GuideModal';
import { useStore, buildSolution } from './store';
import { CONFIG } from './lib/config';
import { parseMoves, formatMove, formatMoves, type Move } from './lib/cube-engine';

// A user's keyboard/touch move (single face quarter/prime) "satisfies" the
// expected drill token when it's the same face turned the right way. Half turns
// accept either direction; wide/slice tokens can't be keyed (use the chip).
const FACE_KEYS = 'RLUDFB';
const drillMatch = (user: Move, expected: Move): boolean => {
  if (expected.wide || !FACE_KEYS.includes(expected.face)) return false;
  if (user.face !== expected.face) return false;
  if (expected.dir === 2) return true;
  return Math.sign(user.dir) === Math.sign(expected.dir);
};

type CubeHandle = {
  executeMove: (move: string) => void;
  executeSolution: (move: string) => void;
  getFacelets: () => string;
  applyInstant: (move: string) => void;
  reset: () => void;
};

const randomScramble = (n: number): string => {
  const faces = ['R', 'L', 'U', 'D', 'F', 'B'];
  const modifiers = ['', "'", '2'];
  const moves: string[] = [];
  for (let i = 0; i < n; i++) {
    const face = faces[Math.floor(Math.random() * faces.length)];
    const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
    moves.push(`${face}${modifier}`);
  }
  return moves.join(' ');
};

export default function App() {
  const cubeRef = useRef<CubeHandle>(null);
  const isScrambling = useRef(false);
  // The scramble for the current learning puzzle, so Reset can retry it.
  const learningScramble = useRef('');
  const mode = useStore((s) => s.mode);
  const [cubeReady, setCubeReady] = useState(false);
  // Show the instructions guide on every page load / refresh.
  const [showGuide, setShowGuide] = useState(true);

  // Scramble the cube instantly, then compute a real CFOP solution from the
  // resulting state so the learning path can walk it stage by stage. Pass
  // newPuzzle=false to retry the same scramble (Reset in learning mode).
  const setupLearning = (newPuzzle: boolean) => {
    const cube = cubeRef.current;
    if (!cube) return;
    if (newPuzzle || !learningScramble.current) learningScramble.current = randomScramble(CONFIG.learningScrambleMoves);
    cube.reset();
    cube.applyInstant(learningScramble.current);
    try {
      useStore.getState().setSolution(buildSolution(cube.getFacelets()));
    } catch {
      useStore.getState().setSolution([]);
    }
    useStore.getState().resetTimer();
  };

  // On entering learning mode, generate a puzzle + solution; freeplay starts
  // solved. Waits for the cube to mount (it lives inside <Suspense>, so the ref
  // is null until onReady fires).
  useEffect(() => {
    if (!cubeReady || !cubeRef.current) return;
    if (mode === 'learning') {
      setupLearning(true);
    } else {
      cubeRef.current.reset();
      useStore.getState().resetTimer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cubeReady]);

  // Perform the current step's expected move, advance the drill, and roll over
  // to the next step when the step's last move is done. Shared by keyboard/touch
  // (validated) and the clickable action bar (always the correct move).
  const performDrillMove = (target: Move, total: number) => {
    cubeRef.current?.executeMove(formatMove(target));
    const store = useStore.getState();
    if (store.actionIndex + 1 >= total) store.advanceStep();
    else store.advanceAction();
  };

  // A move produced by keyboard/touch. In freeplay it just runs; in Academy it's
  // graded against the current step's expected move (correct → perform + advance,
  // wrong → flag for the red flash / cube shake).
  const handleExecuteMove = (moveStr: string) => {
    const store = useStore.getState();
    if (store.mode !== 'learning') {
      cubeRef.current?.executeMove(moveStr);
      return;
    }
    if (store.isRotating) return;
    const step = store.solutionSteps[store.currentStepIndex];
    if (!step) return;
    const expected = parseMoves(step.human);
    const target = expected[store.actionIndex];
    const user = parseMoves(moveStr)[0];
    if (target && user && drillMatch(user, target)) performDrillMove(target, expected.length);
    else store.flagWrong();
  };

  // Clicking the active bar performs the expected move directly — the guaranteed
  // input for tokens the keyboard can't produce (half/wide/slice turns).
  const handleDrillAction = () => {
    const store = useStore.getState();
    if (store.mode !== 'learning' || store.isRotating) return;
    const step = store.solutionSteps[store.currentStepIndex];
    if (!step) return;
    const expected = parseMoves(step.human);
    const target = expected[store.actionIndex];
    if (target) performDrillMove(target, expected.length);
  };

  // "Play Step" plays the step's remaining moves (from where the drill is) and
  // advances — the "show me" path, and how OLL/PLL get solved hands-free.
  const handleExecuteSolution = () => {
    const store = useStore.getState();
    if (store.isRotating) return;
    const step = store.solutionSteps[store.currentStepIndex];
    if (!step) return;
    const remaining = parseMoves(step.human).slice(store.actionIndex);
    if (remaining.length) cubeRef.current?.executeMove(formatMoves(remaining));
    store.advanceStep();
  };

  const handleScramble = () => {
    if (useStore.getState().mode === 'learning') {
      setupLearning(true);
      return;
    }
    isScrambling.current = true;
    useStore.getState().resetTimer();
    cubeRef.current?.executeMove(randomScramble(CONFIG.scrambleMoves));
  };

  const handleReset = () => {
    if (useStore.getState().mode === 'learning') {
      // Retry the same puzzle from its scrambled start.
      setupLearning(false);
      return;
    }
    cubeRef.current?.reset();
    useStore.getState().resetTimer();
  };

  const handleMoveStart = () => {
    const store = useStore.getState();
    if (!isScrambling.current && store.mode === 'freeplay' && !store.timerRunning) {
      store.startTimer();
    }
  };

  const handleMoveEnd = (isSolved: boolean) => {
    if (isScrambling.current) {
      isScrambling.current = false;
      return;
    }
    const store = useStore.getState();
    if (store.mode === 'freeplay' && isSolved && store.timerRunning) {
      store.stopTimer();
      const current = store.timerCurrent;
      const best = store.bestTime;
      if (best === null || current < best) {
        store.setBestTime(current);
      }
    }
  };

  return (
    <div className="bg-slate-950 text-slate-100 h-screen w-full p-4 md:p-6 flex flex-col gap-4 md:gap-6 font-sans overflow-hidden">
      <GuideModal open={showGuide} onClose={() => setShowGuide(false)} />
      <header className="flex justify-between items-center px-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-500/20">C</div>
          <div>
            <h1 className="text-2xl font-black tracking-tight leading-none uppercase italic">CubeX <span className="text-indigo-400">Academy</span></h1>
            <p className="text-xs text-slate-400 font-medium tracking-widest uppercase hidden sm:block">Interactive 3D Solving Platform</p>
          </div>
        </div>
        <button
          onClick={() => setShowGuide(true)}
          className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          <span className="hidden sm:inline">Instructions</span>
        </button>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-12 grid-rows-none md:grid-rows-6 gap-4 min-h-0 overflow-y-auto md:overflow-hidden pb-4 md:pb-0">
        <UI onExecuteMove={handleExecuteMove} onExecuteSolution={handleExecuteSolution} onDrillAction={handleDrillAction} onScramble={handleScramble} onReset={handleReset}>
          <Canvas camera={{ position: [5, 4, 6], fov: 45 }}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
            <directionalLight position={[-10, -10, -5]} intensity={0.5} />
            <Environment preset="city" />

            <Suspense fallback={null}>
              <group position={[0, -0.5, 0]}>
                <RubiksCube ref={cubeRef} onMoveStart={handleMoveStart} onMoveEnd={handleMoveEnd} onReady={() => setCubeReady(true)} />
              </group>
            </Suspense>

            <ContactShadows
              position={[0, -2.5, 0]}
              opacity={0.4}
              scale={10}
              blur={2.5}
              far={4}
            />

            <OrbitControls
              enablePan={false}
              minDistance={4}
              maxDistance={12}
              makeDefault
            />
          </Canvas>
        </UI>
      </main>

      <footer className="text-center py-2 hidden md:block shrink-0">
        <p className="text-[10px] text-slate-600 font-medium tracking-widest uppercase">Interaction Hint: Use mouse to orbit • Keyboard letters for face rotation</p>
        <p className="text-[9px] text-slate-700 font-medium tracking-wider mt-1">
          Hand model “Low Poly Right Hand” by Raziq Brown, licensed{' '}
          <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer" className="underline hover:text-slate-500">CC-BY 3.0</a>
          {', via '}
          <a href="https://poly.pizza/m/cl8ax5B13cp" target="_blank" rel="noreferrer" className="underline hover:text-slate-500">Poly Pizza</a>
        </p>
      </footer>
    </div>
  );
}

