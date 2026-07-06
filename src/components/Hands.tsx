import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Human hand model: "Low Poly Right Hand" by Raziq Brown, CC-BY 3.0, via Poly
// Pizza. https://poly.pizza/m/cl8ax5B13cp  (bundled at public/models/hand.glb)
// It ships a curled/cupped palm, so it reads as gripping the cube.
const HAND_MODEL_URL = '/models/hand.glb';
useGLTF.preload(HAND_MODEL_URL);

// The model has a single flat grey material; recolor it to a human skin tone.
const SKIN_COLOR = '#e0ac69';

// --- Seating constants -------------------------------------------------------
// The raw model is tiny and offset, so it's normalized (centered + unit-scaled)
// at load; the constants below then work in cube-local units.
// TARGET_SIZE = the hand's largest dimension in cube units (cube face ~3 units).
const TARGET_SIZE = 2.6;
// How far out along X the palm sits from the cube centre. Derived from the mesh:
// at 1.96 the innermost palm vertex lands at the face (~1.475) with a hair of
// clearance, so the palm holds the cube without overlapping it.
const OFFSET_X = 1.96;
// The model's palm normal is ~(+0.92, 0, -0.39) in its local frame; rotating
// 2.74 rad (157°) about Y turns it to face exactly -X, i.e. toward the cube.
// The leading X = π then rotates the hand a further 180° about X so the fingers
// point up instead of down, while leaving the palm facing the cube (a rotation
// about X preserves the palm's -X normal).
const BASE_ROTATION: [number, number, number] = [Math.PI, 2.74, 0];
// Hand is already vertically centred after normalization; no extra offset.
const BASE_POSITION: [number, number, number] = [0, 0, 0];

interface RobotHandProps {
  side: 'L' | 'R';
  isActive: boolean;
  progress: number;
  dir: number; // 1, -1, 2
}

export function RobotHand({ side, isActive, progress, dir }: RobotHandProps) {
  const handGroup = React.useRef<THREE.Group>(null);
  const isRight = side === 'R';

  const { scene } = useGLTF(HAND_MODEL_URL);

  // Each side mounts its own instance. A three.js object can only have one
  // parent, so the shared loaded scene must be cloned per hand. The mesh is
  // unskinned, so a deep clone() is sufficient (no SkeletonUtils needed).
  const model = useMemo(() => {
    const clone = scene.clone(true);
    // Left hand is a mirror of the right (negative X scale). Mirroring flips
    // triangle winding, so render both sides to avoid an inside-out look.
    // Also recolor the flat grey model material to a human skin tone.
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.Material | THREE.Material[];
      const clonedMat = Array.isArray(mat) ? mat.map((m) => m.clone()) : mat.clone();
      (Array.isArray(clonedMat) ? clonedMat : [clonedMat]).forEach((m) => {
        m.side = THREE.DoubleSide;
        const stdMat = m as THREE.MeshStandardMaterial;
        if (stdMat.color) {
          stdMat.color.set(SKIN_COLOR);
          stdMat.roughness = 0.7;
          stdMat.metalness = 0;
        }
      });
      mesh.material = clonedMat;
    });

    // The raw mesh is tiny and offset from the origin. Recenter it on its
    // bounding-box centre and normalize to unit size, then wrap it so the
    // exported object measures ~1 unit and is centred — TARGET_SIZE below then
    // sets its real size in cube units.
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    clone.position.sub(center);
    const wrapper = new THREE.Group();
    wrapper.add(clone);
    wrapper.scale.setScalar(1 / maxDim);
    return wrapper;
  }, [scene]);

  // Outer placement group flanks the cube; a negative X scale mirrors the whole
  // right-hand mesh into a left hand (rotation alone can't flip a chiral hand).
  const outerPosition = new THREE.Vector3(isRight ? OFFSET_X : -OFFSET_X, 0, 0);
  const outerScale: [number, number, number] = [isRight ? 1 : -1, 1, 1];

  useFrame((state, delta) => {
    if (!handGroup.current) return;
    if (isActive) {
      // Twist the hand at the wrist in sync with the face turn.
      const sign = isRight ? -1 : 1;
      const angle = progress * (dir === 2 ? 1 : Math.sign(dir)) * sign;
      handGroup.current.rotation.x = angle;
    } else {
      // Ease back to rest.
      handGroup.current.rotation.x = THREE.MathUtils.lerp(
        handGroup.current.rotation.x,
        0,
        10 * delta,
      );
    }
  });

  return (
    <group position={outerPosition} scale={outerScale}>
      <group ref={handGroup}>
        <group rotation={BASE_ROTATION} position={BASE_POSITION} scale={TARGET_SIZE}>
          <primitive object={model} />
        </group>
      </group>
    </group>
  );
}
