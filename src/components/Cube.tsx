import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { CONFIG } from '../lib/config';
import { SCENE } from '../lib/scene-config';
import { RobotHand } from './Hands';
import {
  initPieces,
  applyMove,
  isOnMove,
  resolveMove,
  progressAngle,
  parseMoves,
  translateSolverSequence,
  getFacelets,
  isSolved,
  type Piece,
  type Move,
  type FaceLetter,
  type Sticker,
} from '../lib/cube-engine';

// Sticker colors live in scene-config (match the solver's default orientation).
const COLORS: Record<FaceLetter | 'CORE', string> = SCENE.colors;

const createMaterial = (color: string) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.1, metalness: 0.1 });

const CUBE_MATERIALS: Record<FaceLetter | 'CORE', THREE.MeshStandardMaterial> = {
  R: createMaterial(COLORS.R),
  L: createMaterial(COLORS.L),
  U: createMaterial(COLORS.U),
  D: createMaterial(COLORS.D),
  F: createMaterial(COLORS.F),
  B: createMaterial(COLORS.B),
  CORE: createMaterial(COLORS.CORE),
};

// Highlight variants: same colors, but with an emissive glow whose intensity is
// pulsed each frame (see useFrame) to make the actively-turning layer blink.
// These are only ever applied to on-move pieces, so pulsing them globally is
// safe — no other piece renders with them.
const createHighlightMaterial = (color: string) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.1, metalness: 0.1, emissive: new THREE.Color(color) });

const HIGHLIGHT_MATERIALS: Record<FaceLetter | 'CORE', THREE.MeshStandardMaterial> = {
  R: createHighlightMaterial(COLORS.R),
  L: createHighlightMaterial(COLORS.L),
  U: createHighlightMaterial(COLORS.U),
  D: createHighlightMaterial(COLORS.D),
  F: createHighlightMaterial(COLORS.F),
  B: createHighlightMaterial(COLORS.B),
  CORE: createHighlightMaterial('#ffffff'),
};

const setHighlightIntensity = (v: number) => {
  Object.values(HIGHLIGHT_MATERIALS).forEach((m) => (m.emissiveIntensity = v));
};

// A piece's rendered face materials, in the geometry's face order
// [R, L, U, D, F, B] — the same order as `Piece.colors`. `highlight` swaps in
// the glowing variants for the actively-turning layer.
const materialsFor = (colors: Sticker[], highlight: boolean): THREE.Material[] => {
  const set = highlight ? HIGHLIGHT_MATERIALS : CUBE_MATERIALS;
  return colors.map((c) => (c === null ? set.CORE : set[c]));
};

// Outward normal of the face a move visually sits on (for placing the arrow).
const FACE_NORMAL: Record<string, THREE.Vector3> = {
  R: new THREE.Vector3(1, 0, 0), L: new THREE.Vector3(-1, 0, 0),
  U: new THREE.Vector3(0, 1, 0), D: new THREE.Vector3(0, -1, 0),
  F: new THREE.Vector3(0, 0, 1), B: new THREE.Vector3(0, 0, -1),
  M: new THREE.Vector3(1, 0, 0), E: new THREE.Vector3(0, -1, 0), S: new THREE.Vector3(0, 0, 1),
};

/**
 * A curved "rotate this face" glyph that hovers just off the active face and
 * spins in the turn's direction, so it's always clear which side is moving and
 * which way. Rendered only while a move animates.
 */
