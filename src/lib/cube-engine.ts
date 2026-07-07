import * as THREE from 'three';

/**
 * Pure cube-state engine, decoupled from react-three-fiber so it can be unit
 * round-tripped in Node. Cube.tsx renders these pieces; the solver integration
 * feeds moves through the same bake path.
 *
 * A piece carries a `position` (integer lattice -1..1), a `quaternion`, and a
 * 6-slot `colors` array in the fixed slot order [R, L, U, D, F, B] — the same
 * order as the original materials array in Cube.tsx. `null` = inner/core sticker.
 */

export type FaceLetter = 'R' | 'L' | 'U' | 'D' | 'F' | 'B';
export type Sticker = FaceLetter | null;

export interface Piece {
  id: number;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  colors: Sticker[]; // length 6, slot order [R, L, U, D, F, B]
}

// Outward normal for each color slot, index-aligned with `colors`.
export const SLOT_NORMALS: THREE.Vector3[] = [
  new THREE.Vector3(1, 0, 0), // 0: R
  new THREE.Vector3(-1, 0, 0), // 1: L
  new THREE.Vector3(0, 1, 0), // 2: U
  new THREE.Vector3(0, -1, 0), // 3: D
  new THREE.Vector3(0, 0, 1), // 4: F
  new THREE.Vector3(0, 0, -1), // 5: B
];
const SLOT_FACE: FaceLetter[] = ['R', 'L', 'U', 'D', 'F', 'B'];

export const initPieces = (): Piece[] => {
  const pieces: Piece[] = [];
  let id = 0;
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const colors: Sticker[] = [
          x === 1 ? 'R' : null,
          x === -1 ? 'L' : null,
          y === 1 ? 'U' : null,
          y === -1 ? 'D' : null,
          z === 1 ? 'F' : null,
          z === -1 ? 'B' : null,
        ];
        pieces.push({
          id: id++,
          position: new THREE.Vector3(x, y, z),
          quaternion: new THREE.Quaternion(),
          colors,
        });
      }
    }
  }
  return pieces;
};

// ---------------------------------------------------------------------------
// Move model
// ---------------------------------------------------------------------------

export interface Move {
  /** Base face letter (uppercase) or slice letter. */
  face: string;
  /** 1 = clockwise, -1 = counter-clockwise, 2 = 180°. */
  dir: number;
  /** Wide (double-layer) turn: outer slice + adjacent middle slice. */
  wide?: boolean;
}

type Axis = 'x' | 'y' | 'z';

interface ResolvedMove {
  axis: Axis;
  axisVec: THREE.Vector3;
  /** Lattice coordinate(s) along `axis` whose pieces rotate. */
  layers: number[];
  /** Base direction sign for a clockwise (dir=+1) turn of this move. */
  sign: number;
}

const AXIS_VEC: Record<Axis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

// The single source of truth for rotation direction. A clockwise (dir=+1) turn
// of a face, looking at that face from outside, is:
//   R, U, F -> negative rotation about their axis
//   L, D, B -> positive rotation about their axis
// Slice moves follow a reference face (M~L, E~D, S~F); wide moves follow their
// own face. Both the finalized bake and the live-display transform use this, so
// they can never drift out of sync.
const FACE_SIGN: Record<FaceLetter, number> = { R: -1, U: -1, F: -1, L: 1, D: 1, B: 1 };

const FACE_AXIS: Record<string, Axis> = {
  R: 'x', L: 'x', M: 'x',
  U: 'y', D: 'y', E: 'y',
  F: 'z', B: 'z', S: 'z',
};

// Outer-layer coordinate for each face along its axis.
const FACE_LAYER: Record<FaceLetter, number> = { R: 1, L: -1, U: 1, D: -1, F: 1, B: -1 };

// Reference face whose spin direction a middle slice follows.
const SLICE_REF: Record<string, FaceLetter> = { M: 'L', E: 'D', S: 'F' };

export const resolveMove = (move: Move): ResolvedMove => {
  const axis = FACE_AXIS[move.face];
  const axisVec = AXIS_VEC[axis];

  if (move.face === 'M' || move.face === 'E' || move.face === 'S') {
    const ref = SLICE_REF[move.face];
    return { axis, axisVec, layers: [0], sign: FACE_SIGN[ref] };
  }

  const face = move.face as FaceLetter;
  const outer = FACE_LAYER[face];
  const layers = move.wide ? [outer, 0] : [outer];
  return { axis, axisVec, layers, sign: FACE_SIGN[face] };
};

/** Signed rotation angle for a fully-completed move (used by the bake path). */
export const finalAngle = (move: Move): number => {
  const { sign } = resolveMove(move);
  const magnitude = move.dir === 2 ? Math.PI : Math.PI / 2;
  const orient = move.dir === 2 ? 1 : Math.sign(move.dir);
  return magnitude * orient * sign;
};

