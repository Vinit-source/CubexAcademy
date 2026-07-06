import React, { useEffect, useState } from 'react';
import { useStore, STAGES, STAGE_ORDER } from '../store';
import { Play, CheckCircle2, Shuffle, RotateCcw, Gamepad2, GraduationCap, Trophy, Sparkles, Lightbulb } from 'lucide-react';
import { cn } from '../lib/utils';
import { StageDiagram } from './StageDiagram';
import { parseMoves, type Move } from '../lib/cube-engine';

// Physical key -> cube face. WASD cluster drives Up/Down/Right/Left; Q/E the
// Front/Back faces. Shift on any of them applies the inverse turn.
const KEY_TO_FACE: Record<string, string> = {
  W: 'U', S: 'D', D: 'R', A: 'L', Q: 'F', E: 'B',
};
const FACE_TO_KEY: Record<string, string> = { U: 'W', D: 'S', R: 'D', L: 'A', F: 'Q', B: 'E' };

// The physical key(s) to press for an expected move (Tutorial hint). Half turns
// need two presses; wide/slice moves have no key, so the user taps the bar.
const keyHint = (m: Move): string => {
  const key = FACE_TO_KEY[m.face];
  if (m.wide || !key) return 'Tap bar';
  if (m.dir === 2) return `${key} ×2`;
  if (m.dir === -1) return `⇧ ${key}`;
  return key;
};

interface UIProps {
  onExecuteMove: (move: string) => void;
  onExecuteSolution: () => void;
  onDrillAction: () => void;
  onScramble: () => void;
  onReset: () => void;
  children: React.ReactNode;
}

