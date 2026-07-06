import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface RobotHandProps {
  side: 'L' | 'R';
  isActive: boolean;
  progress: number;
  dir: number; // 1, -1, 2
}

export function RobotHand({ side, isActive, progress, dir }: RobotHandProps) {
  const handGroup = useRef<THREE.Group>(null);
  
  const isRight = side === 'R';
  const position = new THREE.Vector3(isRight ? 1.6 : -1.6, 0, 0);
  const baseRotation = isRight ? [0, 0, 0] : [0, Math.PI, 0];
  
  useFrame((state, delta) => {
    if (handGroup.current) {
      if (isActive) {
        // twist hand
        let sign = isRight ? -1 : 1; 
        let angle = progress * (dir === 2 ? 1 : Math.sign(dir)) * sign;
        handGroup.current.rotation.x = angle;
      } else {
        // return to 0 smoothly
        handGroup.current.rotation.x = THREE.MathUtils.lerp(handGroup.current.rotation.x, 0, 10 * delta);
      }
    }
  });

  // Materials
  const skinMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#fcdcb4", roughness: 0.4 }), []);

  return (
    <group position={position} rotation={baseRotation as any}>
      <group ref={handGroup}>
        {/* Palm */}
        <mesh position={[0.2, 0, 0]} material={skinMaterial}>
          <boxGeometry args={[0.3, 1.3, 1.3]} />
        </mesh>
        
        {/* Thumb */}
        <group position={[-0.05, 0.5, 0.6]} rotation={[0, -Math.PI/6, Math.PI/6]}>
          <mesh material={skinMaterial} position={[-0.2, 0, 0]}>
             <boxGeometry args={[0.5, 0.25, 0.25]} />
          </mesh>
        </group>
        
        {/* Index */}
        <group position={[-0.05, 0.4, -0.6]} rotation={[0, Math.PI/8, 0]}>
          <mesh material={skinMaterial} position={[-0.3, 0, 0]}>
             <boxGeometry args={[0.7, 0.22, 0.22]} />
          </mesh>
        </group>
        
        {/* Middle */}
        <group position={[-0.05, 0.1, -0.65]} rotation={[0, Math.PI/10, 0]}>
          <mesh material={skinMaterial} position={[-0.35, 0, 0]}>
             <boxGeometry args={[0.8, 0.22, 0.22]} />
          </mesh>
        </group>
        
        {/* Ring */}
        <group position={[-0.05, -0.2, -0.65]} rotation={[0, Math.PI/12, 0]}>
          <mesh material={skinMaterial} position={[-0.3, 0, 0]}>
             <boxGeometry args={[0.7, 0.22, 0.22]} />
          </mesh>
        </group>
        
        {/* Pinky */}
        <group position={[-0.05, -0.5, -0.6]} rotation={[0, Math.PI/16, 0]}>
          <mesh material={skinMaterial} position={[-0.2, 0, 0]}>
             <boxGeometry args={[0.5, 0.18, 0.18]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
