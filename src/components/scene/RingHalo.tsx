'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { sceneTargets } from '@/lib/sceneState';
import { grainFragmentShader, grainVertexShader } from '@/shaders/grain';
import { glitchFragmentShader, glitchVertexShader } from '@/shaders/glitch';

export function RingHalo({ isMobile = false }: { isMobile?: boolean }) {
  const torusRef = useRef<THREE.Mesh>(null);
  const haloGlowRef = useRef<THREE.Mesh>(null);
  const { size } = useThree();

  const grainUniformsRef = useRef({
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1440, 900) },
    uBaseColor: { value: new THREE.Color('#090C12') },
    uHaloColor: { value: new THREE.Color('#1F4BFF') },
    uIntensity: { value: 1.0 },
  });

  const haloUniformsRef = useRef({
    uOpacity: { value: 0.9 },
    uColor: { value: new THREE.Color('#1F4BFF') },
  });

  const glitchUniformsRef = useRef({
    uTime: { value: 0 },
    uPulse: { value: 0 },
    uAccentColor: { value: new THREE.Color('#FF4D6A') },
  });

  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const grainMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: grainVertexShader,
        fragmentShader: grainFragmentShader,
        depthWrite: false,
        uniforms: grainUniformsRef.current,
      }),
    [],
  );

  const haloDiscMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uOpacity;
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            float d = length(vUv - 0.5) * 2.0;
            float ring = exp(-pow((d - 0.62) * 3.2, 2.0));
            float core = exp(-d * d * 2.8) * 0.45;
            float alpha = (ring * 0.28 + core * 0.35) * uOpacity * smoothstep(1.0, 0.35, d);
            gl_FragColor = vec4(uColor, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: haloUniformsRef.current,
      }),
    [],
  );

  const glitchMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glitchVertexShader,
        fragmentShader: glitchFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: glitchUniformsRef.current,
      }),
    [],
  );

  const ringColor = useMemo(() => new THREE.Color(2.15, 2.3, 2.55), []);

  useEffect(() => {
    return () => {
      grainMaterial.dispose();
      haloDiscMaterial.dispose();
      glitchMaterial.dispose();
    };
  }, [grainMaterial, haloDiscMaterial, glitchMaterial]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    grainUniformsRef.current.uTime.value = t;
    grainUniformsRef.current.uResolution.value.set(size.width, size.height);
    grainUniformsRef.current.uIntensity.value = sceneTargets.haloIntensity;

    haloUniformsRef.current.uOpacity.value = 0.85 * sceneTargets.haloIntensity;

    glitchUniformsRef.current.uTime.value = t;
    glitchUniformsRef.current.uPulse.value = sceneTargets.glitchPulse;

    if (ringMatRef.current) {
      ringMatRef.current.opacity = THREE.MathUtils.damp(
        ringMatRef.current.opacity,
        sceneTargets.ringOpacity,
        5,
        delta,
      );
    }

    const torus = torusRef.current;
    if (torus) {
      const baseScale = isMobile ? 0.84 : 1;
      const targetScale = sceneTargets.ringScale * baseScale;
      const nextScale = THREE.MathUtils.damp(torus.scale.x, targetScale, 5, delta);
      torus.scale.setScalar(nextScale);
      torus.rotation.z = t * 0.08;
      torus.rotation.x = Math.sin(t * 0.25) * 0.06;
      torus.rotation.y = Math.cos(t * 0.2) * 0.08;
    }

    const halo = haloGlowRef.current;
    if (halo) {
      const baseScale = isMobile ? 0.84 : 1;
      halo.scale.setScalar(sceneTargets.ringScale * baseScale);
    }
  });

  return (
    <group>
      {/* Background animated grain + gradient mesh plane */}
      <mesh position={[0, 0, -6.5]} scale={[22, 14, 1]} material={grainMaterial}>
        <planeGeometry args={[1, 1]} />
      </mesh>

      {/* Deep --halo ambient glow disc */}
      <mesh ref={haloGlowRef} position={[0, 0.08, -1.65]} material={haloDiscMaterial}>
        <planeGeometry args={[6.4, 6.4]} />
      </mesh>

      {/* Glowing thin white torus halo */}
      <mesh ref={torusRef} position={[0, 0.08, -0.95]}>
        <torusGeometry args={[2.06, 0.018, 20, 140]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color={ringColor}
          toneMapped={false}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Short <300ms scan-line glitch overlay plane (inactive when uPulse == 0) */}
      <mesh position={[0, 0.08, 1.8]} scale={[7, 5, 1]} material={glitchMaterial}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </group>
  );
}