/** Signed rotation angle at a given animation `progress` (used for live display). */
export const progressAngle = (move: Move, progress: number): number => {
  const { sign } = resolveMove(move);
  const orient = move.dir === 2 ? 1 : Math.sign(move.dir);
  return progress * orient * sign;
};

const EPSILON = 0.1;

/** Whether a piece at `pos` belongs to the layer(s) turned by `move`. */
export const isOnMove = (pos: THREE.Vector3, move: Move): boolean => {
  const { axis, layers } = resolveMove(move);
  const coord = pos[axis];
  return layers.some((l) => Math.abs(coord - l) < EPSILON);
};

/**
 * Bake a completed move into piece state: rotate the affected pieces by the
 * finalized quaternion and round positions to kill float drift. Single source
 * of truth for a move's permanent effect.
 */
export const applyMove = (pieces: Piece[], move: Move): void => {
  const { axisVec } = resolveMove(move);
  const rotQuat = new THREE.Quaternion().setFromAxisAngle(axisVec, finalAngle(move));
  pieces.forEach((p) => {
    if (isOnMove(p.position, move)) {
      p.position.applyQuaternion(rotQuat);
      p.position.x = Math.round(p.position.x);
      p.position.y = Math.round(p.position.y);
      p.position.z = Math.round(p.position.z);
      p.quaternion.premultiply(rotQuat);
    }
  });
};

// ---------------------------------------------------------------------------
// Rewrite wide/slice moves into basic-face-only moves
// ---------------------------------------------------------------------------
//
// The CFOP solver emits wide (two-layer, e.g. `r`) and slice (`M`/`E`/`S`)
// moves, which can't be produced on the WASDQE keys. A wide/slice move equals
// some basic face turn(s) plus a whole-cube rotation (a slice genuinely needs
// one — it can't be built from face turns alone). We rewrite a whole solution
// into basic faces only by *rotation elimination*: decompose each move into
// `basics · rotation`, accumulate the rotation into an orientation `Q`, and
// conjugate every emitted face move through `Q`. Because a full solve leaves the
// centers canonical, the accumulated rotation nets to identity, so the rewritten
// basic-only sequence reaches the same solved state.

const FACE_NORMAL_VEC: Record<FaceLetter, THREE.Vector3> = {
  R: new THREE.Vector3(1, 0, 0), L: new THREE.Vector3(-1, 0, 0),
  U: new THREE.Vector3(0, 1, 0), D: new THREE.Vector3(0, -1, 0),
  F: new THREE.Vector3(0, 0, 1), B: new THREE.Vector3(0, 0, -1),
};
const OPPOSITE: Record<FaceLetter, FaceLetter> = { R: 'L', L: 'R', U: 'D', D: 'U', F: 'B', B: 'F' };
// Positive- then negative-side face for each axis.
const AXIS_FACES: Record<Axis, [FaceLetter, FaceLetter]> = { x: ['R', 'L'], y: ['U', 'D'], z: ['F', 'B'] };
const ALL_FACES: FaceLetter[] = ['R', 'L', 'U', 'D', 'F', 'B'];

const faceFromNormal = (v: THREE.Vector3): FaceLetter => {
  const r = v.clone().round();
  const face = ALL_FACES.find((f) => FACE_NORMAL_VEC[f].equals(r));
  if (!face) throw new Error(`no face for normal ${r.x},${r.y},${r.z}`);
  return face;
};

/** The rotation quaternion a completed move applies to its layer's pieces. */
const moveQuat = (move: Move): THREE.Quaternion =>
  new THREE.Quaternion().setFromAxisAngle(AXIS_VEC[FACE_AXIS[move.face]], finalAngle(move));

/** Inverse of a direction token (a 180° turn is its own inverse). */
const invDir = (d: number): number => (d === 2 ? 2 : -d);

/**
 * Split a wide/slice move into `basics` (basic face turns, in the fixed frame)
 * plus `rot` (a whole-cube rotation) such that the move ≡ do `basics`, then
 * rotate the whole cube by `rot`. A basic face move passes through with no
 * rotation.
 *
 *  - Wide P (R/U/F): turn the opposite face the same way, then rotate the cube
 *    the way the P face would (that cancels the opposite layer, leaving the two
 *    near layers turned).
 *  - Wide N (L/D/B): symmetric, turning the opposite face and rotating the N way.
 *  - Slice (M/E/S following L/D/F): turn *both* outer faces so their layers end
 *    unmoved after a full-cube rotation the slice's reference direction, leaving
 *    only the middle layer turned.
 */
