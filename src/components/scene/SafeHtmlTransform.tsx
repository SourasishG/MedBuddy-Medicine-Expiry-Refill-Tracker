'use client';

import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();

function epsilon(value: number) {
  return Math.abs(value) < 1e-10 ? 0 : value;
}

function getCSSMatrix(matrix: THREE.Matrix4, multipliers: number[], prepend = '') {
  let matrix3d = 'matrix3d(';
  for (let i = 0; i !== 16; i++) {
    const m = multipliers[i] ?? 0;
    const e = matrix.elements[i] ?? 0;
    matrix3d += epsilon(m * e) + (i !== 15 ? ',' : ')');
  }
  return prepend + matrix3d;
}

const CAMERA_MULTIPLIERS = [1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1];

function getCameraCSSMatrix(matrix: THREE.Matrix4) {
  return getCSSMatrix(matrix, CAMERA_MULTIPLIERS);
}

function getObjectCSSMatrix(matrix: THREE.Matrix4, factor: number) {
  const f = factor;
  const multipliers = [
    1 / f,
    1 / f,
    1 / f,
    1,
    -1 / f,
    -1 / f,
    -1 / f,
    -1,
    1 / f,
    1 / f,
    1 / f,
    1,
    1,
    1,
    1,
    1,
  ];
  return getCSSMatrix(matrix, multipliers, 'translate(-50%,-50%)');
}

function isObjectBehindCamera(el: THREE.Object3D, camera: THREE.Camera) {
  const objectPos = v1.setFromMatrixPosition(el.matrixWorld);
  const cameraPos = v2.setFromMatrixPosition(camera.matrixWorld);
  const deltaCamObj = objectPos.sub(cameraPos);
  const camDir = camera.getWorldDirection(v3);
  return deltaCamObj.angleTo(camDir) > Math.PI / 2;
}

function objectZIndex(el: THREE.Object3D, camera: THREE.Camera, zIndexRange: [number, number]) {
  if (camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera) {
    const objectPos = v1.setFromMatrixPosition(el.matrixWorld);
    const cameraPos = v2.setFromMatrixPosition(camera.matrixWorld);
    const dist = objectPos.distanceTo(cameraPos);
    const A = (zIndexRange[1] - zIndexRange[0]) / (camera.far - camera.near);
    const B = zIndexRange[1] - A * camera.far;
    return Math.round(A * dist + B);
  }
  return undefined;
}

export interface SafeHtmlTransformProps {
  children: ReactNode;
  position?: [number, number, number];
  scale?: number;
  distanceFactor?: number;
  zIndexRange?: [number, number];
  style?: CSSProperties;
}

interface MountedPortal {
  el: HTMLDivElement;
  root: Root;
  outer: HTMLDivElement | null;
  inner: HTMLDivElement | null;
}

const DEFAULT_Z_INDEX_RANGE: [number, number] = [16777271, 0];
const DEFAULT_POSITION: [number, number, number] = [0, 0, 0];

