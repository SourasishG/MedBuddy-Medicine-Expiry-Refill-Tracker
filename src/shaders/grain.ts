export const grainVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const grainFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uBaseColor;
  uniform vec3 uHaloColor;
  uniform float uIntensity;

  varying vec2 vUv;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec2 uv = vUv;
    vec2 center = vec2(0.5, 0.52);

    // Slow drifting gradient mesh offsets
    vec2 driftA = center + vec2(sin(uTime * 0.14) * 0.08, cos(uTime * 0.11) * 0.06);
    vec2 driftB = center + vec2(cos(uTime * 0.09) * 0.14, sin(uTime * 0.13) * 0.09);

    float distA = length((uv - driftA) * vec2(1.15, 1.0));
    float distB = length((uv - driftB) * vec2(1.0, 1.25));

    float meshA = exp(-distA * distA * 5.2);
    float meshB = exp(-distB * distB * 8.0);

    vec3 col = uBaseColor;
    col += uHaloColor * meshA * 0.24 * uIntensity;
    col += vec3(0.08, 0.14, 0.34) * meshB * 0.14 * uIntensity;

    // Subtle film grain (~3.5%)
    float grain = hash12(uv * max(uResolution, vec2(640.0)) + fract(uTime * 7.13)) - 0.5;
    col += grain * 0.028;

    gl_FragColor = vec4(col, 1.0);
  }
`;
