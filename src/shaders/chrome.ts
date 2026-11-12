export const chromeVertexShader = /* glsl */ `
  varying vec3 vNormalWorld;
  varying vec3 vViewDir;
  varying vec3 vInstanceTint;

  void main() {
    mat4 modelMat = modelMatrix;
    #ifdef USE_INSTANCING
      modelMat = modelMatrix * instanceMatrix;
    #endif

    #ifdef USE_INSTANCING_COLOR
      vInstanceTint = instanceColor;
    #else
      vInstanceTint = vec3(0.867, 0.902, 0.941);
    #endif

    vec4 worldPosition = modelMat * vec4(position, 1.0);
    vNormalWorld = normalize(mat3(modelMat) * normal);
    vViewDir = normalize(cameraPosition - worldPosition.xyz);

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const chromeFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uKeyDir;
  uniform vec3 uRimDir;

  varying vec3 vNormalWorld;
  varying vec3 vViewDir;
  varying vec3 vInstanceTint;

  // Cosine palette for subtle thin-film iridescence
  vec3 iridescence(float angle) {
    vec3 a = vec3(0.72, 0.78, 0.86);
    vec3 b = vec3(0.24, 0.22, 0.28);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.05, 0.22, 0.45);
    return a + b * cos(6.28318 * (c * angle + d));
  }

  void main() {
    vec3 N = normalize(vNormalWorld);
    vec3 V = normalize(vViewDir);

    float ndotv = clamp(dot(N, V), 0.0, 1.0);
    float fresnel = pow(1.0 - ndotv, 3.2);

    // Cool left key + warm right rim
    float keySpec = pow(max(dot(reflect(-V, N), normalize(uKeyDir)), 0.0), 28.0);
    float rimSpec = pow(max(dot(reflect(-V, N), normalize(uRimDir)), 0.0), 18.0);

    // Studio environment horizon reflection approximation
    vec3 R = reflect(-V, N);
    float horizon = smoothstep(-0.25, 0.35, R.y);
    vec3 envCol = mix(vec3(0.04, 0.05, 0.08), vec3(0.82, 0.88, 0.96), horizon);

    vec3 irid = iridescence(ndotv * 1.4 + uTime * 0.05);
    vec3 baseChrome = mix(envCol * vInstanceTint, irid * vInstanceTint, fresnel * 0.55);

    vec3 finalCol = baseChrome;
    finalCol += vec3(0.78, 0.88, 1.0) * keySpec * 0.9;
    finalCol += vec3(1.0, 0.78, 0.52) * rimSpec * 0.48;
    finalCol += irid * fresnel * 0.42;

    gl_FragColor = vec4(finalCol, 1.0);
  }
`;