function RotationArrow({ move }: { move: Move }) {
  const { axisVec, sign } = resolveMove(move);
  const normal = FACE_NORMAL[move.face] ?? new THREE.Vector3(1, 0, 0);

  // Orient a local frame whose +Z points along the face normal (the ring lies
  // in the face plane), then sweep an arc; the turn direction is sign * dir.
  const { position, quaternion, points, headPos, headQuat } = useMemo(() => {
    const zAxis = normal.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), zAxis);

    const radius = SCENE.arrow.radius;
    const turnSign = Math.sign(sign * (move.dir === 2 ? 1 : move.dir)) || 1;
    // Looking at the face from outside (down -normal), a clockwise turn should
    // read clockwise. Sweep ~270° of arc, leaving a gap for the head.
    const start = SCENE.arrow.arcStart;
    const sweep = SCENE.arrow.arcSweep;
    const segs = 32;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = start + (sweep * i) / segs * turnSign;
      pts.push(new THREE.Vector3(Math.cos(t) * radius, Math.sin(t) * radius, 0));
    }
    const tEnd = start + sweep * turnSign;
    const head = new THREE.Vector3(Math.cos(tEnd) * radius, Math.sin(tEnd) * radius, 0);
    // Cone points along the tangent at the arc end.
    const tangent = new THREE.Vector3(-Math.sin(tEnd), Math.cos(tEnd), 0).multiplyScalar(turnSign);
    const hQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent.normalize());

    return {
      position: zAxis.clone().multiplyScalar(SCENE.arrow.faceOffset),
      quaternion: quat,
      points: pts,
      headPos: head,
      headQuat: hQuat,
    };
  }, [normal, sign, move.dir, axisVec]);

  const tubeGeom = useMemo(
    () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 40, SCENE.arrow.tubeRadius, 8, false),
    [points]
  );

  const { color, emissiveIntensity, coneRadius, coneHeight } = SCENE.arrow;
  return (
    <group position={position} quaternion={quaternion}>
      <mesh geometry={tubeGeom}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissiveIntensity} toneMapped={false} />
      </mesh>
      <mesh position={headPos} quaternion={headQuat}>
        <coneGeometry args={[coneRadius, coneHeight, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissiveIntensity} toneMapped={false} />
      </mesh>
    </group>
  );
}

// Face names that hover in 3D just off each face, billboarded toward the
// camera. Centers never move on a 3x3, so these live at fixed positions in the
// cube frame and don't turn with moves. Placement distance + styling come from
// SCENE.label. Depth-testing lets the cube occlude far-side labels.
const D = SCENE.label.distance;
const FACE_LABELS: { name: string; color: string; pos: [number, number, number] }[] = [
  { name: 'R', color: COLORS.R, pos: [D, 0, 0] },
  { name: 'L', color: COLORS.L, pos: [-D, 0, 0] },
  { name: 'U', color: COLORS.U, pos: [0, D, 0] },
  { name: 'D', color: COLORS.D, pos: [0, -D, 0] },
  { name: 'F', color: COLORS.F, pos: [0, 0, D] },
  { name: 'B', color: COLORS.B, pos: [0, 0, -D] },
];

function FaceLabels() {
  return (
    <>
      {FACE_LABELS.map((l) => (
        <Billboard key={l.name} position={l.pos}>
          <Text
            fontSize={SCENE.label.fontSize}
            color={l.color}
            anchorX="center"
            anchorY="middle"
            outlineWidth={SCENE.label.outlineWidth}
            outlineColor={SCENE.label.outlineColor}
            fontWeight="bold"
          >
            {l.name.toUpperCase()}
          </Text>
        </Billboard>
      ))}
    </>
  );
}