const decomposeMove = (mv: Move): { basics: Move[]; rot: THREE.Quaternion } => {
  const slice = mv.face === 'M' || mv.face === 'E' || mv.face === 'S';
  if (!mv.wide && !slice) return { basics: [{ face: mv.face, dir: mv.dir }], rot: new THREE.Quaternion() };

  const axis = FACE_AXIS[mv.face];
  const [P, N] = AXIS_FACES[axis];

  if (mv.wide) {
    const face = mv.face as FaceLetter;
    const rot = new THREE.Quaternion().setFromAxisAngle(AXIS_VEC[axis], finalAngle({ face, dir: mv.dir }));
    return { basics: [{ face: OPPOSITE[face], dir: mv.dir }], rot };
  }

  // Slice: reference face gives the middle layer's turn direction.
  const ref = SLICE_REF[mv.face];
  const mul = -FACE_SIGN[ref] * FACE_SIGN[P]; // ±1
  const dirP = mv.dir === 2 ? 2 : mul * mv.dir;
  const dirN = invDir(dirP);
  const rot = new THREE.Quaternion().setFromAxisAngle(AXIS_VEC[axis], finalAngle({ face: ref, dir: mv.dir }));
  return { basics: [{ face: P, dir: dirP }, { face: N, dir: dirN }], rot };
};

const quatAligned = (a: THREE.Quaternion, b: THREE.Quaternion): boolean => Math.abs(a.dot(b)) > 0.999;

/**
 * Rewrite a basic face move `b` as seen through the accumulated orientation `Q`,
 * so that "emit, then rotate cube by Q" ≡ "rotate cube by Q, then do b". The
 * emitted face sits at `Q⁻¹·(b's normal)`; its direction is the one whose world
 * rotation matches the conjugate `Q⁻¹·qb·Q`.
 */
const conjugateMove = (b: Move, Q: THREE.Quaternion): Move => {
  const Qinv = Q.clone().invert();
  const face = faceFromNormal(FACE_NORMAL_VEC[b.face as FaceLetter].clone().applyQuaternion(Qinv));
  const target = Qinv.clone().multiply(moveQuat(b)).multiply(Q);
  for (const dir of [1, -1, 2]) {
    if (quatAligned(moveQuat({ face, dir }), target)) return { face, dir };
  }
  throw new Error(`conjugateMove: no direction matched for ${b.face}${b.dir}`);
};

// Rewrite one segment through a running orientation `Q` (mutated in place), so a
// wide/slice move's absorbed rotation carries into every later segment.
const rewriteSegment = (moves: Move[], Q: THREE.Quaternion): Move[] => {
  const out: Move[] = [];
  for (const mv of moves) {
    const { basics, rot } = decomposeMove(mv);
    for (const b of basics) out.push(conjugateMove(b, Q));
    Q.premultiply(rot); // Rot(Q) then Rot(rot) = Rot(rot·Q)
  }
  return out;
};

/**
 * Rewrite an entire move sequence (which may contain wide/slice moves) into an
 * equivalent sequence of **basic face turns only** (R/L/U/D/F/B). Applied to a
 * full solve, the result reaches the same solved state.
 */
export const toBasicFaceMoves = (moves: Move[]): Move[] =>
  rewriteSegment(moves, new THREE.Quaternion());

/**
 * Rewrite a solution split into segments (one per solution step) into
 * basic-face-only segments, threading one orientation through them all. Segment
 * boundaries are preserved so each step keeps its own move list — but a wide
 * move in an early step correctly reorients the moves emitted for later steps.
 */
export const toBasicFaceSegments = (segments: Move[][]): Move[][] => {
  const Q = new THREE.Quaternion();
  return segments.map((seg) => rewriteSegment(seg, Q));
};

// ---------------------------------------------------------------------------
// Notation parsing
// ---------------------------------------------------------------------------

/** Parse a space-separated human sequence, e.g. "R U R' U2 M'". */
export const parseMoves = (seq: string): Move[] =>
  seq
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(parseToken);

const parseToken = (token: string): Move => {
  const base = token[0];
  const wide = base >= 'a' && base <= 'z' && base !== 'm' && base !== 'e' && base !== 's';
  const face = base.toUpperCase();
  let dir = 1;
  if (token.includes("'")) dir = -1;
  if (token.includes('2')) dir = 2;
  return { face, dir, wide };
};

/**
 * Translate a token from rubiks-cube-solver into a Move. The library's notation
 * is quirky: `prime` replaces `'`, lowercase letters are wide/double-layer moves
 * (`bprime`), but middle-slice moves come back UPPERCASE with an uppercase
 * `PRIME` (`SPRIME`). So the modifier is matched case-insensitively while the
 * base letter's case is preserved to detect wide moves. Examples:
 *   "Rprime" -> {R, -1}   "R2" -> {R, 2}   "b" -> {B, 1, wide}
 *   "bprime" -> {B, -1, wide}   "M" -> {M, 1}   "SPRIME" -> {S, -1}
 * A 180° turn is its own inverse, so a `2` wins over any stray `prime`
 * (the library emits tokens like "MPRIME2" for a half M-slice turn).
 */