export function UI({ onExecuteMove, onExecuteSolution, onDrillAction, onScramble, onReset, children }: UIProps) {
  const {
    mode,
    setMode,
    bestTime,
    timerRunning,
    timerCurrent,
    startTimer,
    stopTimer,
    resetTimer,
    updateTimer,
    learnedStages,
    toggleStageLearned,
    tutorialMode,
    setTutorialMode,
    solutionSteps,
    currentStepIndex,
    setCurrentStep,
    actionIndex,
    wrongPulse,
    isRotating
  } = useStore();

  const currentStep = solutionSteps[currentStepIndex];
  const currentStage = currentStep ? STAGES[currentStep.stage] : null;
  const stageLearned = currentStep ? learnedStages.includes(currentStep.stage) : false;
  const solveComplete = solutionSteps.length > 0 && currentStepIndex >= solutionSteps.length;
  // Index of the current step within its stage (0-based) — which cross edge /
  // f2l pair we're on, for the StageDiagram highlight.
  const subStepIndex = currentStep
    ? solutionSteps.slice(0, currentStepIndex).filter((s) => s.stage === currentStep.stage).length
    : 0;
  // The move tokens of the current step drive the progress bars.
  const stepMoves: Move[] = currentStep ? parseMoves(currentStep.human) : [];

  // Flash the active bar red briefly when the user makes a wrong move.
  const [flashWrong, setFlashWrong] = useState(false);
  useEffect(() => {
    if (wrongPulse === 0) return;
    setFlashWrong(true);
    const t = setTimeout(() => setFlashWrong(false), 400);
    return () => clearTimeout(t);
  }, [wrongPulse]);

  // Timer loop
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timerRunning) {
      interval = setInterval(updateTimer, 10);
    }
    return () => clearInterval(interval);
  }, [timerRunning, updateTimer]);

  // Format time
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  // Keyboard controls — WASD + Q/E map to cube faces (Shift = inverse).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isRotating) return;
      const key = e.key.toUpperCase();
      const shift = e.shiftKey;

      const face = KEY_TO_FACE[key];
      if (face) {
        onExecuteMove(`${face}${shift ? "'" : ""}`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRotating, onExecuteMove]);

  return (
    <>
      {/* 1. Learning Path / Mode Switch */}
      <div className="col-span-1 md:col-span-3 md:row-span-4 bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
        <div className="flex bg-slate-800 rounded-lg p-1">
          <button 
            onClick={() => setMode('learning')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors",
              mode === 'learning' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <GraduationCap size={14} /> Academy
          </button>
          <button 
            onClick={() => setMode('freeplay')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors",
              mode === 'freeplay' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Gamepad2 size={14} /> Freeplay
          </button>
        </div>

        {mode === 'learning' ? (
          <>
            <div className="flex justify-between items-center mt-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Learning Path</h3>
                <button
                  onClick={() => setTutorialMode(!tutorialMode)}
                  title="Toggle Tutorial mode (shows the keys to press + vibrates on a wrong move)"
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-colors',
                    tutorialMode ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                  )}
                >
                  <Lightbulb className="w-3 h-3" /> {tutorialMode ? 'Tutorial' : 'Standard'}
                </button>
              </div>
              {solutionSteps.length > 0 && (
                <span className="text-xs font-mono text-indigo-400 font-bold shrink-0">
                  {Math.min(currentStepIndex + 1, solutionSteps.length)}/{solutionSteps.length}
                </span>
              )}
            </div>
            {solutionSteps.length === 0 ? (
              <div className="flex-1 flex flex-col justify-center items-center text-center gap-3 text-slate-500">
                <Shuffle className="w-8 h-8" />
                <p className="text-xs">Hit <span className="font-bold text-indigo-400">Scramble</span> to generate a real, step-by-step solution to walk through.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-2">
                {solutionSteps.map((step, idx) => {
                  const isActive = idx === currentStepIndex && !solveComplete;
                  const isDone = idx < currentStepIndex;
                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentStep(idx)}
                      className={cn(
                        "p-2.5 rounded-xl flex items-center gap-3 text-left transition-all",
                        isActive ? "bg-indigo-600/10 border border-indigo-500/30" : "bg-slate-800/40 hover:bg-slate-800/60",
                        !isActive && !isDone && "opacity-60"
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0",
                        isActive ? "bg-indigo-500 text-white" : "bg-slate-700 text-slate-300",
                        isDone && !isActive && "bg-emerald-500/20 text-emerald-500"
                      )}>
                        {isDone ? <CheckCircle2 className="w-4 h-4" /> : (idx + 1).toString().padStart(2, '0')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs font-bold leading-tight truncate", isActive ? "text-white" : "text-slate-300")}>{step.label}</p>
                        <p className="text-[10px] font-mono text-slate-500 truncate">{step.human}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center text-center gap-4">
            <Gamepad2 size={48} className="text-slate-700" />
            <h3 className="text-lg font-bold text-white">Freeplay Mode</h3>
            <p className="text-xs text-slate-400">Scramble the cube and start solving! The timer will automatically start on your first move.</p>
          </div>
        )}
      </div>

      {/* 2. 3D Canvas */}
      <div className="col-span-1 md:col-span-6 md:row-span-4 bg-slate-900 border-2 border-indigo-500/20 rounded-3xl relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 to-indigo-950/30 min-h-[300px]">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
        
        {/* Canvas goes here */}
        <div className="w-full h-full relative z-10">
          {children}
        </div>

        {/* Drill progress bars — one per move in the current step. The active
            bar is tappable (guaranteed input for half/wide/slice moves); green =
            done, indigo = current, red = last move was wrong. */}
        {mode === 'learning' && currentStep && !solveComplete && stepMoves.length > 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-md flex flex-col items-center gap-2 pointer-events-none">
            <div className="flex gap-1.5 w-full">
              {stepMoves.map((_, i) => {
                const done = i < actionIndex;
                const current = i === actionIndex;
                return (
                  <button
                    key={i}
                    disabled={!current || isRotating}
                    onClick={onDrillAction}
                    aria-label={current ? 'Perform this move' : undefined}
                    className={cn(
                      'h-2.5 flex-1 rounded-full transition-colors',
                      done && 'bg-emerald-500',
                      current && (flashWrong ? 'bg-rose-500' : 'bg-indigo-400 animate-pulse pointer-events-auto cursor-pointer'),
                      !done && !current && 'bg-slate-700/80'
                    )}
                  />
                );
              })}
            </div>
            {tutorialMode && stepMoves[actionIndex] && (
              <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur px-3 py-1.5 rounded-full shadow-lg">
                <span className="text-[9px] text-slate-400 uppercase tracking-widest">Press</span>
                <kbd className="bg-slate-800 border-b-2 border-slate-950 px-2 py-0.5 rounded font-mono text-xs font-bold text-white">
                  {keyHint(stepMoves[actionIndex])}
                </kbd>
                <span className="text-xs font-mono font-bold text-indigo-300">{currentStep!.human.split(/\s+/)[actionIndex]}</span>
              </div>
            )}
          </div>
        )}

        {/* Current step overlay inside the Canvas area */}
        {mode === 'learning' && (currentStep || solveComplete) && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full text-center z-20 pointer-events-none">
            {solveComplete ? (
              <div className="inline-flex items-center gap-2 bg-emerald-600/90 backdrop-blur px-4 py-2 rounded-full text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/40">
                <Sparkles className="w-4 h-4" /> Solved
              </div>
            ) : (
              <>
                <div className="inline-block bg-indigo-600/90 backdrop-blur px-4 py-2 rounded-full text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/40">
                  {currentStep!.human}
                </div>
                <p className="text-[10px] text-slate-400 mt-2 font-medium uppercase drop-shadow-md">{currentStep!.label}</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* 3. Timer */}
      <div className="col-span-1 md:col-span-3 md:row-span-3 bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col justify-center items-center shadow-xl relative">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 absolute top-5 left-5">Solve Timer</h3>
        
        {bestTime !== null && mode === 'freeplay' && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md">
            <Trophy size={12} />
            <span className="text-[10px] font-mono font-bold">{formatTime(bestTime)}</span>
          </div>
        )}

        <div className="text-4xl lg:text-5xl font-mono font-bold text-white tracking-tighter tabular-nums mt-6">
          {formatTime(timerCurrent).split('.')[0]}<span className="text-indigo-400">.{formatTime(timerCurrent).split('.')[1]}</span>
        </div>
        
        <div className="mt-6 grid grid-cols-2 gap-4 w-full">
          <button
            onClick={timerRunning ? stopTimer : startTimer}
            className={cn(
              "p-2 rounded-lg text-center font-bold text-xs uppercase tracking-wider transition-colors",
              timerRunning 
                ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
            )}
          >
            {timerRunning ? 'Stop' : timerCurrent > 0 ? 'Resume' : 'Start'}
          </button>
          <button
            onClick={resetTimer}
            className="p-2 rounded-lg text-center font-bold text-xs uppercase tracking-wider bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* 4. Progress — per-stage mastery (auto-fills as you complete each stage) */}
      <div className="col-span-1 md:col-span-3 md:row-span-1 bg-indigo-600 rounded-2xl p-4 flex flex-col justify-center gap-2 shadow-lg shadow-indigo-600/20">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest opacity-80 text-white">Stages Mastered</span>
          <span className="text-sm font-black text-white tabular-nums">{learnedStages.length}/{STAGE_ORDER.length}</span>
        </div>
        <div className="flex gap-1.5">
          {STAGE_ORDER.map((s) => {
            const done = learnedStages.includes(s);
            const active = currentStep?.stage === s && !solveComplete;
            return (
              <div
                key={s}
                title={STAGES[s].name}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 rounded-md py-1 text-[9px] font-black uppercase tracking-wider transition-colors",
                  done ? "bg-white text-indigo-700" : "bg-white/10 text-white/70",
                  active && !done && "ring-2 ring-white/70"
                )}
              >
                {done && <CheckCircle2 className="w-3 h-3" />}
                {s.toUpperCase()}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Keyboard Mapping & Touch Controls */}
      <div className="col-span-1 md:col-span-4 md:row-span-2 bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Controls</h3>
          <div className="flex gap-2">
            <button
              onClick={onReset}
              disabled={isRotating}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-200 disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
            <button
              onClick={onScramble}
              disabled={isRotating}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
            >
              <Shuffle className="w-3 h-3" /> Scramble
            </button>
          </div>
        </div>
        
        <div className="hidden md:grid grid-cols-3 gap-2">
          <div className="flex items-center gap-2">
            <kbd className="bg-slate-800 border-b-4 border-slate-950 px-2 py-1 rounded-md font-mono text-xs font-bold">W</kbd>
            <span className="text-[10px] font-medium text-slate-300 uppercase"><span className="font-bold">[U]</span> Up</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="bg-slate-800 border-b-4 border-slate-950 px-2 py-1 rounded-md font-mono text-xs font-bold">D</kbd>
            <span className="text-[10px] font-medium text-slate-300 uppercase"><span className="font-bold">[R]</span> Right</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="bg-slate-800 border-b-4 border-slate-950 px-2 py-1 rounded-md font-mono text-xs font-bold">Q</kbd>
            <span className="text-[10px] font-medium text-slate-300 uppercase"><span className="font-bold">[F]</span> Front</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="bg-slate-800 border-b-4 border-slate-950 px-2 py-1 rounded-md font-mono text-xs font-bold">S</kbd>
            <span className="text-[10px] font-medium text-slate-300 uppercase"><span className="font-bold">[D]</span> Down</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="bg-slate-800 border-b-4 border-slate-950 px-2 py-1 rounded-md font-mono text-xs font-bold">A</kbd>
            <span className="text-[10px] font-medium text-slate-300 uppercase"><span className="font-bold">[L]</span> Left</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="bg-slate-800 border-b-4 border-slate-950 px-2 py-1 rounded-md font-mono text-xs font-bold">E</kbd>
            <span className="text-[10px] font-medium text-slate-300 uppercase"><span className="font-bold">[B]</span> Back</span>
          </div>
        </div>
        <div className="hidden md:block mt-auto text-[9px] text-slate-500 font-medium uppercase tracking-widest text-center">
          Hold Shift for inverse rotation (')
        </div>

        {/* Mobile Touch Controls */}
        <div className="md:hidden grid grid-cols-4 gap-2 touch-manipulation flex-1">
          {['R', 'L', 'U', 'D', 'F', 'B'].map((move) => (
            <React.Fragment key={move}>
              <button
                disabled={isRotating}
                onClick={() => onExecuteMove(move)}
                className="bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border-b-4 border-slate-950 text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {move}
              </button>
              <button
                disabled={isRotating}
                onClick={() => onExecuteMove(`${move}'`)}
                className="bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border-b-4 border-slate-950 text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {move}'
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 6. Execution & Action */}
      <div className="col-span-1 md:col-span-8 md:row-span-2 bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
        {mode === 'learning' ? (
          solveComplete ? (
            <div className="flex-1 flex flex-col justify-center items-center text-center gap-3">
              <Sparkles className="w-10 h-10 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Cube Solved!</h3>
              <p className="text-xs text-slate-400">Scramble again for a fresh solve, or hit Reset to retry this one.</p>
            </div>
          ) : !currentStep || !currentStage ? (
            <div className="flex-1 flex flex-col justify-center items-center text-center gap-3">
              <GraduationCap className="w-10 h-10 text-slate-600" />
              <p className="text-sm text-slate-400">Scramble the cube to generate a guided, step-by-step CFOP solve.</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{currentStage.name} · {currentStep.label}</h3>
                {stageLearned && (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> Mastered
                  </span>
                )}
              </div>

              <div className="flex items-start gap-3 mb-3">
                <p className="text-sm text-slate-300 flex-1">{currentStage.description}</p>
                <StageDiagram stage={currentStep.stage} highlight={subStepIndex} className="mt-0.5" />
              </div>

              <div className="mb-4 flex items-start gap-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-3 py-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mt-0.5 shrink-0">Goal</span>
                <p className="text-xs text-slate-300 leading-relaxed">{currentStage.goal}</p>
              </div>

              <div className="flex gap-4 mt-auto">
                <button
                  onClick={() => toggleStageLearned(currentStep.stage)}
                  className={cn(
                    "flex-1 p-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border flex items-center justify-center gap-2",
                    stageLearned
                      ? "bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-300"
                      : "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                  )}
                >
                  {stageLearned ? 'Mark Unmastered' : 'Mark Mastered'}
                </button>

                <button
                  onClick={() => onExecuteSolution()}
                  disabled={isRotating}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-colors disabled:opacity-50 disabled:shadow-none"
                >
                  <Play className="w-4 h-4" fill="currentColor" />
                  Play Step
                </button>
              </div>
            </>
          )
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center">
             <p className="text-sm text-slate-400 font-medium">Use the keyboard or on-screen controls to solve the cube!</p>
          </div>
        )}
      </div>
    </>
  );
}
