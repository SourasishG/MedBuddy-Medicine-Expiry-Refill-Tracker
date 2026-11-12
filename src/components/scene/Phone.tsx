'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  getActivePhoneScreen,
  sceneTargets,
  subscribePhoneScreen,
  type PhoneScreenId,
} from '@/lib/sceneState';
import { PhoneScreen } from './PhoneScreen';
import { SafeHtmlTransform } from './SafeHtmlTransform';
import { createBakedScreenTexture } from './bakedPhoneTexture';

const SCREEN_CONTAINER_STYLE = { pointerEvents: 'none' as const };

export interface PhoneProps {
  useBakedScreen?: boolean;
  isMobile?: boolean;
}

export function Phone({ useBakedScreen = false, isMobile = false }: PhoneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [activeScreen, setActiveScreen] = useState<PhoneScreenId>(() => getActivePhoneScreen());

  useEffect(() => {
    return subscribePhoneScreen(setActiveScreen);
  }, []);

  const bakedTexture = useMemo(() => {
    if (!useBakedScreen) return null;
    return createBakedScreenTexture(activeScreen);
  }, [useBakedScreen, activeScreen]);

  useEffect(() => {
    return () => {
      bakedTexture?.dispose();
    };
  }, [bakedTexture]);

  const chassisMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#1b2230',
        metalness: 1,
        roughness: 0.2,
        clearcoat: 1,
        clearcoatRoughness: 0.14,
        reflectivity: 0.95,
      }),
    [],
  );

  const bezelMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#070a10',
        metalness: 0.35,
        roughness: 0.28,
      }),
    [],
  );

  const buttonMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#526075',
        metalness: 0.95,
        roughness: 0.22,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      chassisMaterial.dispose();
      bezelMaterial.dispose();
      buttonMaterial.dispose();
    };
  }, [chassisMaterial, bezelMaterial, buttonMaterial]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const baseScale = isMobile ? 0.62 : 0.88;
    const baseYOffset = isMobile ? 0.54 : 0.22;
    const targetScale = sceneTargets.phoneScale * baseScale;
    const idleFloat = Math.sin(state.clock.elapsedTime * 0.85) * 0.035;

    group.position.x = THREE.MathUtils.damp(group.position.x, sceneTargets.phoneX, 5, delta);
    group.position.y = THREE.MathUtils.damp(
      group.position.y,
      sceneTargets.phoneY + baseYOffset + idleFloat,
      5,
      delta,
    );
    group.position.z = THREE.MathUtils.damp(group.position.z, sceneTargets.phoneZ, 5, delta);

    group.rotation.x = THREE.MathUtils.damp(
      group.rotation.x,
      sceneTargets.phoneRotX + state.pointer.y * 0.06,
      5,
      delta,
    );
    group.rotation.y = THREE.MathUtils.damp(
      group.rotation.y,
      sceneTargets.phoneRotY + state.pointer.x * 0.1,
      5,
      delta,
    );
    group.rotation.z = THREE.MathUtils.damp(group.rotation.z, sceneTargets.phoneRotZ, 5, delta);

    const nextScale = THREE.MathUtils.damp(group.scale.x, targetScale, 5, delta);
    group.scale.setScalar(nextScale);
  });

  return (
    <group ref={groupRef} position={[0, 0.08, 0]}>
      {/* Main Graphite Chrome Body */}
      <RoundedBox
        args={[1.48, 2.98, 0.16]}
        radius={0.19}
        smoothness={5}
        material={chassisMaterial}
      />

      {/* Front Dark Glass Bezel */}
      <RoundedBox
        args={[1.38, 2.86, 0.02]}
        radius={0.15}
        smoothness={4}
        position={[0, 0, 0.075]}
        material={bezelMaterial}
      />

      {/* Camera Bump on Back */}
      <RoundedBox
        args={[0.56, 0.58, 0.05]}
        radius={0.12}
        smoothness={4}
        position={[-0.36, 1.06, -0.095]}
        material={chassisMaterial}
      />
      <mesh position={[-0.48, 1.18, -0.125]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.095, 0.095, 0.03, 24]} />
        <meshStandardMaterial color="#05070c" metalness={0.8} roughness={0.12} />
      </mesh>
      <mesh position={[-0.24, 0.94, -0.125]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.095, 0.095, 0.03, 24]} />
        <meshStandardMaterial color="#05070c" metalness={0.8} roughness={0.12} />
      </mesh>

      {/* Side Hardware Buttons */}
      <RoundedBox
        args={[0.03, 0.24, 0.04]}
        radius={0.01}
        position={[-0.75, 0.56, 0]}
        material={buttonMaterial}
      />
      <RoundedBox
        args={[0.03, 0.36, 0.04]}
        radius={0.01}
        position={[-0.75, 0.16, 0]}
        material={buttonMaterial}
      />
      <RoundedBox
        args={[0.03, 0.36, 0.04]}
        radius={0.01}
        position={[-0.75, -0.28, 0]}
        material={buttonMaterial}
      />
      <RoundedBox
        args={[0.03, 0.44, 0.04]}
        radius={0.01}
        position={[0.75, 0.28, 0]}
        material={buttonMaterial}
      />

      {/* Screen Layer: Real React UI or Baked Texture Fallback */}
      {useBakedScreen && bakedTexture ? (
        <mesh position={[0, 0, 0.089]}>
          <planeGeometry args={[1.31, 2.74]} />
          <meshBasicMaterial map={bakedTexture} toneMapped={false} />
        </mesh>
      ) : (
        <mesh position={[0, 0, 0.088]}>
          <planeGeometry args={[1.31, 2.74]} />
          <meshBasicMaterial color="#090C12" />
          <SafeHtmlTransform position={[0, 0, 0.004]} scale={0.197} style={SCREEN_CONTAINER_STYLE}>
            <PhoneScreen screen={activeScreen} />
          </SafeHtmlTransform>
        </mesh>
      )}
    </group>
  );
}
