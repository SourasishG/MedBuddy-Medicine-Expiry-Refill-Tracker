'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { QualityTier } from '@/hooks/useGpuTier';
import { sceneTargets } from '@/lib/sceneState';
import { chromeFragmentShader, chromeVertexShader } from '@/shaders/chrome';

export interface PillHelixProps {
  tier: QualityTier;
  isMobile: boolean;
  capsuleCountOverride?: number;
}

interface PillMeta {
  index: number;
  strand: 0 | 1;
  t: number; // 0..1 along helix
  isGlass: boolean;
  baseColor: THREE.Color;
  statusColor: THREE.Color;
  spreadDir: THREE.Vector3;
  rotOffset: number;
}

const COLOR_CHROME = new THREE.Color('#DDE6F0');
const COLOR_GLASS = new THREE.Color('#CBD8EA');
const COLOR_OK = new THREE.Color('#5CF2C7');
const COLOR_WARN = new THREE.Color('#FFB347');
const COLOR_ALERT = new THREE.Color('#FF4D6A');

const LOCK_SLOTS: ReadonlyArray<readonly [number, number, number]> = [
  [-1.12, 0.95, 0.35],
  [1.12, 0.45, 0.35],
  [-1.12, -0.35, 0.35],
  [1.12, -0.85, 0.35],
];

