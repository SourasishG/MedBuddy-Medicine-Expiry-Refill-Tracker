export const glitchVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const glitchFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uPulse; // 0.0 when idle, brief <300ms burst 0..1 on alert transition
  uniform vec3 uAccentColor;

  varying vec2 vUv;

  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }

  void main() {
    if (uPulse <= 0.001) {
      discard;
    }

    float band = floor(vUv.y * 42.0);
    float rnd = hash11(band + floor(uTime * 24.0));
    float slice = step(0.82, rnd) * uPulse;

    float scanline = 0.5 + 0.5 * sin(vUv.y * 220.0 + uTime * 28.0);
    float edgeFade = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);

    float alpha = (slice * 0.22 + scanline * 0.08 * uPulse) * edgeFade;
    gl_FragColor = vec4(uAccentColor, alpha);
  }
`;
