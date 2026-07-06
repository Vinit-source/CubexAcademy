import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';
import { RobotHand } from './Hands';

// Define materials for the 6 faces: Right, Left, Top, Bottom, Front, Back
const COLORS = {
  R: '#B90000', // Right - Red
  L: '#FF5900', // Left - Orange
  U: '#FFFFFF', // Top - White
  D: '#FFD500', // Bottom - Yellow
  F: '#009B48', // Front - Green
  B: '#0045AD', // Back - Blue
  CORE: '#111111', // Black for inner faces
};

const createMaterial = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.1, metalness: 0.1 });

const CUBE_MATERIALS = {
  R: createMaterial(COLORS.R),
  L: createMaterial(COLORS.L),
  U: createMaterial(COLORS.U),
  D: createMaterial(COLORS.D),
  F: createMaterial(COLORS.F),
  B: createMaterial(COLORS.B),
  CORE: createMaterial(COLORS.CORE),
};

type PieceState = {
  id: number;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  materials: THREE.Material[];
};

const initCube = (): PieceState[] => {
  const pieces: PieceState[] = [];
  let id = 0;
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        // [Right, Left, Top, Bottom, Front, Back]
        const materials = [
          x === 1 ? CUBE_MATERIALS.R : CUBE_MATERIALS.CORE,
          x === -1 ? CUBE_MATERIALS.L : CUBE_MATERIALS.CORE,
          y === 1 ? CUBE_MATERIALS.U : CUBE_MATERIALS.CORE,
          y === -1 ? CUBE_MATERIALS.D : CUBE_MATERIALS.CORE,
          z === 1 ? CUBE_MATERIALS.F : CUBE_MATERIALS.CORE,
          z === -1 ? CUBE_MATERIALS.B : CUBE_MATERIALS.CORE,
        ];

        pieces.push({
          id: id++,
          position: new THREE.Vector3(x, y, z),
          quaternion: new THREE.Quaternion(),
          materials,
        });
      }
    }
  }
  return pieces;
};

// Queue for moves
type Move = {
  face: string;
  dir: number; // 1 for clockwise, -1 for counter-clockwise, 2 for 180
};