export function PillHelix({ tier, isMobile, capsuleCountOverride }: PillHelixProps) {
  const groupRef = useRef<THREE.Group>(null);
  const chromeMeshRef = useRef<THREE.InstancedMesh>(null);
  const glassMeshRef = useRef<THREE.InstancedMesh>(null);
  const deviceTiltRef = useRef({ x: 0, y: 0 });

  const totalCount = useMemo(() => {
    if (capsuleCountOverride) return capsuleCountOverride;
    if (tier === 'high') return isMobile ? 40 : 80;
    return isMobile ? 24 : 44;
  }, [capsuleCountOverride, tier, isMobile]);

  const { chromeItems, glassItems } = useMemo(() => {
    const chromeList: PillMeta[] = [];
    const glassList: PillMeta[] = [];

    for (let i = 0; i < totalCount; i++) {
      const strand: 0 | 1 = i % 2 === 0 ? 0 : 1;
      const t = i / Math.max(totalCount - 1, 1);
      const isGlass = Math.floor(i / 2) % 2 === 1;

      // Subtle status accents on a few hero capsules
      let baseColor = isGlass ? COLOR_GLASS : COLOR_CHROME;
      if (i % 13 === 3) baseColor = COLOR_OK;
      else if (i % 17 === 7) baseColor = COLOR_WARN;
      else if (i % 23 === 11) baseColor = COLOR_ALERT;

      const statusCycle = i % 3;
      const statusColor =
        statusCycle === 0 ? COLOR_OK : statusCycle === 1 ? COLOR_WARN : COLOR_ALERT;

      const angle = t * Math.PI * 3.4 + strand * Math.PI;
      const spreadDir = new THREE.Vector3(
        Math.cos(angle) * 1.4,
        (t - 0.5) * 1.6,
        Math.sin(angle) * 1.4,
      );

      const meta: PillMeta = {
        index: i,
        strand,
        t,
        isGlass,
        baseColor: baseColor.clone(),
        statusColor: statusColor.clone(),
        spreadDir,
        rotOffset: (i * 0.73) % (Math.PI * 2),
      };

      if (isGlass) glassList.push(meta);
      else chromeList.push(meta);
    }

    return { chromeItems: chromeList, glassItems: glassList };
  }, [totalCount]);

  const chromeMatRef = useRef<THREE.ShaderMaterial>(null);

  const capsuleGeometry = useMemo(() => new THREE.CapsuleGeometry(0.048, 0.13, 8, 16), []);

  const chromeUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uKeyDir: { value: new THREE.Vector3(-4, 4, 5) },
      uRimDir: { value: new THREE.Vector3(5, 1.5, -2) },
    }),
    [],
  );

  const glassMaterial = useMemo(() => {
    if (tier === 'high') {
      return new THREE.MeshPhysicalMaterial({
        color: '#dce6f4',
        metalness: 0.05,
        roughness: 0.08,
        transmission: 0.86,
        thickness: 0.35,
        ior: 1.48,
        iridescence: 0.75,
        iridescenceIOR: 1.3,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      });
    }
    return new THREE.MeshPhysicalMaterial({
      color: '#dce6f4',
      metalness: 0.15,
      roughness: 0.14,
      transparent: true,
      opacity: 0.62,
      clearcoat: 0.8,
    });
  }, [tier]);

  useEffect(() => {
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || event.beta === null) return;
      deviceTiltRef.current.x = THREE.MathUtils.clamp(event.gamma / 45, -1, 1) * 0.25;
      deviceTiltRef.current.y = THREE.MathUtils.clamp((event.beta - 45) / 45, -1, 1) * 0.18;
    };

    window.addEventListener('deviceorientation', onOrientation, { passive: true });
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
    };
  }, []);

  useEffect(() => {
    return () => {
      capsuleGeometry.dispose();
      glassMaterial.dispose();
    };
  }, [capsuleGeometry, glassMaterial]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (chromeMatRef.current) {
      chromeMatRef.current.uniforms.uTime!.value = t;
    }

    const group = groupRef.current;
    const ringMode = sceneTargets.helixRingMode;
    if (group) {
      const targetRotY = state.pointer.x * 0.24 + deviceTiltRef.current.x;
      const targetRotX = state.pointer.y * 0.14 + deviceTiltRef.current.y;
      group.rotation.y = THREE.MathUtils.damp(group.rotation.y, targetRotY, 4, delta);
      group.rotation.x = THREE.MathUtils.damp(group.rotation.x, targetRotX, 4, delta);
    }

    const baseRadius = isMobile ? 1.08 : 1.54;
    const baseHeight = isMobile ? 2.5 : 3.5;
    const baseY = isMobile ? 0.62 : 0.28;
    const spread = sceneTargets.helixSpread;
    const statusBlend = sceneTargets.helixStatusBlend;
    const lockedCount = sceneTargets.lockedPills;
    const phoneX = sceneTargets.phoneX;
    const phoneY = sceneTargets.phoneY;

    const updateMesh = (mesh: THREE.InstancedMesh | null, items: PillMeta[]) => {
      if (!mesh) return;
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx]!;
        const helixAngle = item.t * Math.PI * 3.4 + item.strand * Math.PI + t * 0.26;
        const helixY = (item.t - 0.5) * baseHeight + baseY;
        const radius = baseRadius + spread * 1.35;

        const hx = Math.cos(helixAngle) * radius + item.spreadDir.x * spread;
        const hy = helixY + item.spreadDir.y * spread * 0.65;
        const hz = Math.sin(helixAngle) * radius + item.spreadDir.z * spread;

        // Reformed ring target for Section 08
        const ringAngle = (item.index / totalCount) * Math.PI * 2 + t * 0.14;
        const ringRadius = isMobile ? 1.38 : 1.98;
        const rx = Math.cos(ringAngle) * ringRadius;
        const ry = Math.sin(ringAngle) * ringRadius + baseY;
        const rz = Math.sin(ringAngle * 2) * 0.18 - 0.15;

        let px = THREE.MathUtils.lerp(hx, rx, ringMode);
        let py = THREE.MathUtils.lerp(hy, ry, ringMode);
        let pz = THREE.MathUtils.lerp(hz, rz, ringMode);

        let rxRot = Math.sin(t * 0.4 + item.rotOffset) * 0.35 + item.t * 1.4;
        let ryRot = helixAngle + Math.PI * 0.5;
        let rzRot = Math.cos(item.t * Math.PI * 2 + item.rotOffset) * 0.65;
        let s = 1 - spread * 0.12;

        // Lock first 4 chrome capsules into step beacons around the phone during Section 02
        const lockBlend =
          !item.isGlass && idx < 4 ? THREE.MathUtils.clamp(lockedCount - idx, 0, 1) : 0;
        if (lockBlend > 0.001) {
          const slot = LOCK_SLOTS[idx];
          if (slot) {
            px = THREE.MathUtils.lerp(px, phoneX + slot[0], lockBlend);
            py = THREE.MathUtils.lerp(py, phoneY + slot[1] + 0.14, lockBlend);
            pz = THREE.MathUtils.lerp(pz, slot[2], lockBlend);
            rxRot = THREE.MathUtils.lerp(rxRot, 0.25, lockBlend);
            ryRot = THREE.MathUtils.lerp(ryRot, 0.3, lockBlend);
            rzRot = THREE.MathUtils.lerp(rzRot, Math.PI * 0.5, lockBlend);
            s = THREE.MathUtils.lerp(s, 1.25, lockBlend);
          }
        }

        dummy.position.set(px, py, pz);
        dummy.rotation.set(rxRot, ryRot, rzRot);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);

        tempColor.copy(item.baseColor).lerp(item.statusColor, Math.max(statusBlend, lockBlend));
        mesh.setColorAt(idx, tempColor);
      }

      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };

    updateMesh(chromeMeshRef.current, chromeItems);
    updateMesh(glassMeshRef.current, glassItems);
  });

  return (
    <group ref={groupRef} position={[0, 0.08, 0]}>
      <instancedMesh
        ref={chromeMeshRef}
        args={[capsuleGeometry, undefined, chromeItems.length]}
        frustumCulled={false}
      >
        <shaderMaterial
          ref={chromeMatRef}
          vertexShader={chromeVertexShader}
          fragmentShader={chromeFragmentShader}
          uniforms={chromeUniforms}
        />
      </instancedMesh>
      <instancedMesh
        ref={glassMeshRef}
        args={[capsuleGeometry, glassMaterial, glassItems.length]}
        frustumCulled={false}
      />
    </group>
  );
}
