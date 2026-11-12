'use client';

import { Environment, Lightformer } from '@react-three/drei';
import { Bloom, ChromaticAberration, EffectComposer } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import type { QualityTier } from '@/hooks/useGpuTier';

export interface EffectsProps {
  tier: QualityTier;
  isMobile: boolean;
  bloomEnabled: boolean;
}

const CA_OFFSET = new THREE.Vector2(0.00055, 0.00055);

export function Effects({ tier, isMobile, bloomEnabled }: EffectsProps) {
  const showChromatic = tier === 'high' && !isMobile;

  return (
    <>
      {/* Procedural studio lighting without external HDR downloads */}
      <ambientLight intensity={0.22} color="#9AA6B8" />
      <directionalLight position={[-5, 4, 5]} intensity={1.85} color="#CFE2FF" />
      <directionalLight position={[5, 1.5, -2.5]} intensity={1.1} color="#FFD6A6" />
      <pointLight position={[0, 0.2, -2.4]} intensity={1.2} color="#1F4BFF" distance={8} />

      <Environment resolution={256} frames={1}>
        {/* Cool left studio key */}
        <Lightformer
          form="rect"
          intensity={2.4}
          color="#CFE2FF"
          position={[-5, 2, 3]}
          scale={[4, 6, 1]}
          target={[0, 0, 0]}
        />
        {/* Warm right rim */}
        <Lightformer
          form="rect"
          intensity={1.6}
          color="#FFD8AC"
          position={[5, 0.5, -2]}
          scale={[3, 5, 1]}
          target={[0, 0, 0]}
        />
        {/* Soft top strip */}
        <Lightformer
          form="rect"
          intensity={1.4}
          color="#EAF0F6"
          position={[0, 6, 1]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[6, 2, 1]}
        />
      </Environment>

      {bloomEnabled && (
        <EffectComposer multisampling={0}>
          <Bloom
            mipmapBlur
            luminanceThreshold={1.0}
            luminanceSmoothing={0.25}
            intensity={tier === 'high' ? 0.42 : 0.28}
            radius={0.62}
          />
          {showChromatic ? (
            <ChromaticAberration
              blendFunction={BlendFunction.NORMAL}
              offset={CA_OFFSET}
              radialModulation
              modulationOffset={0.65}
            />
          ) : (
            <></>
          )}
        </EffectComposer>
      )}
    </>
  );
}
