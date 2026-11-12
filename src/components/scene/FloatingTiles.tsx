'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ContactShadows, RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sceneTargets } from '@/lib/sceneState';

interface TileSpec {
  basePos: [number, number, number];
  liftPos: [number, number, number];
  rot: [number, number, number];
  accent: string;
  phase: number;
}

const TILES: TileSpec[] = [
  {
    basePos: [-1.82, 0.92, 0.45],
    liftPos: [-2.45, 1.15, 0.95],
    rot: [0.12, 0.34, -0.08],
    accent: '#5CF2C7',
    phase: 0.4,
  },
  {
    basePos: [1.92, 0.68, -0.35],
    liftPos: [2.52, 0.96, 0.65],
    rot: [-0.08, -0.38, 0.1],
    accent: '#FFB347',
    phase: 1.7,
  },
  {
    basePos: [-1.74, -0.78, -0.25],
    liftPos: [-2.38, -0.95, 0.85],
    rot: [0.14, 0.28, 0.06],
    accent: '#DDE6F0',
    phase: 3.1,
  },
  {
    basePos: [1.78, -0.86, 0.55],
    liftPos: [2.42, -1.02, 1.05],
    rot: [-0.1, -0.28, -0.06],
    accent: '#FF4D6A',
    phase: 4.5,
  },
];

export function FloatingTiles({ isMobile = false }: { isMobile?: boolean }) {
  const tileRefs = useRef<Array<THREE.Group | null>>([]);

  const glassMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#1b2434',
        metalness: 0.1,
        roughness: 0.18,
        transparent: true,
        opacity: 0.55,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      glassMaterial.dispose();
    };
  }, [glassMaterial]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const lift = sceneTargets.tilesLift;
    const mobileScale = isMobile ? 0.78 : 1;

    TILES.forEach((spec, idx) => {
      const ref = tileRefs.current[idx];
      if (!ref) return;

      const bob = Math.sin(t * 0.9 + spec.phase) * 0.08;
      const tx = THREE.MathUtils.lerp(spec.basePos[0], spec.liftPos[0], lift) * mobileScale;
      const ty = THREE.MathUtils.lerp(spec.basePos[1], spec.liftPos[1], lift) + bob;
      const tz = THREE.MathUtils.lerp(spec.basePos[2], spec.liftPos[2], lift);

      ref.position.x = THREE.MathUtils.damp(ref.position.x, tx, 4, delta);
      ref.position.y = THREE.MathUtils.damp(ref.position.y, ty, 4, delta);
      ref.position.z = THREE.MathUtils.damp(ref.position.z, tz, 4, delta);
    });
  });

  return (
    <group>
      {TILES.map((spec, idx) => (
        <group
          key={idx}
          ref={(el) => {
            tileRefs.current[idx] = el;
          }}
          position={spec.basePos}
          rotation={spec.rot}
        >
          <RoundedBox args={[0.42, 0.28, 0.035]} radius={0.05} material={glassMaterial} />
          {/* Tiny glowing status pip */}
          <mesh position={[-0.12, 0.05, 0.022]}>
            <sphereGeometry args={[0.024, 12, 12]} />
            <meshBasicMaterial color={spec.accent} toneMapped={false} />
          </mesh>
          {/* Minimal indicator bar */}
          <mesh position={[0.04, -0.02, 0.02]}>
            <boxGeometry args={[0.18, 0.022, 0.008]} />
            <meshBasicMaterial color="#9AA6B8" transparent opacity={0.65} />
          </mesh>
        </group>
      ))}

      {/* Soft contact shadow rendered once */}
      <ContactShadows
        frames={1}
        position={[0, -2.32, 0]}
        opacity={0.42}
        scale={8.5}
        blur={2.4}
        far={5}
        color="#020408"
      />
    </group>
  );
}