export const RubiksCube = React.forwardRef((props: { onMoveStart?: () => void, onMoveEnd?: (isSolved: boolean) => void }, ref) => {
  const pieces = useRef<PieceState[]>(initCube());
  const [, setRender] = useState(0); // Trigger re-render
  
  const moveQueue = useRef<Move[]>([]);
  const currentMove = useRef<{ move: Move; progress: number } | null>(null);
  const ROTATION_SPEED = Math.PI * 3; // Radians per second

  const setIsRotating = useStore((state) => state.setIsRotating);

  const checkSolved = () => {
    const originalNormals = [
      new THREE.Vector3(1, 0, 0), // 0: R
      new THREE.Vector3(-1, 0, 0),// 1: L
      new THREE.Vector3(0, 1, 0), // 2: U
      new THREE.Vector3(0, -1, 0),// 3: D
      new THREE.Vector3(0, 0, 1), // 4: F
      new THREE.Vector3(0, 0, -1),// 5: B
    ];
    
    for (const p of pieces.current) {
      for (let i = 0; i < 6; i++) {
        const mat = p.materials[i];
        if (mat === CUBE_MATERIALS.CORE) continue;
        
        const currentNormal = originalNormals[i].clone().applyQuaternion(p.quaternion).round();
        const dirIdx = originalNormals.findIndex(n => n.equals(currentNormal));
        if (dirIdx === -1) continue;
        
        const expectedMat = [
          CUBE_MATERIALS.R, CUBE_MATERIALS.L, CUBE_MATERIALS.U,
          CUBE_MATERIALS.D, CUBE_MATERIALS.F, CUBE_MATERIALS.B
        ][dirIdx];
        
        if (mat !== expectedMat) return false;
      }
    }
    return true;
  };

  // Expose API to parent for adding moves
  React.useImperativeHandle(ref, () => ({
    executeMove: (moveStr: string) => {
      const moves = moveStr.split(' ').filter(Boolean);
      moves.forEach(m => {
        const face = m[0];
        let dir = 1;
        if (m.includes("'")) dir = -1;
        if (m.includes("2")) dir = 2;
        moveQueue.current.push({ face, dir });
      });
      if (!currentMove.current && moveQueue.current.length > 0) {
        setIsRotating(true);
        props.onMoveStart?.();
      }
    },
    reset: () => {
      pieces.current = initCube();
      moveQueue.current = [];
      currentMove.current = null;
      setIsRotating(false);
      setRender(r => r + 1);
    }
  }));

  useFrame((state, delta) => {
    if (!currentMove.current && moveQueue.current.length > 0) {
      const nextMove = moveQueue.current.shift()!;
      currentMove.current = { move: nextMove, progress: 0 };
      setIsRotating(true);
    }

    if (currentMove.current) {
      const { move, progress } = currentMove.current;
      const step = ROTATION_SPEED * delta;
      
      let nextProgress = progress + step;
      let targetProgress = move.dir === 2 ? Math.PI : Math.PI / 2;
      let isDone = false;

      if (nextProgress >= targetProgress) {
        nextProgress = targetProgress;
        isDone = true;
      }

      currentMove.current.progress = nextProgress;

      // Force render to update pieces in useFrame if needed, but we can do it locally on refs
      // Actually, since we update the meshes directly, we don't need to trigger React state!
      // But we need refs to the meshes.
      setRender(r => r + 1); // For simplicity, we trigger render. Optimization: update mesh refs directly.

      if (isDone) {
        // Finalize rotation in state
        const axis = getAxis(move.face);
        const angle = targetProgress * Math.sign(move.dir === 2 ? 1 : move.dir) * getAngleSign(move.face);
        
        const rotQuat = new THREE.Quaternion().setFromAxisAngle(axis, angle);

        pieces.current.forEach(p => {
          if (isOnFace(p.position, move.face)) {
            p.position.applyQuaternion(rotQuat);
            p.position.x = Math.round(p.position.x);
            p.position.y = Math.round(p.position.y);
            p.position.z = Math.round(p.position.z);
            p.quaternion.premultiply(rotQuat);
          }
        });

        currentMove.current = null;
        if (moveQueue.current.length === 0) {
          setIsRotating(false);
          props.onMoveEnd?.(checkSolved());
        }
      }
    }
  });

  const getAxis = (face: string) => {
    switch (face) {
      case 'R': case 'L': return new THREE.Vector3(1, 0, 0);
      case 'U': case 'D': return new THREE.Vector3(0, 1, 0);
      case 'F': case 'B': return new THREE.Vector3(0, 0, 1);
      default: return new THREE.Vector3(1, 0, 0);
    }
  };

  const getAngleSign = (face: string) => {
    switch (face) {
      case 'R': case 'U': case 'F': return -1; // Standard mathematical rotation sign might differ, we tune this
      case 'L': case 'D': case 'B': return 1;
      default: return 1;
    }
  };

  const isOnFace = (pos: THREE.Vector3, face: string) => {
    const EPSILON = 0.1;
    switch (face) {
      case 'R': return pos.x > EPSILON;
      case 'L': return pos.x < -EPSILON;
      case 'U': return pos.y > EPSILON;
      case 'D': return pos.y < -EPSILON;
      case 'F': return pos.z > EPSILON;
      case 'B': return pos.z < -EPSILON;
      default: return false;
    }
  };

  // Correct rotation directions
  const getAngle = (face: string, dir: number) => {
    let sign = 1;
    if (face === 'R' || face === 'U' || face === 'F') sign = -1;
    if (face === 'L' || face === 'D' || face === 'B') sign = 1;
    
    // Some faces need inverted signs based on standard Rubik's notation
    // R: clockwise is -x (wait, looking at R, clockwise is -x? Let's test)
    // Actually: 
    // Right (X axis): Clockwise looking at Right is -X rotation
    // Left (-X axis): Clockwise looking at Left is +X rotation
    // Up (Y axis): Clockwise looking at Top is -Y rotation
    // Down (-Y axis): Clockwise looking at Bottom is +Y rotation
    // Front (Z axis): Clockwise looking at Front is -Z rotation
    // Back (-Z axis): Clockwise looking at Back is +Z rotation
    return (dir === 2 ? 2 : dir) * sign * (Math.PI / 2);
  };

  return (
    <group>
      {/* Right Hand */}
      <RobotHand 
        side="R" 
        isActive={currentMove.current?.move.face === 'R'} 
        dir={currentMove.current?.move.face === 'R' ? currentMove.current.move.dir : 1}
        progress={currentMove.current?.move.face === 'R' ? currentMove.current.progress : 0}
      />
      {/* Left Hand */}
      <RobotHand 
        side="L" 
        isActive={currentMove.current?.move.face === 'L'} 
        dir={currentMove.current?.move.face === 'L' ? currentMove.current.move.dir : 1}
        progress={currentMove.current?.move.face === 'L' ? currentMove.current.progress : 0}
      />

      {pieces.current.map(p => {
        let displayPos = p.position.clone();
        let displayQuat = p.quaternion.clone();

        if (currentMove.current) {
          const { move, progress } = currentMove.current;
          if (isOnFace(p.position, move.face)) {
            const axis = getAxis(move.face);
            // Sign mapping for visual progress
            let sign = 1;
            if (move.face === 'R' || move.face === 'U' || move.face === 'F') sign = -1;
            if (move.face === 'L' || move.face === 'D' || move.face === 'B') sign = 1;
            
            const angle = progress * (move.dir === 2 ? 1 : Math.sign(move.dir)) * sign;
            const tempQuat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
            
            displayPos.applyQuaternion(tempQuat);
            displayQuat.premultiply(tempQuat);
          }
        }

        return (
          <mesh
            key={p.id}
            position={displayPos}
            quaternion={displayQuat}
            material={p.materials}
          >
            <boxGeometry args={[0.95, 0.95, 0.95]} />
          </mesh>
        );
      })}
    </group>
  );
});