export const translateSolverToken = (token: string): Move => {
  const dir = token.includes('2') ? 2 : /prime/i.test(token) ? -1 : 1;
  const base = token.replace(/prime/i, '').replace('2', '');
  const upper = base.toUpperCase();
  const isSlice = upper === 'M' || upper === 'E' || upper === 'S';
  const wide = !isSlice && base === base.toLowerCase();
  return { face: upper, dir, wide };
};

export const translateSolverSequence = (seq: string): Move[] =>
  seq.trim().split(/\s+/).filter(Boolean).map(translateSolverToken);

/**
 * Split every 180° (dir=2) turn into two separate quarter turns of the same
 * face, so a half turn is *drilled* as two key presses (one 90° each) rather
 * than a single press that snaps the whole face around. Quarter and inverse
 * turns pass through untouched; wide/slice flags are preserved on both halves.
 */
export const expandHalfTurns = (moves: Move[]): Move[] =>
  moves.flatMap((m) =>
    m.dir === 2 ? [{ ...m, dir: 1 }, { ...m, dir: 1 }] : [m]
  );

/** Render a Move in human notation (lowercase = wide, `'` = inverse, `2` = 180°). */
export const formatMove = (m: Move): string => {
  const letter = m.wide ? m.face.toLowerCase() : m.face;
  const mod = m.dir === -1 ? "'" : m.dir === 2 ? '2' : '';
  return letter + mod;
};

export const formatMoves = (moves: Move[]): string => moves.map(formatMove).join(' ');

/** Convert a rubiks-cube-solver sequence into a readable human sequence. */
export const solverToHuman = (seq: string): string => formatMoves(translateSolverSequence(seq));

// ---------------------------------------------------------------------------
// State readout
// ---------------------------------------------------------------------------

/** The color letter currently facing `normal` for a given piece, or null. */
const stickerFacing = (piece: Piece, normal: THREE.Vector3): Sticker => {
  for (let i = 0; i < 6; i++) {
    if (piece.colors[i] === null) continue;
    const cur = SLOT_NORMALS[i].clone().applyQuaternion(piece.quaternion).round();
    if (cur.equals(normal)) return piece.colors[i];
  }
  return null;
};

// Solver reading frame per face: outward normal + the in-view "up" direction.
// right-in-view = forward × up, where forward = -normal; downDir = -up. Faces
// are read row-major (top→bottom, left→right). U/D use front(+z) as the vertical
// reference per the solver's orientation rules.
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const READ_FRAME: { face: FaceLetter; normal: THREE.Vector3; up: THREE.Vector3 }[] = [
  { face: 'F', normal: V(0, 0, 1), up: V(0, 1, 0) },
  { face: 'R', normal: V(1, 0, 0), up: V(0, 1, 0) },
  { face: 'U', normal: V(0, 1, 0), up: V(0, 0, -1) },
  { face: 'D', normal: V(0, -1, 0), up: V(0, 0, 1) },
  { face: 'L', normal: V(-1, 0, 0), up: V(0, 1, 0) },
  { face: 'B', normal: V(0, 0, -1), up: V(0, 1, 0) },
];

/**
 * Serialize state into the 54-char facelet string expected by
 * rubiks-cube-solver: faces in order F R U D L B, each read like a book, using
 * face letters f r u d l b. Orientation matches the app's colors (F=green,
 * U=white, R=red).
 */
export const getFacelets = (pieces: Piece[]): string => {
  const byPos = new Map<string, Piece>();
  pieces.forEach((p) => byPos.set(`${p.position.x},${p.position.y},${p.position.z}`, p));

  let out = '';
  for (const { normal, up } of READ_FRAME) {
    const forward = normal.clone().negate();
    const right = forward.clone().cross(up).round();
    const down = up.clone().negate();
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const pos = normal
          .clone()
          .add(right.clone().multiplyScalar(c - 1))
          .add(down.clone().multiplyScalar(r - 1))
          .round();
        const piece = byPos.get(`${pos.x},${pos.y},${pos.z}`)!;
        const sticker = stickerFacing(piece, normal);
        out += sticker!.toLowerCase();
      }
    }
  }
  return out;
};

/** Whether every visible sticker matches the solved cube. */
export const isSolved = (pieces: Piece[]): boolean => {
  for (const p of pieces) {
    for (let i = 0; i < 6; i++) {
      if (p.colors[i] === null) continue;
      const cur = SLOT_NORMALS[i].clone().applyQuaternion(p.quaternion).round();
      const idx = SLOT_NORMALS.findIndex((n) => n.equals(cur));
      if (idx === -1) return false;
      if (p.colors[i] !== SLOT_FACE[idx]) return false;
    }
  }
  return true;
};
