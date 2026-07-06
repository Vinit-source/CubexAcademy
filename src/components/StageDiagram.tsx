import { cn } from '../lib/utils';
import type { Stage } from '../store';

// A tiny 3x3 face diagram showing the expected result of each CFOP stage, so
// learners can see the target at a glance. Optional `highlight` rings the cell
// for the Nth edge (cross) / corner-slot (f2l) — used in the per-step panel.

// White/yellow mirror the cube's real sticker hexes (see scene-config.ts).
const W = '#f1f5f9'; // solved white sticker
const Y = '#ffd500'; // solved yellow sticker
const E = '#312a41'; // not-yet-solved cell (matches the plum surface)

// 9 cells, row-major (top-left → bottom-right).
const FACES: Record<Stage, string[]> = {
  cross: [E, W, E, W, W, W, E, W, E], // white plus: center + 4 edges
  f2l: [W, W, W, W, W, W, W, W, W], // full first layer
  oll: [Y, Y, Y, Y, Y, Y, Y, Y, Y], // top face all one color
  pll: [Y, Y, Y, Y, Y, Y, Y, Y, Y], // + solved side frame (below)
};

// Cell to ring for the Nth sub-step: cross edges (top, right, bottom, left) and
// f2l corner slots (TL, TR, BR, BL).
const HIGHLIGHT_CELLS: Partial<Record<Stage, number[]>> = {
  cross: [1, 5, 7, 3],
  f2l: [0, 2, 8, 6],
};

interface StageDiagramProps {
  stage: Stage;
  /** 0-based index of the current sub-step within the stage (cross edge / f2l pair). */
  highlight?: number | null;
  className?: string;
}

export function StageDiagram({ stage, highlight = null, className }: StageDiagramProps) {
  const cells = FACES[stage];
  const hlCell = highlight != null ? HIGHLIGHT_CELLS[stage]?.[highlight] : undefined;
  const framed = stage === 'pll'; // side colors matched → colored frame

  return (
    <div
      className={cn(
        'shrink-0 rounded-md p-[3px]',
        framed ? 'bg-gradient-to-br from-red-500 via-emerald-500 to-blue-500' : 'bg-slate-950',
        className
      )}
    >
      <div className="grid grid-cols-3 gap-[2px] rounded-sm bg-slate-950 p-[2px]">
        {cells.map((c, i) => (
          <div
            key={i}
            className={cn(
              'h-4 w-4 rounded-[2px]',
              i === hlCell && 'ring-2 ring-indigo-400 relative z-10 scale-110'
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}
