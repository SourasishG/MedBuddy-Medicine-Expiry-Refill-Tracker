'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { sceneTargets } from '@/lib/sceneState';
import { grainFragmentShader, grainVertexShader } from '@/shaders/grain';
import { glitchFragmentShader, glitchVertexShader } from '@/shaders/glitch';

const HALO_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HALO_FRAGMENT = /* glsl */ `
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
`;

function setFloatUniform(material: THREE.ShaderMaterial | null, key: string, value: number) {
  const uniform = material?.uniforms[key];
  if (uniform) uniform.value = value;
}

export function RingHalo({ isMobile = false }: { isMobile?: boolean }) {
  const torusRef = useRef<THREE.Mesh>(null);
  const haloGlowRef = useRef<THREE.Mesh>(null);

  const grainMatRef = useRef<THREE.ShaderMaterial>(null);
  const haloMatRef = useRef<THREE.ShaderMaterial>(null);
  const glitchMatRef = useRef<THREE.ShaderMaterial>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const { size } = useThree();

  const grainUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1440, 900) },
      uBaseColor: { value: new THREE.Color('#090C12') },
      uHaloColor: { value: new THREE.Color('#1F4BFF') },
      uIntensity: { value: 1.0 },
    }),
    [],
  );

  const haloUniforms = useMemo(
    () => ({
      uOpacity: { value: 0.9 },
      uColor: { value: new THREE.Color('#1F4BFF') },
    }),
    [],
  );

  const glitchUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPulse: { value: 0 },
      uAccentColor: { value: new THREE.Color('#FF4D6A') },
    }),
    [],
  );

  const ringColor = useMemo(() => new THREE.Color(2.15, 2.3, 2.55), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;

    if (grainMatRef.current) {
      setFloatUniform(grainMatRef.current, 'uTime', t);
      const resUniform = grainMatRef.current.uniforms['uResolution'];
      if (resUniform?.value instanceof THREE.Vector2) {
        resUniform.value.set(size.width, size.height);
      }
      setFloatUniform(grainMatRef.current, 'uIntensity', sceneTargets.haloIntensity);
    }

    setFloatUniform(haloMatRef.current, 'uOpacity', 0.36 * sceneTargets.haloIntensity);
    setFloatUniform(glitchMatRef.current, 'uTime', t);
    setFloatUniform(glitchMatRef.current, 'uPulse', sceneTargets.glitchPulse);

    if (ringMatRef.current) {
      ringMatRef.current.opacity = THREE.MathUtils.damp(
        ringMatRef.current.opacity,
        sceneTargets.ringOpacity,
        6,
        dt,
      );
    }

    const torus = torusRef.current;
    const baseY = isMobile ? 0.62 : 0.3;
    const baseScale = isMobile ? 0.66 : 0.88;
    if (torus) {
      const targetScale = sceneTargets.ringScale * baseScale;
      const nextScale = THREE.MathUtils.damp(torus.scale.x, targetScale, 6, dt);
      torus.scale.setScalar(nextScale);
      torus.position.y = baseY;
      torus.rotation.z = t * 0.08;
      torus.rotation.x = Math.sin(t * 0.25) * 0.06;
      torus.rotation.y = Math.cos(t * 0.2) * 0.08;
    }

    const halo = haloGlowRef.current;
    if (halo) {
      halo.position.y = baseY;
      halo.scale.setScalar(sceneTargets.ringScale * baseScale);
    }
  });

  return (
    <group>
      {/* Background animated grain + gradient mesh plane */}
      <mesh position={[0, 0, -6.5]} scale={[22, 14, 1]}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={grainMatRef}
          vertexShader={grainVertexShader}
          fragmentShader={grainFragmentShader}
          depthWrite={false}
          uniforms={grainUniforms}
        />
      </mesh>

      {/* Deep --halo ambient glow disc */}
      <mesh ref={haloGlowRef} position={[0, 0.08, -1.65]}>
        <planeGeometry args={[6.4, 6.4]} />
        <shaderMaterial
          ref={haloMatRef}
          vertexShader={HALO_VERTEX}
          fragmentShader={HALO_FRAGMENT}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={haloUniforms}
        />
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
      <mesh position={[0, 0.08, 1.8]} scale={[7, 5, 1]}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={glitchMatRef}
          vertexShader={glitchVertexShader}
          fragmentShader={glitchFragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={glitchUniforms}
        />
      </mesh>
    </group>
  );
}
