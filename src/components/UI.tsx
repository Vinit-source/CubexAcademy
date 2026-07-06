import React, { useEffect, useState } from 'react';
import { useStore, STAGES, STAGE_ORDER } from '../store';
import { Play, CheckCircle2, Shuffle, RotateCcw, Gamepad2, GraduationCap, Trophy, Sparkles, Lightbulb, Settings, Video } from 'lucide-react';
import { cn } from '../lib/utils';
import { StageDiagram } from './StageDiagram';
import { parseMoves, type Move } from '../lib/cube-engine';

// Physical key -> cube face. WASD cluster drives Up/Down/Right/Left; Q/E the
// Front/Back faces. Shift on any of them applies the inverse turn.
const KEY_TO_FACE: Record<string, string> = {
  W: 'U', S: 'D', D: 'R', A: 'L', Q: 'F', E: 'B',
};
const FACE_TO_KEY: Record<string, string> = { U: 'W', D: 'S', R: 'D', L: 'A', F: 'Q', B: 'E' };

// Physical key → cube face (tinted its cube color) + name. Bright hues are used
// for legibility on the dark panel. Rendered in the real keyboard layout below.
const KEY_META: Record<string, { face: string; faceClass: string; name: string }> = {
  Q: { face: 'F', faceClass: 'text-emerald-400', name: 'Front' },
  W: { face: 'U', faceClass: 'text-slate-100', name: 'Up' },
  E: { face: 'B', faceClass: 'text-blue-400', name: 'Back' },
  A: { face: 'L', faceClass: 'text-orange-400', name: 'Left' },
  S: { face: 'D', faceClass: 'text-yellow-400', name: 'Down' },
  D: { face: 'R', faceClass: 'text-red-500', name: 'Right' },
};
// Two staggered rows, exactly as they sit on a QWERTY keyboard.
const KEY_ROWS = [['Q', 'W', 'E'], ['A', 'S', 'D']];

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
    isRotating,
    cameraAnimationsEnabled,
    setCameraAnimationsEnabled
  } = useStore();

  // Canvas settings popover (top-right of the 3D panel).
  const [showSettings, setShowSettings] = useState(false);

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
      <div className="col-span-1 md:col-span-3 md:row-span-4 panel p-5 flex flex-col gap-4">
        <div className="flex bg-ink/60 border border-line rounded-2xl p-1 gap-1">
          <button
            onClick={() => setMode('learning')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
              mode === 'learning' ? 'keycap keycap-brand' : 'text-muted hover:text-fg'
            )}
          >
            <GraduationCap size={14} /> Academy
          </button>
          <button
            onClick={() => setMode('freeplay')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
              mode === 'freeplay' ? 'keycap keycap-brand' : 'text-muted hover:text-fg'
            )}
          >
            <Gamepad2 size={14} /> Freeplay
          </button>
        </div>

        {mode === 'learning' ? (
          <>
            <div className="flex justify-between items-center mt-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest">Learning Path</h3>
                <button
                  onClick={() => setTutorialMode(!tutorialMode)}
                  title="Tutorial mode shows which key to press and vibrates the cube on a wrong move"
                  className={cn(
                    'chip transition-colors',
                    tutorialMode ? 'bg-amber-400/15 border-amber-400/30 text-amber-300' : 'text-faint hover:text-muted'
                  )}
                >
                  <Lightbulb className="w-3 h-3" /> {tutorialMode ? 'Tutorial' : 'Standard'}
                </button>
              </div>
              {solutionSteps.length > 0 && (
                <span className="text-xs font-mono text-brand-soft font-bold shrink-0">
                  {Math.min(currentStepIndex + 1, solutionSteps.length)}/{solutionSteps.length}
                </span>
              )}
            </div>
            {solutionSteps.length === 0 ? (
              <div className="flex-1 flex flex-col justify-center items-center text-center gap-3 text-faint">
                <Shuffle className="w-8 h-8" />
                <p className="text-xs">Press <span className="font-bold text-brand-soft">Scramble</span> to generate a real, step-by-step solve to walk through.</p>
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
                        "p-2.5 rounded-2xl flex items-center gap-3 text-left border transition-all",
                        isActive ? "bg-brand/10 border-brand/40" : "bg-ink/40 border-transparent hover:border-line",
                        !isActive && !isDone && "opacity-55"
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0",
                        isActive ? "bg-brand text-white" : "bg-surface-2 text-muted",
                        isDone && !isActive && "bg-success/20 text-success"
                      )}>
                        {isDone ? <CheckCircle2 className="w-4 h-4" /> : (idx + 1).toString().padStart(2, '0')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs font-bold leading-tight truncate", isActive ? "text-fg" : "text-muted")}>{step.label}</p>
                        <p className="text-[10px] font-mono text-faint truncate">{step.human}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center text-center gap-4">
            <Gamepad2 size={48} className="text-surface-2" />
            <h3 className="font-display text-lg font-bold text-fg">Freeplay</h3>
            <p className="text-xs text-muted">Scramble the cube and solve it your way. The timer starts on your first move.</p>
          </div>
        )}
      </div>

      {/* 2. 3D Canvas */}
      <div className="col-span-1 md:col-span-6 md:row-span-4 panel !border-2 !border-brand/20 rounded-[26px] relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-surface to-[#191333] min-h-[300px]">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

        {/* Canvas goes here */}
        <div className="w-full h-full relative z-10">
          {children}
        </div>

        {/* Canvas settings — top-right gear opens a popover to toggle the auto
            camera tour that plays when a stage is mastered. */}
        <div className="absolute top-4 right-4 z-30">
          <button
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Canvas settings"
            aria-expanded={showSettings}
            className={cn('keycap p-2', showSettings ? 'keycap-brand !text-brand-soft' : 'text-muted')}
          >
            <Settings className="w-4 h-4" />
          </button>

          {showSettings && (
            <>
              {/* click-away layer */}
              <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
              <div className="absolute right-0 mt-2 w-60 panel p-3 z-50 shadow-xl">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted mb-2 px-1">Settings</h4>
                <button
                  onClick={() => setCameraAnimationsEnabled(!cameraAnimationsEnabled)}
                  role="switch"
                  aria-checked={cameraAnimationsEnabled}
                  className="w-full flex items-center gap-3 rounded-xl bg-ink/40 border border-line px-3 py-2.5 text-left hover:border-brand/40 transition-colors"
                >
                  <Video className="w-4 h-4 text-brand-soft shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-bold text-fg">Auto camera tour</span>
                    <span className="block text-[10px] text-faint leading-tight">Fly around each stage you master</span>
                  </span>
                  <span className={cn('relative w-9 h-5 rounded-full transition-colors shrink-0', cameraAnimationsEnabled ? 'bg-brand' : 'bg-surface-2')}>
                    <span className={cn('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform', cameraAnimationsEnabled && 'translate-x-4')} />
                  </span>
                </button>
              </div>
            </>
          )}
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
                      done && 'bg-success',
                      current && (flashWrong ? 'bg-danger' : 'bg-brand-soft animate-pulse pointer-events-auto cursor-pointer'),
                      !done && !current && 'bg-surface-2'
                    )}
                  />
                );
              })}
            </div>
            {tutorialMode && stepMoves[actionIndex] && (
              <div className="flex items-center gap-2 bg-surface/90 border border-line backdrop-blur px-3 py-1.5 rounded-full shadow-lg">
                <span className="text-[9px] text-muted uppercase tracking-widest">Press</span>
                <kbd className="keycap px-2 py-0.5 font-mono text-xs font-bold">
                  {keyHint(stepMoves[actionIndex])}
                </kbd>
                <span className="text-xs font-mono font-bold text-brand-soft">{currentStep!.human.split(/\s+/)[actionIndex]}</span>
              </div>
            )}
          </div>
        )}

        {/* Current step overlay inside the Canvas area */}
        {mode === 'learning' && (currentStep || solveComplete) && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full text-center z-20 pointer-events-none">
            {solveComplete ? (
              <div className="inline-flex items-center gap-2 bg-success/90 text-white backdrop-blur px-5 py-2 rounded-full text-sm font-black uppercase tracking-[0.2em] shadow-lg shadow-success/40">
                <Sparkles className="w-4 h-4" /> Solved!
              </div>
            ) : (
              <>
                <div className="inline-block bg-brand/90 text-white backdrop-blur px-4 py-2 rounded-full text-sm font-mono font-bold tracking-widest shadow-lg shadow-brand/40">
                  {currentStep!.human}
                </div>
                <p className="text-[10px] text-muted mt-2 font-bold uppercase tracking-widest drop-shadow-md">{currentStep!.label}</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* 3. Timer */}
      <div className="col-span-1 md:col-span-3 md:row-span-3 panel p-5 flex flex-col justify-center items-center relative">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest mb-2 absolute top-5 left-5">Solve timer</h3>

        {bestTime !== null && mode === 'freeplay' && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 text-success bg-success/10 border border-success/20 px-2 py-1 rounded-lg" title="Best time">
            <Trophy size={12} />
            <span className="text-[10px] font-mono font-bold">{formatTime(bestTime)}</span>
          </div>
        )}

        <div className="text-4xl lg:text-5xl font-mono font-bold text-fg tracking-tighter tabular-nums mt-6">
          {formatTime(timerCurrent).split('.')[0]}<span className="text-brand-soft">.{formatTime(timerCurrent).split('.')[1]}</span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 w-full">
          <button
            onClick={timerRunning ? stopTimer : startTimer}
            className={cn(
              "keycap p-2.5 text-center text-xs uppercase tracking-wider",
              timerRunning ? "!text-danger" : "!text-success"
            )}
          >
            {timerRunning ? 'Stop' : timerCurrent > 0 ? 'Resume' : 'Start'}
          </button>
          <button
            onClick={resetTimer}
            className="keycap p-2.5 text-center text-xs uppercase tracking-wider text-muted"
          >
            Reset
          </button>
        </div>
      </div>

      {/* 4. Progress — per-stage mastery (auto-fills as you complete each stage) */}
      <div className="col-span-1 md:col-span-3 md:row-span-1 panel p-4 flex flex-col justify-center gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted">Stages mastered</span>
          <span className="text-sm font-black text-fg tabular-nums">{learnedStages.length}/{STAGE_ORDER.length}</span>
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
                  "flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[9px] font-black uppercase tracking-wider transition-all",
                  done ? "bg-brand text-white shadow-sm shadow-brand/30" : "bg-surface-2 text-faint",
                  active && !done && "ring-2 ring-brand-soft/70 text-brand-soft"
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
      <div className="col-span-1 md:col-span-4 md:row-span-2 panel p-5 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-bold text-muted uppercase tracking-widest">Controls</h3>
          <div className="flex gap-3">
            <button
              onClick={onReset}
              disabled={isRotating}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-fg disabled:opacity-40 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
            <button
              onClick={onScramble}
              disabled={isRotating}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-soft hover:text-brand disabled:opacity-40 transition-colors"
            >
              <Shuffle className="w-3 h-3" /> Scramble
            </button>
          </div>
        </div>

        {/* Keys laid out like the keyboard: Q W E / A S D. Each cap turns its
            face; the small tinted letter shows which. */}
        <div className="hidden md:flex flex-col items-center gap-1.5 flex-1 justify-center">
          {KEY_ROWS.map((row, ri) => (
            <div key={ri} className={cn('flex gap-1.5', ri === 1 && 'ml-6')}>
              {row.map((key) => {
                const { face, faceClass, name } = KEY_META[key];
                return (
                  <button
                    key={key}
                    onClick={() => onExecuteMove(face)}
                    disabled={isRotating}
                    title={`${key} — turn the ${name} face`}
                    className="keycap w-12 h-12 flex flex-col items-center justify-center leading-none"
                  >
                    <span className="font-mono text-sm font-bold">{key}</span>
                    <span className={cn('text-[9px] font-bold mt-0.5', faceClass)}>{face}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="hidden md:block mt-auto pt-3 text-[9px] text-faint font-medium uppercase tracking-widest text-center">
          Hold Shift for the reverse turn (')
        </div>

        {/* Mobile Touch Controls */}
        <div className="md:hidden grid grid-cols-4 gap-2 touch-manipulation flex-1">
          {['R', 'L', 'U', 'D', 'F', 'B'].map((move) => (
            <React.Fragment key={move}>
              <button disabled={isRotating} onClick={() => onExecuteMove(move)} className="keycap text-sm py-2">
                {move}
              </button>
              <button disabled={isRotating} onClick={() => onExecuteMove(`${move}'`)} className="keycap text-sm py-2">
                {move}'
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 6. Execution & Action */}
      <div className="col-span-1 md:col-span-8 md:row-span-2 panel p-5 flex flex-col justify-between">
        {mode === 'learning' ? (
          solveComplete ? (
            <div className="flex-1 flex flex-col justify-center items-center text-center gap-3">
              <Sparkles className="w-10 h-10 text-success" />
              <h3 className="font-display text-lg font-bold text-fg">Cube solved!</h3>
              <p className="text-xs text-muted">Scramble for a fresh solve, or reset to retry this one.</p>
            </div>
          ) : !currentStep || !currentStage ? (
            <div className="flex-1 flex flex-col justify-center items-center text-center gap-3">
              <GraduationCap className="w-10 h-10 text-surface-2" />
              <p className="text-sm text-muted">Scramble the cube to generate a guided, step-by-step solve.</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest">{currentStage.name} · {currentStep.label}</h3>
                {stageLearned && (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-success">
                    <CheckCircle2 className="w-3 h-3" /> Mastered
                  </span>
                )}
              </div>

              <div className="flex items-start gap-3 mb-3">
                <p className="text-sm text-muted flex-1">{currentStage.description}</p>
                <StageDiagram stage={currentStep.stage} highlight={subStepIndex} className="mt-0.5" />
              </div>

              <div className="mb-4 flex items-start gap-2 rounded-xl bg-brand/10 border border-brand/20 px-3 py-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-soft mt-0.5 shrink-0">Goal</span>
                <p className="text-xs text-muted leading-relaxed">{currentStage.goal}</p>
              </div>

              <div className="flex gap-3 mt-auto">
                <button
                  onClick={() => toggleStageLearned(currentStep.stage)}
                  className={cn(
                    "keycap flex-1 p-3 text-xs uppercase tracking-wider flex items-center justify-center gap-2",
                    stageLearned ? "text-muted" : "!text-success"
                  )}
                >
                  {stageLearned ? 'Mark as unlearned' : 'Mark as learned'}
                </button>

                <button
                  onClick={() => onExecuteSolution()}
                  disabled={isRotating}
                  className="keycap keycap-brand flex-1 flex items-center justify-center gap-2 p-3 text-xs uppercase tracking-wider"
                >
                  <Play className="w-4 h-4" fill="currentColor" />
                  Play step
                </button>
              </div>
            </>
          )
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center">
            <p className="text-sm text-muted font-medium">Use the keyboard or the on-screen keys to solve the cube.</p>
          </div>
        )}
      </div>
    </>
  );
}
