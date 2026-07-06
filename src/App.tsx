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
import { StageCameraDirector } from './components/StageCameraDirector';
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
    <div className="bg-ink text-fg h-screen w-full p-4 md:p-6 flex flex-col gap-4 md:gap-6 overflow-hidden">
      <GuideModal open={showGuide} onClose={() => setShowGuide(false)} />
      <header className="flex justify-between items-center px-1 shrink-0">
        <div className="flex items-center gap-3">
          {/* Logo: a little cube built from four sticker colors. */}
          <div className="grid grid-cols-2 gap-[3px] p-[5px] rounded-[14px] bg-surface-2 border border-line shadow-lg">
            <span className="w-3.5 h-3.5 rounded-[3px] bg-face-white" />
            <span className="w-3.5 h-3.5 rounded-[3px] bg-face-red" />
            <span className="w-3.5 h-3.5 rounded-[3px] bg-face-green" />
            <span className="w-3.5 h-3.5 rounded-[3px] bg-face-yellow" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight leading-none">CubeX <span className="text-brand-soft">Academy</span></h1>
            <p className="text-xs text-muted font-medium tracking-widest uppercase hidden sm:block">Learn to solve, one turn at a time</p>
          </div>
        </div>
        <button
          onClick={() => setShowGuide(true)}
          className="keycap flex items-center gap-2 px-3.5 py-2 text-xs font-bold uppercase tracking-wider"
        >
          <BookOpen className="w-4 h-4 text-brand-soft" />
          <span className="hidden sm:inline">How to solve</span>
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

            {/* Drives the camera on a tour when a CFOP stage is mastered. */}
            <StageCameraDirector />
          </Canvas>
        </UI>
      </main>

      <footer className="text-center py-2 hidden md:block shrink-0">
        <p className="text-[10px] text-faint font-medium tracking-widest uppercase">Drag to orbit • Keyboard letters turn faces</p>
        <p className="text-[9px] text-faint/70 font-medium tracking-wider mt-1">
          Hand model “Low Poly Right Hand” by Raziq Brown, licensed{' '}
          <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer" className="underline hover:text-muted">CC-BY 3.0</a>
          {', via '}
          <a href="https://poly.pizza/m/cl8ax5B13cp" target="_blank" rel="noreferrer" className="underline hover:text-muted">Poly Pizza</a>
        </p>
      </footer>
    </div>
  );
}