export const RubiksCube = React.forwardRef(
  (
    props: { onMoveStart?: () => void; onMoveEnd?: (isSolved: boolean) => void; onReady?: () => void },
    ref
  ) => {
    const pieces = useRef<Piece[]>(initPieces());
    const [, setRender] = useState(0); // Trigger re-render (state lives in refs)

    const moveQueue = useRef<Move[]>([]);
    const currentMove = useRef<{ move: Move; progress: number } | null>(null);
    const ROTATION_SPEED = CONFIG.rotationSpeed; // Radians per second (VITE_ROTATION_SPEED)

    const setIsRotating = useStore((state) => state.setIsRotating);

    // Cube "vibration" on a wrong Tutorial-mode move: a short decaying shake.
    const groupRef = useRef<THREE.Group>(null);
    const shakeStart = useRef<number | null>(null);
    const wrongPulse = useStore((state) => state.wrongPulse);
    const tutorialMode = useStore((state) => state.tutorialMode);
    useEffect(() => {
      if (wrongPulse > 0 && tutorialMode) shakeStart.current = performance.now();
    }, [wrongPulse, tutorialMode]);

    // Let the parent know the cube has mounted (it lives inside a <Suspense>, so
    // the ref isn't usable until the hand model resolves and this renders).
    useEffect(() => {
      props.onReady?.();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const enqueue = (moves: Move[]) => {
      if (moves.length === 0) return;
      moveQueue.current.push(...moves);
      if (!currentMove.current) {
        setIsRotating(true);
        props.onMoveStart?.();
      }
    };

    // Expose API to parent.
    React.useImperativeHandle(ref, () => ({
      // Standard human notation, e.g. "R U R' U2".
      executeMove: (moveStr: string) => enqueue(parseMoves(moveStr)),
      // A sequence in rubiks-cube-solver notation (prime suffix, lowercase wide,
      // uppercase slices). Used to play back a computed solution step.
      executeSolution: (moveStr: string) => enqueue(translateSolverSequence(moveStr)),
      // Read the current state as the solver's 54-char facelet string.
      getFacelets: () => getFacelets(pieces.current),
      // Apply a human-notation sequence instantly (no animation / callbacks).
      applyInstant: (moveStr: string) => {
        parseMoves(moveStr).forEach((m) => applyMove(pieces.current, m));
        setRender((r) => r + 1);
      },
      reset: () => {
        pieces.current = initPieces();
        moveQueue.current = [];
        currentMove.current = null;
        setIsRotating(false);
        setRender((r) => r + 1);
      },
    }));

    useFrame((state, delta) => {
      // Pulse the active layer's glow while a move is animating.
      if (currentMove.current) {
        const { base, amplitude, frequency } = SCENE.highlight;
        setHighlightIntensity(base + amplitude * Math.sin(state.clock.elapsedTime * frequency));
      }

      // Decaying horizontal shake after a wrong Tutorial-mode move.
      if (groupRef.current) {
        let dx = 0;
        if (shakeStart.current != null) {
          const t = (performance.now() - shakeStart.current) / 1000;
          const DURATION = 0.4;
          if (t < DURATION) dx = Math.sin(t * 55) * 0.14 * (1 - t / DURATION);
          else shakeStart.current = null;
        }
        groupRef.current.position.x = dx;
      }

      if (!currentMove.current && moveQueue.current.length > 0) {
        currentMove.current = { move: moveQueue.current.shift()!, progress: 0 };
        setIsRotating(true);
      }

      if (currentMove.current) {
        const { move, progress } = currentMove.current;
        const targetProgress = move.dir === 2 ? Math.PI : Math.PI / 2;
        let nextProgress = progress + ROTATION_SPEED * delta;
        let isDone = false;

        if (nextProgress >= targetProgress) {
          nextProgress = targetProgress;
          isDone = true;
        }
        currentMove.current.progress = nextProgress;
        setRender((r) => r + 1); // pieces live in refs, so nudge React each frame

        if (isDone) {
          applyMove(pieces.current, move); // shared bake path (rounds positions)
          currentMove.current = null;
          if (moveQueue.current.length === 0) {
            setIsRotating(false);
            props.onMoveEnd?.(isSolved(pieces.current));
          }
        }
      }
    });

    const active = currentMove.current;

    return (
      <group ref={groupRef}>
        {/* Right / Left robot hands mirror the active R/L turn. */}
        <RobotHand
          side="R"
          isActive={active?.move.face === 'R'}
          dir={active?.move.face === 'R' ? active.move.dir : 1}
          progress={active?.move.face === 'R' ? active.progress : 0}
        />
        <RobotHand
          side="L"
          isActive={active?.move.face === 'L'}
          dir={active?.move.face === 'L' ? active.move.dir : 1}
          progress={active?.move.face === 'L' ? active.progress : 0}
        />

        {active && <RotationArrow move={active.move} />}
        <FaceLabels />

        {pieces.current.map((p) => {
          const displayPos = p.position.clone();
          const displayQuat = p.quaternion.clone();
          const onMove = !!active && isOnMove(p.position, active.move);

          if (active && onMove) {
            const { axisVec } = resolveMove(active.move);
            const angle = progressAngle(active.move, active.progress);
            const tempQuat = new THREE.Quaternion().setFromAxisAngle(axisVec, angle);
            displayPos.applyQuaternion(tempQuat);
            displayQuat.premultiply(tempQuat);
          }

          return (
            <mesh
              key={p.id}
              position={displayPos}
              quaternion={displayQuat}
              material={materialsFor(p.colors, onMove)}
            >
              <boxGeometry args={[SCENE.pieceSize, SCENE.pieceSize, SCENE.pieceSize]} />
            </mesh>
          );
        })}
      </group>
    );
  }
);