export function SafeHtmlTransform({
  children,
  position = DEFAULT_POSITION,
  scale = 1,
  distanceFactor,
  zIndexRange = DEFAULT_Z_INDEX_RANGE,
  style,
}: SafeHtmlTransformProps) {
  const { gl, camera, scene, size, events } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const occlusionMeshRef = useRef<THREE.Mesh>(null);
  const isMeshSizeSetRef = useRef(false);
  const visibleRef = useRef(true);
  const mountedRef = useRef<MountedPortal | null>(null);

  const target = (events.connected as HTMLElement | null) || gl.domElement.parentElement;

  const outerStyle = useMemo<CSSProperties>(
    () => ({
      position: 'absolute',
      top: 0,
      left: 0,
      width: size.width,
      height: size.height,
      transformStyle: 'preserve-3d',
      pointerEvents: 'none',
    }),
    [size.width, size.height],
  );

  const innerStyle = useMemo<CSSProperties>(
    () => ({
      position: 'absolute',
      pointerEvents: 'none',
    }),
    [],
  );

  const occlusionMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        fragmentShader: /* glsl */ `
          void main() {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
          }
        `,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      occlusionMaterial.dispose();
    };
  }, [occlusionMaterial]);

  const zMax = zIndexRange[0];
  const zMin = zIndexRange[1];

  useEffect(() => {
    if (!target) return;

    scene.updateMatrixWorld();
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;overflow:hidden;';
    target.appendChild(el);

    const root = createRoot(el);
    const portal: MountedPortal = {
      el,
      root,
      outer: null,
      inner: null,
    };
    mountedRef.current = portal;

    return () => {
      if (mountedRef.current === portal) {
        mountedRef.current = null;
      }
      el.remove();
      // Defer root unmount so React 19 Strict Mode never synchronously unmounts
      // a nested root while the parent tree is still committing.
      window.setTimeout(() => {
        root.unmount();
      }, 0);
    };
  }, [target, scene]);

  useEffect(() => {
    const portal = mountedRef.current;
    if (!portal) return;

    isMeshSizeSetRef.current = false;
    portal.root.render(
      <div
        ref={(node) => {
          portal.outer = node;
        }}
        style={outerStyle}
      >
        <div
          ref={(node) => {
            portal.inner = node;
          }}
          style={innerStyle}
        >
          <div style={style}>{children}</div>
        </div>
      </div>,
    );
  }, [target, scene, children, outerStyle, innerStyle, style]);

  useFrame(() => {
    const group = groupRef.current;
    const portal = mountedRef.current;
    if (!group || !portal) return;

    camera.updateMatrixWorld();
    group.updateWorldMatrix(true, false);

    const isBehind = isObjectBehindCamera(group, camera);
    const prevVisible = visibleRef.current;
    visibleRef.current = !isBehind;
    if (prevVisible !== visibleRef.current) {
      portal.el.style.display = visibleRef.current ? 'block' : 'none';
    }

    const halfRange = Math.floor(zMax / 2);
    const zRange: [number, number] = [halfRange - 1, zMin];
    const zIdx = objectZIndex(group, camera, zRange);
    if (zIdx !== undefined) {
      portal.el.style.zIndex = `${zIdx}`;
    }

    const widthHalf = size.width / 2;
    const heightHalf = size.height / 2;
    const fov = (camera.projectionMatrix.elements[5] ?? 1) * heightHalf;
    const isOrtho = camera instanceof THREE.OrthographicCamera;
    const cameraMatrix = getCameraCSSMatrix(camera.matrixWorldInverse);
    const cameraTransform = isOrtho
      ? `scale(${fov})translate(${epsilon(-(camera.right + camera.left) / 2)}px,${epsilon((camera.top + camera.bottom) / 2)}px)`
      : `translateZ(${fov}px)`;

    portal.el.style.width = `${size.width}px`;
    portal.el.style.height = `${size.height}px`;
    portal.el.style.perspective = isOrtho ? '' : `${fov}px`;

    if (portal.outer && portal.inner) {
      portal.outer.style.transform = `${cameraTransform}${cameraMatrix}translate(${widthHalf}px,${heightHalf}px)`;
      portal.inner.style.transform = getObjectCSSMatrix(
        group.matrixWorld,
        1 / ((distanceFactor || 10) / 400),
      );
    }

    const occlusionMesh = occlusionMeshRef.current;
    if (occlusionMesh && !isMeshSizeSetRef.current && portal.outer) {
      const innerEl = portal.outer.children[0] as HTMLElement | undefined;
      if (innerEl && innerEl.clientWidth && innerEl.clientHeight) {
        if (isOrtho) {
          occlusionMesh.scale.setScalar(1 / scale);
        } else {
          const ratio = (distanceFactor || 10) / 400;
          occlusionMesh.scale.set(innerEl.clientWidth * ratio, innerEl.clientHeight * ratio, 1);
        }
        isMeshSizeSetRef.current = true;
      }
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <mesh ref={occlusionMeshRef} material={occlusionMaterial}>
        <planeGeometry />
      </mesh>
    </group>
  );
}
