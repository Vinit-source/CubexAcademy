/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { RubiksCube } from './components/Cube';
import { UI } from './components/UI';
import { useStore, LEARNING_START } from './store';

export default function App() {
  const cubeRef = useRef<{ executeMove: (move: string) => void, reset: () => void, applyInstant: (move: string) => void }>(null);
  const isScrambling = useRef(false);
  const mode = useStore((s) => s.mode);
  const [cubeReady, setCubeReady] = useState(false);

  // Set the cube to the learning path's start position on entering learning
  // mode (and back to solved for freeplay). Waits for the cube to mount — it
  // lives inside <Suspense>, so the ref is null until onReady fires.
  useEffect(() => {
    if (!cubeReady || !cubeRef.current) return;
    cubeRef.current.reset();
    if (mode === 'learning') {
      cubeRef.current.applyInstant(LEARNING_START);
      useStore.getState().setCurrentAlgorithm(0);
    }
  }, [mode, cubeReady]);

  const handleExecuteMove = (move: string) => {
    cubeRef.current?.executeMove(move);
  };

  const handleScramble = () => {
    isScrambling.current = true;
    useStore.getState().resetTimer();
    const faces = ['R', 'L', 'U', 'D', 'F', 'B'];
    const modifiers = ['', "'", '2'];
    let scramble = '';
    for (let i = 0; i < 20; i++) {
      const face = faces[Math.floor(Math.random() * faces.length)];
      const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
      scramble += `${face}${modifier} `;
    }
    cubeRef.current?.executeMove(scramble.trim());
  };

  const handleReset = () => {
    cubeRef.current?.reset();
    if (useStore.getState().mode === 'learning') {
      // Restart the guided path from its start position, not a solved cube.
      cubeRef.current?.applyInstant(LEARNING_START);
      useStore.getState().setCurrentAlgorithm(0);
    }
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
      <header className="flex justify-between items-center px-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-500/20">C</div>
          <div>
            <h1 className="text-2xl font-black tracking-tight leading-none uppercase italic">CubeX <span className="text-indigo-400">Academy</span></h1>
            <p className="text-xs text-slate-400 font-medium tracking-widest uppercase hidden sm:block">Interactive 3D Solving Platform</p>
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-12 grid-rows-none md:grid-rows-6 gap-4 min-h-0 overflow-y-auto md:overflow-hidden pb-4 md:pb-0">
        <UI onExecuteMove={handleExecuteMove} onScramble={handleScramble} onReset={handleReset}>
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

