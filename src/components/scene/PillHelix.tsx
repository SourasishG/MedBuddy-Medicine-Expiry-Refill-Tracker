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

  const capsuleGeometry = useMemo(() => new THREE.CapsuleGeometry(0.068, 0.16, 8, 16), []);

  const chromeUniformsRef = useRef({
    uTime: { value: 0 },
    uKeyDir: { value: new THREE.Vector3(-4, 4, 5) },
    uRimDir: { value: new THREE.Vector3(5, 1.5, -2) },
  });

  const chromeMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  if (!chromeMaterialRef.current) {
    chromeMaterialRef.current = new THREE.ShaderMaterial({
      vertexShader: chromeVertexShader,
      fragmentShader: chromeFragmentShader,
      uniforms: chromeUniformsRef.current,
    });
  }
  const chromeMaterial = chromeMaterialRef.current;

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
      chromeMaterial.dispose();
      glassMaterial.dispose();
    };
  }, [capsuleGeometry, chromeMaterial, glassMaterial]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    chromeUniformsRef.current.uTime.value = t;

    const group = groupRef.current;
    if (group) {
      const targetRotY = t * 0.16 + state.pointer.x * 0.24 + deviceTiltRef.current.x;
      const targetRotX = state.pointer.y * 0.14 + deviceTiltRef.current.y;
      group.rotation.y = THREE.MathUtils.damp(group.rotation.y, targetRotY, 4, delta);
      group.rotation.x = THREE.MathUtils.damp(group.rotation.x, targetRotX, 4, delta);
    }

    const baseRadius = isMobile ? 1.44 : 1.72;
    const spread = sceneTargets.helixSpread;
    const ringMode = sceneTargets.helixRingMode;
    const statusBlend = sceneTargets.helixStatusBlend;

    const updateMesh = (mesh: THREE.InstancedMesh | null, items: PillMeta[]) => {
      if (!mesh) return;
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx]!;
        const helixAngle = item.t * Math.PI * 3.4 + item.strand * Math.PI + t * 0.12;
        const helixY = (item.t - 0.5) * 3.9;
        const radius = baseRadius + spread * 1.35;

        const hx = Math.cos(helixAngle) * radius + item.spreadDir.x * spread;
        const hy = helixY + item.spreadDir.y * spread * 0.65;
        const hz = Math.sin(helixAngle) * radius + item.spreadDir.z * spread;

        // Reformed ring target for Section 08
        const ringAngle = (item.index / totalCount) * Math.PI * 2 + t * 0.14;
        const ringRadius = isMobile ? 1.78 : 2.22;
        const rx = Math.cos(ringAngle) * ringRadius;
        const ry = Math.sin(ringAngle) * ringRadius + 0.08;
        const rz = Math.sin(ringAngle * 2) * 0.18 - 0.15;

        dummy.position.set(
          THREE.MathUtils.lerp(hx, rx, ringMode),
          THREE.MathUtils.lerp(hy, ry, ringMode),
          THREE.MathUtils.lerp(hz, rz, ringMode),
        );

        dummy.rotation.set(
          Math.sin(t * 0.4 + item.rotOffset) * 0.35 + item.t * 1.4,
          helixAngle + Math.PI * 0.5,
          Math.cos(item.t * Math.PI * 2 + item.rotOffset) * 0.65,
        );

        const s = 1 - spread * 0.12;
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);

        tempColor.copy(item.baseColor).lerp(item.statusColor, statusBlend);
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
        args={[capsuleGeometry, chromeMaterial, chromeItems.length]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={glassMeshRef}
        args={[capsuleGeometry, glassMaterial, glassItems.length]}
        frustumCulled={false}
      />
    </group>
  );
}
