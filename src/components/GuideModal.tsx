import { X, BookOpen } from 'lucide-react';
import { cn } from '../lib/utils';
import { StageDiagram } from './StageDiagram';
import type { Stage } from '../store';

interface GuideModalProps {
  open: boolean;
  onClose: () => void;
}

// The four CFOP (Fridrich) stages this app teaches. Content follows the standard
// reference at https://ruwix.com/the-rubiks-cube/advanced-cfop-fridrich/.
const STEPS: { tag: string; stage: Stage; title: string; color: string; body: string }[] = [
  {
    tag: '1',
    stage: 'cross',
    title: 'Cross',
    color: 'text-emerald-400',
    body: 'Build a plus-shaped cross of four edges on one face (usually white), each edge also matching the color of its neighbouring center. Solve it on the bottom so it stays out of your way. This step is fully intuitive — no algorithms.',
  },
  {
    tag: '2',
    stage: 'f2l',
    title: 'F2L — First Two Layers',
    color: 'text-sky-400',
    body: 'Solve the four bottom corners together with their matching middle-layer edges, one corner+edge "pair" at a time, inserting each into its slot. Completing all four finishes the entire bottom two layers at once.',
  },
  {
    tag: '3',
    stage: 'oll',
    title: 'OLL — Orient Last Layer',
    color: 'text-amber-400',
    body: 'Make the whole top face a single solid color, ignoring the side colors for now. This is orientation only — the pieces are turned the right way up but not yet in their final spots.',
  },
  {
    tag: '4',
    stage: 'pll',
    title: 'PLL — Permute Last Layer',
    color: 'text-rose-400',
    body: 'Move the already-oriented last-layer pieces into their correct positions. When this finishes, every side matches its center and the cube is solved.',
  },
];

const TIPS = [
  'Notation: F R U D L B turn the Front/Right/Up/Down/Left/Back face clockwise. Add ’ for counter-clockwise (e.g. R’) and 2 for a 180° turn (e.g. U2). Lowercase = a wide, two-layer turn.',
  'Hold the cube with the cross on the bottom throughout, so you can watch the last layer.',
  'Beginners: use "2-look" OLL and PLL (about 16 short algorithms) before learning full CFOP’s 78.',
  'Look ahead — while finishing one pair, spot where the next one is going.',
];

export function GuideModal({ open, onClose }: GuideModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="panel relative w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close guide"
          className="keycap absolute top-4 right-4 p-1.5 text-muted"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center shrink-0 shadow-lg shadow-brand/30">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-fg tracking-tight">How to solve a Rubik&rsquo;s cube</h2>
            <p className="text-xs text-muted font-medium uppercase tracking-widest">The CFOP / Fridrich method</p>
          </div>
        </div>

        <p className="text-sm text-muted mb-6 leading-relaxed">
          Every solve follows the same four stages, in order. Learn them once and you can solve any
          scramble — the Academy walks you through each stage on a real solution.
        </p>

        <div className="flex flex-col gap-3 mb-6">
          {STEPS.map((s) => (
            <div key={s.tag} className="flex gap-4 rounded-2xl bg-ink/50 border border-line p-4">
              <div className="w-8 h-8 shrink-0 rounded-lg bg-surface-2 border border-line flex items-center justify-center font-black text-sm text-fg">
                {s.tag}
              </div>
              <div className="flex-1">
                <h3 className={cn('font-display text-sm font-bold tracking-wide mb-1', s.color)}>{s.title}</h3>
                <p className="text-xs text-muted leading-relaxed">{s.body}</p>
              </div>
              <StageDiagram stage={s.stage} className="self-center" />
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-brand/10 border border-brand/20 p-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-soft mb-2">Good to remember</h3>
          <ul className="flex flex-col gap-2">
            {TIPS.map((t, i) => (
              <li key={i} className="text-xs text-muted leading-relaxed flex gap-2">
                <span className="text-brand-soft font-bold shrink-0">&bull;</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[10px] text-faint mt-4 text-center">
          Reference:{' '}
          <a
            href="https://ruwix.com/the-rubiks-cube/advanced-cfop-fridrich/"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-muted"
          >
            ruwix.com — Advanced CFOP (Fridrich) method
          </a>
        </p>
      </div>
    </div>
  );
}
