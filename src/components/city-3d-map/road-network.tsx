import React, { useMemo, useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';
import {
  ROAD_WIDTH, ROAD_LENGTH, LANE_WIDTH, SIDEWALK_WIDTH, CURB_HEIGHT,
  BLOCK_SIZE, CITY_BLOCKS_X, CITY_BLOCKS_Z,
} from './constants';

/* ============================================================
   SHARED PROCEDURAL TEXTURES & MATERIALS
   ============================================================ */

let _cachedWindowTexture: THREE.CanvasTexture | null = null;
function getWindowTexture(): THREE.CanvasTexture {
  if (_cachedWindowTexture) return _cachedWindowTexture;
  if (typeof document === 'undefined') return new THREE.CanvasTexture({} as HTMLCanvasElement);

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1c2430';
  ctx.fillRect(0, 0, 128, 128);

  const cols = 4;
  const rows = 4;
  const padX = 7;
  const padY = 7;
  const winW = (128 - padX * (cols + 1)) / cols;
  const winH = (128 - padY * (rows + 1)) / rows;

  const palette = [
    '#ffeaa7', '#fdcb6e', '#74b9ff', '#81ecec',
    '#dfe6e9', '#2d3436', '#2d3436', '#1e272e',
  ];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = padX + c * (winW + padX);
      const y = padY + r * (winH + padY);

      ctx.fillStyle = '#0f141c';
      ctx.fillRect(x - 1, y - 1, winW + 2, winH + 2);

      const color = palette[(r * 5 + c * 3 + (r * c)) % palette.length];
      ctx.fillStyle = color;
      ctx.fillRect(x, y, winW, winH);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  _cachedWindowTexture = texture;
  return texture;
}

// Module-level shared geometries & materials
const _groundGeo = new THREE.PlaneGeometry(1200, 1200);
const _groundMat = new THREE.MeshStandardMaterial({ color: '#1a2416', roughness: 1 });

const _dashGeo = new THREE.PlaneGeometry(0.15, 2.5);
const _dashMat = new THREE.MeshStandardMaterial({ color: '#f5e642', roughness: 0.6 });

const _roadMat = new THREE.MeshStandardMaterial({ color: '#1e222a', roughness: 0.95, metalness: 0.05 });
const _curbMat = new THREE.MeshStandardMaterial({ color: '#7a828e', roughness: 0.8 });
const _whiteMarkingMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
const _waterMat = new THREE.MeshStandardMaterial({ color: '#0d3846', roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.85 });

const _poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 7, 6);
const _armGeo = new THREE.BoxGeometry(1.2, 0.08, 0.08);
const _headGeo = new THREE.BoxGeometry(0.4, 0.15, 0.25);
const _metalMat = new THREE.MeshStandardMaterial({ color: '#2a2a2a', metalness: 0.6, roughness: 0.4 });
const _lampMat = new THREE.MeshStandardMaterial({ color: '#fff8e0', emissive: '#fff8e0', emissiveIntensity: 0.4 });

const _palmTrunkGeo = new THREE.CylinderGeometry(0.18, 0.25, 4.5, 6);
const _palmFrondGeo = new THREE.ConeGeometry(1.8, 1.6, 6);
const _woodMat = new THREE.MeshStandardMaterial({ color: '#5a3d22', roughness: 0.9 });
const _palmMat = new THREE.MeshStandardMaterial({ color: '#2d6a2d', roughness: 0.85, side: THREE.DoubleSide });

const _broadTrunkGeo = new THREE.CylinderGeometry(0.2, 0.28, 3, 6);
const _broadCanopyGeo = new THREE.SphereGeometry(1.5, 8, 6);
const _broadLeafMat = new THREE.MeshStandardMaterial({ color: '#255825', roughness: 0.9 });

const _doorGeo = new THREE.PlaneGeometry(1.6, 2.0);
const _doorMat = new THREE.MeshStandardMaterial({ color: '#d8c8a0', emissive: '#c8a868', emissiveIntensity: 0.1, roughness: 0.4 });

/* ============================================================
   GROUND & WATERWAYS
   ============================================================ */

function Ground() {
  return (
    <mesh
      geometry={_groundGeo}
      material={_groundMat}
      position={[0, -0.05, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    />
  );
}

function Backwater() {
  const canalZ = BLOCK_SIZE * CITY_BLOCKS_Z + ROAD_WIDTH + 15;
  return (
    <group position={[0, 0, canalZ]}>
      <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={_waterMat}>
        <planeGeometry args={[1000, 60]} />
      </mesh>
      <mesh position={[0, 0.1, 33]} receiveShadow>
        <boxGeometry args={[1000, 0.4, 10]} />
        <meshStandardMaterial color="#2d3a22" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.3, -30]} receiveShadow castShadow>
        <boxGeometry args={[1000, 0.8, 4]} />
        <meshStandardMaterial color="#555a60" roughness={0.8} />
      </mesh>
    </group>
  );
}

function WestCanal() {
  const canalX = -(BLOCK_SIZE * CITY_BLOCKS_X + ROAD_WIDTH + 15);
  return (
    <group position={[canalX, 0, 0]}>
      <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={_waterMat}>
        <planeGeometry args={[50, 800]} />
      </mesh>
      <mesh position={[-30, 0.3, 0]} receiveShadow castShadow>
        <boxGeometry args={[4, 0.8, 800]} />
        <meshStandardMaterial color="#555a60" roughness={0.8} />
      </mesh>
      <mesh position={[33, 0.1, 0]} receiveShadow>
        <boxGeometry args={[10, 0.4, 800]} />
        <meshStandardMaterial color="#2d3a22" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Bridge() {
  const bridgeZ = BLOCK_SIZE * CITY_BLOCKS_Z + ROAD_WIDTH + 15;
  return (
    <group position={[0, 0, bridgeZ]}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[ROAD_WIDTH + 2, 1, 65]} />
        <meshStandardMaterial color="#4a4a44" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[ROAD_WIDTH / 2, 1.4, 0]} castShadow>
        <boxGeometry args={[0.3, 1.2, 65]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[-ROAD_WIDTH / 2, 1.4, 0]} castShadow>
        <boxGeometry args={[0.3, 1.2, 65]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.6} metalness={0.4} />
      </mesh>
      {[-25, -8, 10, 28].map((z, i) => (
        <mesh key={i} position={[0, -2, z]} castShadow>
          <cylinderGeometry args={[0.8, 1.0, 6, 8]} />
          <meshStandardMaterial color="#5a5a50" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/* ============================================================
   ROADS & MARKINGS (Instanced)
   ============================================================ */

function RoadSegment({ axis, x, z, length }: { axis: 'ns' | 'ew'; x: number; z: number; length: number }) {
  if (axis === 'ns') {
    return (
      <mesh position={[x, 0.01, z]} receiveShadow material={_roadMat}>
        <planeGeometry args={[ROAD_WIDTH, length]} />
      </mesh>
    );
  }
  return (
    <mesh position={[x, 0.01, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={_roadMat}>
      <planeGeometry args={[length, ROAD_WIDTH]} />
    </mesh>
  );
}

function SidewalkSegment({ axis, x, z, length }: { axis: 'ns' | 'ew'; x: number; z: number; length: number }) {
  const sw = SIDEWALK_WIDTH;
  const halfRoad = ROAD_WIDTH / 2;
  if (axis === 'ns') {
    return (
      <group>
        <mesh position={[x + halfRoad + sw / 2, CURB_HEIGHT / 2, z]} receiveShadow castShadow material={_curbMat}>
          <boxGeometry args={[sw, CURB_HEIGHT, length]} />
        </mesh>
        <mesh position={[x - halfRoad - sw / 2, CURB_HEIGHT / 2, z]} receiveShadow castShadow material={_curbMat}>
          <boxGeometry args={[sw, CURB_HEIGHT, length]} />
        </mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh position={[x, CURB_HEIGHT / 2, z + halfRoad + sw / 2]} receiveShadow castShadow material={_curbMat}>
        <boxGeometry args={[length, CURB_HEIGHT, sw]} />
      </mesh>
      <mesh position={[x, CURB_HEIGHT / 2, z - halfRoad - sw / 2]} receiveShadow castShadow material={_curbMat}>
        <boxGeometry args={[length, CURB_HEIGHT, sw]} />
      </mesh>
    </group>
  );
}

function RoadCenterLines() {
  const dashes = useMemo(() => {
    const arr: { pos: [number, number, number]; rotY: number }[] = [];
    const dashLen = 2.5, gap = 2.5, total = dashLen + gap;

    const addDashes = (axis: 'ns' | 'ew', x: number, z: number, length: number) => {
      const half = length / 2;
      const count = Math.floor(length / total);
      for (let i = 0; i < count; i++) {
        const d = -half + i * total + dashLen / 2;
        if (axis === 'ns') {
          if (Math.abs(z + d) > ROAD_WIDTH / 2 + 1) {
            arr.push({ pos: [x, 0.02, z + d], rotY: 0 });
          }
        } else {
          if (Math.abs(x + d) > ROAD_WIDTH / 2 + 1) {
            arr.push({ pos: [x + d, 0.02, z], rotY: Math.PI / 2 });
          }
        }
      }
    };

    addDashes('ns', 0, 0, ROAD_LENGTH * 2);
    addDashes('ew', 0, 0, ROAD_LENGTH * 2);

    for (let bx = 1; bx <= CITY_BLOCKS_X; bx++) {
      const x = bx * BLOCK_SIZE;
      if (x < ROAD_LENGTH) {
        addDashes('ns', x, 0, ROAD_LENGTH * 2);
        addDashes('ns', -x, 0, ROAD_LENGTH * 2);
      }
    }
    for (let bz = 1; bz <= CITY_BLOCKS_Z; bz++) {
      const z = bz * BLOCK_SIZE;
      if (z < ROAD_LENGTH) {
        addDashes('ew', 0, z, ROAD_LENGTH * 2);
        addDashes('ew', 0, -z, ROAD_LENGTH * 2);
      }
    }

    return arr;
  }, []);

  const meshRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    dashes.forEach((d, i) => {
      dummy.position.set(d.pos[0], d.pos[1], d.pos[2]);
      dummy.rotation.set(-Math.PI / 2, 0, d.rotY);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [dashes]);

  return <instancedMesh ref={meshRef} args={[_dashGeo, _dashMat, dashes.length]} />;
}

function StopLines() {
  const offset = ROAD_WIDTH / 2 + 0.3;
  return (
    <group>
      <mesh position={[LANE_WIDTH / 2, 0.02, offset]} rotation={[-Math.PI / 2, 0, 0]} material={_whiteMarkingMat}>
        <planeGeometry args={[LANE_WIDTH, 0.3]} />
      </mesh>
      <mesh position={[-LANE_WIDTH / 2, 0.02, -offset]} rotation={[-Math.PI / 2, 0, 0]} material={_whiteMarkingMat}>
        <planeGeometry args={[LANE_WIDTH, 0.3]} />
      </mesh>
      <mesh position={[-offset, 0.02, LANE_WIDTH / 2]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} material={_whiteMarkingMat}>
        <planeGeometry args={[LANE_WIDTH, 0.3]} />
      </mesh>
      <mesh position={[offset, 0.02, -LANE_WIDTH / 2]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} material={_whiteMarkingMat}>
        <planeGeometry args={[LANE_WIDTH, 0.3]} />
      </mesh>
    </group>
  );
}

function PedestrianCrossings() {
  const stripes: { pos: [number, number, number]; rot: number; w: number; h: number }[] = [];
  const sw = 0.4, gap = 0.3, depth = 3.5;
  const offset = ROAD_WIDTH / 2 + depth / 2 + 0.5;
  for (let i = 0; i < 9; i++) {
    const x = -ROAD_WIDTH / 2 + 0.5 + i * (sw + gap);
    stripes.push({ pos: [x, 0.02, -offset], rot: 0, w: sw, h: depth });
    stripes.push({ pos: [x, 0.02, offset], rot: 0, w: sw, h: depth });
  }
  for (let i = 0; i < 9; i++) {
    const z = -ROAD_WIDTH / 2 + 0.5 + i * (sw + gap);
    stripes.push({ pos: [offset, 0.02, z], rot: Math.PI / 2, w: sw, h: depth });
    stripes.push({ pos: [-offset, 0.02, z], rot: Math.PI / 2, w: sw, h: depth });
  }
  return (
    <group>
      {stripes.map((s, i) => (
        <mesh key={i} position={s.pos} rotation={[-Math.PI / 2, 0, s.rot]} material={_whiteMarkingMat}>
          <planeGeometry args={[s.w, s.h]} />
        </mesh>
      ))}
    </group>
  );
}

function GridStreets() {
  const segments = useMemo(() => {
    const arr: { axis: 'ns' | 'ew'; x: number; z: number; length: number }[] = [];
    const halfExtent = ROAD_LENGTH;
    for (let bx = 1; bx <= CITY_BLOCKS_X; bx++) {
      const x = bx * BLOCK_SIZE;
      if (x >= ROAD_LENGTH) break;
      arr.push({ axis: 'ns', x, z: 0, length: halfExtent * 2 });
      arr.push({ axis: 'ns', x: -x, z: 0, length: halfExtent * 2 });
    }
    for (let bz = 1; bz <= CITY_BLOCKS_Z; bz++) {
      const z = bz * BLOCK_SIZE;
      if (z >= ROAD_LENGTH) break;
      arr.push({ axis: 'ew', x: 0, z, length: halfExtent * 2 });
      arr.push({ axis: 'ew', x: 0, z: -z, length: halfExtent * 2 });
    }
    return arr;
  }, []);

  return (
    <group>
      {segments.map((s, i) => (
        <group key={i}>
          <RoadSegment axis={s.axis} x={s.x} z={s.z} length={s.length} />
          <SidewalkSegment axis={s.axis} x={s.x} z={s.z} length={s.length} />
        </group>
      ))}
    </group>
  );
}

/* ============================================================
   BUILDINGS (Procedural Window Texture)
   ============================================================ */

type BuildingType = 'normal' | 'colonial' | 'glass' | 'godown';

const BUILDING_COLORS = [
  '#c4956a', '#b8a88a', '#a09080', '#c4a070', '#b0a090',
  '#d4c0a0', '#a89878', '#c0b098', '#9a8870', '#d0c4a8',
  '#8a7860', '#bca888', '#c8b898', '#a09880',
];
const COLONIAL_COLORS = ['#e8dcc8', '#d8c8b0', '#c8b8a0', '#f0e8d8', '#d0c0a8'];
const GLASS_COLORS = ['#3a7a9a', '#2d6888', '#4a8eaa', '#356e8c'];

function pickType(): BuildingType {
  const r = Math.random();
  if (r < 0.50) return 'normal';
  if (r < 0.70) return 'colonial';
  if (r < 0.88) return 'glass';
  return 'godown';
}

function pickColor(type: BuildingType): string {
  if (type === 'colonial') return COLONIAL_COLORS[Math.floor(Math.random() * COLONIAL_COLORS.length)];
  if (type === 'glass') return GLASS_COLORS[Math.floor(Math.random() * GLASS_COLORS.length)];
  return BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)];
}

interface BuildingItem {
  pos: [number, number, number];
  w: number;
  d: number;
  h: number;
  color: string;
  type: BuildingType;
}

function SingleBuilding({ pos, w, d, h, color, type }: BuildingItem) {
  const mat = useMemo(() => {
    const tex = getWindowTexture().clone();
    tex.repeat.set(Math.max(1, Math.round(w / 3.5)), Math.max(1, Math.round(h / 3.5)));
    tex.needsUpdate = true;

    return new THREE.MeshStandardMaterial({
      color: type === 'glass' ? '#6aa0b8' : color,
      map: tex,
      roughness: type === 'glass' ? 0.2 : 0.8,
      metalness: type === 'glass' ? 0.6 : 0.05,
    });
  }, [w, h, color, type]);

  return (
    <group position={pos}>
      <mesh position={[0, h / 2, 0]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
      </mesh>

      {type === 'colonial' && (
        <mesh position={[0, h + 0.5, 0]} castShadow>
          <boxGeometry args={[w + 0.8, 1.0, d + 0.8]} />
          <meshStandardMaterial color="#7a3a2a" roughness={0.8} />
        </mesh>
      )}
      {type === 'normal' && (
        <mesh position={[0, h + 0.15, 0]} castShadow>
          <boxGeometry args={[w + 0.3, 0.4, d + 0.3]} />
          <meshStandardMaterial color="#4a4035" roughness={0.8} />
        </mesh>
      )}
      {type === 'godown' && (
        <mesh position={[0, h + 0.4, 0]} castShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[w * 0.55, w * 0.6, 1.2, 8, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color="#5a4a3a" roughness={0.85} />
        </mesh>
      )}

      <mesh position={[0, 1.0, d / 2 + 0.02]} geometry={_doorGeo} material={_doorMat} />
    </group>
  );
}

function CityBuildings() {
  const buildings = useMemo(() => {
    const list: BuildingItem[] = [];
    const halfRoad = ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 3;

    // Corner towers
    const corners = [
      { x: halfRoad, z: -halfRoad, w: 16, d: 18, h: 32, type: 'glass' as BuildingType },
      { x: -halfRoad, z: -halfRoad, w: 14, d: 16, h: 22, type: 'colonial' as BuildingType },
      { x: halfRoad, z: halfRoad, w: 15, d: 17, h: 34, type: 'glass' as BuildingType },
      { x: -halfRoad, z: halfRoad, w: 17, d: 15, h: 20, type: 'colonial' as BuildingType },
    ];
    for (const c of corners) {
      list.push({ pos: [c.x, 0, c.z], w: c.w, d: c.d, h: c.h, color: pickColor(c.type), type: c.type });
    }

    // Grid block buildings
    for (let bx = 0; bx < CITY_BLOCKS_X; bx++) {
      for (let bz = 0; bz < CITY_BLOCKS_Z; bz++) {
        const blockCenterX = (bx - (CITY_BLOCKS_X - 1) / 2) * BLOCK_SIZE;
        const blockCenterZ = (bz - (CITY_BLOCKS_Z - 1) / 2) * BLOCK_SIZE;
        if (Math.abs(blockCenterX) < 5 && Math.abs(blockCenterZ) < 5) continue;

        const blockSizeInner = BLOCK_SIZE - ROAD_WIDTH - SIDEWALK_WIDTH * 2 - 6;
        const count = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          const offsetX = (Math.random() - 0.5) * blockSizeInner * 0.65;
          const offsetZ = (Math.random() - 0.5) * blockSizeInner * 0.65;
          const type = pickType();
          const w = 7 + Math.random() * 8;
          const dep = 7 + Math.random() * 8;
          const h = type === 'glass' ? 16 + Math.random() * 24 : 8 + Math.random() * 16;
          list.push({ pos: [blockCenterX + offsetX, 0, blockCenterZ + offsetZ], w, d: dep, h, color: pickColor(type), type });
        }
      }
    }

    // Avenues leading away from intersection
    for (let dist = BLOCK_SIZE * 1.5; dist < 220; dist += 32) {
      const sides: [number, number][] = [
        [ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 6, dist],
        [-(ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 6), dist],
        [ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 6, -dist],
        [-(ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 6), -dist],
      ];
      for (const [x, z] of sides) {
        const type = pickType();
        list.push({ pos: [x, 0, z], w: 8 + Math.random() * 6, d: 8 + Math.random() * 6, h: 10 + Math.random() * 18, color: pickColor(type), type });
      }
    }

    return list;
  }, []);

  return (
    <group>
      {buildings.map((b, i) => (
        <SingleBuilding key={i} {...b} />
      ))}
    </group>
  );
}

/* ============================================================
   STREETLIGHTS (InstancedMesh)
   ============================================================ */

function Streetlights() {
  const positions = useMemo(() => {
    const arr: [number, number, number][] = [];
    const offset = ROAD_WIDTH / 2 + SIDEWALK_WIDTH / 2;
    for (let d = 25; d < 250; d += 45) {
      arr.push([offset, 0, d], [-offset, 0, d], [offset, 0, -d], [-offset, 0, -d]);
      arr.push([d, 0, offset], [-d, 0, offset], [d, 0, -offset], [-d, 0, -offset]);
    }
    arr.push([offset, 0, -offset], [-offset, 0, -offset], [offset, 0, offset], [-offset, 0, offset]);
    return arr;
  }, []);

  const poleRef = useRef<THREE.InstancedMesh>(null);
  const armRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    positions.forEach((p, i) => {
      dummy.position.set(p[0], 3.5, p[2]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poleRef.current?.setMatrixAt(i, dummy.matrix);

      dummy.position.set(p[0] + 0.6, 7, p[2]);
      dummy.updateMatrix();
      armRef.current?.setMatrixAt(i, dummy.matrix);

      dummy.position.set(p[0] + 1.1, 6.9, p[2]);
      dummy.updateMatrix();
      headRef.current?.setMatrixAt(i, dummy.matrix);
    });

    if (poleRef.current) poleRef.current.instanceMatrix.needsUpdate = true;
    if (armRef.current) armRef.current.instanceMatrix.needsUpdate = true;
    if (headRef.current) headRef.current.instanceMatrix.needsUpdate = true;
  }, [positions]);

  return (
    <group>
      <instancedMesh ref={poleRef} args={[_poleGeo, _metalMat, positions.length]} castShadow />
      <instancedMesh ref={armRef} args={[_armGeo, _metalMat, positions.length]} castShadow />
      <instancedMesh ref={headRef} args={[_headGeo, _lampMat, positions.length]} />
      {positions.slice(0, 8).map((p, i) => (
        <pointLight key={i} position={[p[0] + 1.1, 6.8, p[2]]} color="#fff8e0" intensity={10} distance={20} decay={2} />
      ))}
    </group>
  );
}

/* ============================================================
   VEGETATION (InstancedMesh)
   ============================================================ */

function Vegetation() {
  const { palms, broads } = useMemo(() => {
    const pArr: [number, number, number][] = [];
    const bArr: [number, number, number][] = [];
    const offset = ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 1.5;

    for (let d = 20; d < 220; d += 24) {
      pArr.push([offset, 0, d], [-offset, 0, -d]);
      bArr.push([-offset, 0, d], [offset, 0, -d]);
      pArr.push([d, 0, offset], [-d, 0, -offset]);
      bArr.push([-d, 0, offset], [d, 0, -offset]);
    }
    return { palms: pArr, broads: bArr };
  }, []);

  const palmTrunkRef = useRef<THREE.InstancedMesh>(null);
  const palmFrondRef = useRef<THREE.InstancedMesh>(null);
  const broadTrunkRef = useRef<THREE.InstancedMesh>(null);
  const broadCanopyRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();

    palms.forEach((p, i) => {
      dummy.position.set(p[0], 2.25, p[2]);
      dummy.rotation.set(0.04, 0, 0.02);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      palmTrunkRef.current?.setMatrixAt(i, dummy.matrix);

      dummy.position.set(p[0] + 0.15, 4.6, p[2]);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      palmFrondRef.current?.setMatrixAt(i, dummy.matrix);
    });

    broads.forEach((p, i) => {
      dummy.position.set(p[0], 1.5, p[2]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      broadTrunkRef.current?.setMatrixAt(i, dummy.matrix);

      dummy.position.set(p[0], 3.8, p[2]);
      dummy.updateMatrix();
      broadCanopyRef.current?.setMatrixAt(i, dummy.matrix);
    });

    if (palmTrunkRef.current) palmTrunkRef.current.instanceMatrix.needsUpdate = true;
    if (palmFrondRef.current) palmFrondRef.current.instanceMatrix.needsUpdate = true;
    if (broadTrunkRef.current) broadTrunkRef.current.instanceMatrix.needsUpdate = true;
    if (broadCanopyRef.current) broadCanopyRef.current.instanceMatrix.needsUpdate = true;
  }, [palms, broads]);

  return (
    <group>
      {palms.length > 0 && (
        <>
          <instancedMesh ref={palmTrunkRef} args={[_palmTrunkGeo, _woodMat, palms.length]} castShadow />
          <instancedMesh ref={palmFrondRef} args={[_palmFrondGeo, _palmMat, palms.length]} castShadow />
        </>
      )}
      {broads.length > 0 && (
        <>
          <instancedMesh ref={broadTrunkRef} args={[_broadTrunkGeo, _woodMat, broads.length]} castShadow />
          <instancedMesh ref={broadCanopyRef} args={[_broadCanopyGeo, _broadLeafMat, broads.length]} castShadow />
        </>
      )}
    </group>
  );
}

/* ============================================================
   KOCHI LANDMARKS & MONUMENTS
   ============================================================ */

function ChineseFishingNet({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 3, 0]} castShadow rotation={[0, 0, 0.08]}>
        <cylinderGeometry args={[0.1, 0.12, 7, 6]} />
        <meshStandardMaterial color="#5a3a1a" roughness={0.9} />
      </mesh>
      <mesh position={[2, 3, 0]} castShadow rotation={[0, 0, -0.06]}>
        <cylinderGeometry args={[0.1, 0.12, 7, 6]} />
        <meshStandardMaterial color="#5a3a1a" roughness={0.9} />
      </mesh>
      <mesh position={[-2, 3, 0]} castShadow rotation={[0, 0, 0.06]}>
        <cylinderGeometry args={[0.1, 0.12, 7, 6]} />
        <meshStandardMaterial color="#5a3a1a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 6, 0]} castShadow>
        <boxGeometry args={[5, 0.15, 0.15]} />
        <meshStandardMaterial color="#5a3a1a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 3.5, 1.5]} castShadow rotation={[0.4, 0, 0]}>
        <coneGeometry args={[3, 4, 8, 1, true]} />
        <meshStandardMaterial color="#8a7a5a" roughness={0.95} transparent opacity={0.4} side={THREE.DoubleSide} wireframe />
      </mesh>
    </group>
  );
}

function ChurchSpire({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 6, 0]} castShadow receiveShadow>
        <boxGeometry args={[5, 12, 5]} />
        <meshStandardMaterial color="#e8e0d0" roughness={0.8} />
      </mesh>
      <mesh position={[0, 13, 0]} castShadow>
        <boxGeometry args={[4, 3, 4]} />
        <meshStandardMaterial color="#e0d8c8" roughness={0.8} />
      </mesh>
      <mesh position={[0, 17, 0]} castShadow>
        <coneGeometry args={[2.5, 5, 4]} />
        <meshStandardMaterial color="#a8382a" roughness={0.7} />
      </mesh>
      <mesh position={[0, 20.2, 0]}>
        <boxGeometry args={[0.12, 1.2, 0.12]} />
        <meshStandardMaterial color="#d4a838" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 20.0, 0]}>
        <boxGeometry args={[0.6, 0.12, 0.12]} />
        <meshStandardMaterial color="#d4a838" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

function TempleTower({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 5, 0]} castShadow receiveShadow>
        <boxGeometry args={[6, 10, 6]} />
        <meshStandardMaterial color="#c4884a" roughness={0.85} />
      </mesh>
      {[10, 12.5, 14.5].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} castShadow>
          <boxGeometry args={[6 - i * 1.2, 1.2, 6 - i * 1.2]} />
          <meshStandardMaterial color="#a8683a" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 16.5, 0]} castShadow>
        <coneGeometry args={[1.5, 2.5, 4]} />
        <meshStandardMaterial color="#8a4828" roughness={0.7} />
      </mesh>
    </group>
  );
}

function WaterTower({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => (
        <mesh key={i} position={[x, 3, z]} castShadow rotation={[0, 0, x > 0 ? -0.1 : 0.1]}>
          <cylinderGeometry args={[0.1, 0.12, 6, 6]} />
          <meshStandardMaterial color="#4a4a3a" metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 7, 0]} castShadow>
        <cylinderGeometry args={[2, 2, 2.5, 12]} />
        <meshStandardMaterial color="#6a8a9a" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 8.3, 0]}>
        <coneGeometry args={[2, 0.8, 12]} />
        <meshStandardMaterial color="#5a7a8a" metalness={0.3} roughness={0.5} />
      </mesh>
    </group>
  );
}

function BolgattyPalace({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 4, 0]} castShadow receiveShadow>
        <boxGeometry args={[18, 8, 12]} />
        <meshStandardMaterial color="#e8d8b8" roughness={0.8} />
      </mesh>
      <mesh position={[0, 9, 0]} castShadow receiveShadow>
        <boxGeometry args={[14, 4, 10]} />
        <meshStandardMaterial color="#f0e0c8" roughness={0.8} />
      </mesh>
      <mesh position={[0, 12, 0]} castShadow>
        <boxGeometry args={[5, 6, 5]} />
        <meshStandardMaterial color="#e8d8b8" roughness={0.8} />
      </mesh>
      <mesh position={[0, 16, 0]} castShadow>
        <sphereGeometry args={[2.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#4a7a5a" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[-11, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[5, 6, 10]} />
        <meshStandardMaterial color="#e0d0b0" roughness={0.8} />
      </mesh>
      <mesh position={[11, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[5, 6, 10]} />
        <meshStandardMaterial color="#e0d0b0" roughness={0.8} />
      </mesh>
    </group>
  );
}

function MarineDrive({ position, length }: { position: [number, number, number]; length: number }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]} receiveShadow castShadow>
        <boxGeometry args={[length, 0.6, 8]} />
        <meshStandardMaterial color="#a0a0a0" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.0, 3.8]} castShadow>
        <boxGeometry args={[length, 1.0, 0.15]} />
        <meshStandardMaterial color="#3a4a5a" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.0, -3.8]} castShadow>
        <boxGeometry args={[length, 1.0, 0.15]} />
        <meshStandardMaterial color="#3a4a5a" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

function PortCrane({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[[-3, -2], [3, -2], [-3, 2], [3, 2]].map(([x, z], i) => (
        <mesh key={i} position={[x, 7, z]} castShadow>
          <boxGeometry args={[0.6, 14, 0.6]} />
          <meshStandardMaterial color="#cc8822" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 14, 0]} castShadow>
        <boxGeometry args={[7, 0.8, 5]} />
        <meshStandardMaterial color="#cc8822" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[10, 14, 0]} castShadow>
        <boxGeometry args={[16, 0.6, 1.5]} />
        <meshStandardMaterial color="#dd9933" metalness={0.4} roughness={0.5} />
      </mesh>
    </group>
  );
}

function Mosque({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 4, 0]} castShadow receiveShadow>
        <boxGeometry args={[10, 8, 8]} />
        <meshStandardMaterial color="#e8e4d0" roughness={0.8} />
      </mesh>
      <mesh position={[0, 9, 0]} castShadow>
        <sphereGeometry args={[3.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#c4a050" metalness={0.3} roughness={0.5} />
      </mesh>
      {[-6, 6].map((x, i) => (
        <mesh key={i} position={[x, 6, 0]} castShadow>
          <cylinderGeometry args={[0.6, 0.7, 12, 10]} />
          <meshStandardMaterial color="#e0dcb8" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function ClockTower({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 8, 0]} castShadow receiveShadow>
        <boxGeometry args={[4, 16, 4]} />
        <meshStandardMaterial color="#c4a888" roughness={0.85} />
      </mesh>
      <mesh position={[0, 17, 0]} castShadow>
        <cylinderGeometry args={[2.2, 2.2, 3, 8]} />
        <meshStandardMaterial color="#d4b898" roughness={0.8} />
      </mesh>
      <mesh position={[0, 19.5, 0]} castShadow>
        <coneGeometry args={[2.5, 3, 8]} />
        <meshStandardMaterial color="#7a4a2a" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Stadium({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[28, 30, 10, 24, 1, true]} />
        <meshStandardMaterial color="#c4b8a0" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 11, 0]} castShadow>
        <cylinderGeometry args={[32, 30, 1.5, 24, 1, true]} />
        <meshStandardMaterial color="#4a6a8a" metalness={0.3} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[26, 24]} />
        <meshStandardMaterial color="#2d6a2d" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Lighthouse({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 7, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 2.2, 14, 12]} />
        <meshStandardMaterial color="#e8e0d8" roughness={0.7} />
      </mesh>
      <mesh position={[0, 5, 0]} castShadow>
        <cylinderGeometry args={[1.7, 1.9, 3, 12]} />
        <meshStandardMaterial color="#c43828" roughness={0.7} />
      </mesh>
      <mesh position={[0, 10, 0]} castShadow>
        <cylinderGeometry args={[1.55, 1.65, 2, 12]} />
        <meshStandardMaterial color="#c43828" roughness={0.7} />
      </mesh>
      <mesh position={[0, 15.5, 0]} castShadow>
        <cylinderGeometry args={[1.5, 1.5, 2.5, 12]} />
        <meshStandardMaterial color="#4a6a8a" metalness={0.3} roughness={0.3} transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, 15.5, 0]}>
        <sphereGeometry args={[0.6, 8, 6]} />
        <meshStandardMaterial color="#fff8e0" emissive="#fff8e0" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0, 17.2, 0]} castShadow>
        <coneGeometry args={[1.6, 1.5, 12]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

function HillPalace({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 4, 0]} castShadow receiveShadow>
        <boxGeometry args={[16, 8, 10]} />
        <meshStandardMaterial color="#d4c8a8" roughness={0.8} />
      </mesh>
      <mesh position={[0, 8.5, 0]} castShadow>
        <boxGeometry args={[8, 2.5, 10]} />
        <meshStandardMaterial color="#e0d4b8" roughness={0.8} />
      </mesh>
      <mesh position={[-10, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[5, 6, 10]} />
        <meshStandardMaterial color="#d0c4a4" roughness={0.8} />
      </mesh>
      <mesh position={[10, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[5, 6, 10]} />
        <meshStandardMaterial color="#d0c4a4" roughness={0.8} />
      </mesh>
    </group>
  );
}

/* ============================================================
   MAIN EXPORT
   ============================================================ */

function RoadNetworkComponent() {
  const canalZ = BLOCK_SIZE * CITY_BLOCKS_Z + ROAD_WIDTH + 15;
  const netPositions = useMemo(() => {
    const arr: [number, number, number][] = [];
    for (let x = -150; x <= 150; x += 30) {
      arr.push([x, 0, canalZ + 8]);
    }
    return arr;
  }, [canalZ]);

  return (
    <group>
      <Ground />
      <Backwater />
      <WestCanal />
      <Bridge />

      {/* Main intersection roads */}
      <RoadSegment axis="ns" x={0} z={0} length={ROAD_LENGTH * 2} />
      <RoadSegment axis="ew" x={0} z={0} length={ROAD_LENGTH * 2} />
      <SidewalkSegment axis="ns" x={0} z={0} length={ROAD_LENGTH * 2} />
      <SidewalkSegment axis="ew" x={0} z={0} length={ROAD_LENGTH * 2} />

      {/* Grid street network */}
      <GridStreets />

      {/* Instanced yellow road center lines */}
      <RoadCenterLines />

      <StopLines />
      <PedestrianCrossings />

      {/* Efficient buildings with procedural windows */}
      <CityBuildings />

      {/* Instanced streetlights */}
      <Streetlights />

      {/* Instanced palm and broadleaf trees */}
      <Vegetation />

      {/* Kochi landmarks */}
      <ChurchSpire position={[-(ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 10), 0, -(BLOCK_SIZE * 1.5)]} />
      <TempleTower position={[BLOCK_SIZE * 1.5, 0, ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 12]} />
      <WaterTower position={[BLOCK_SIZE * 2, 0, -BLOCK_SIZE]} />
      <WaterTower position={[-BLOCK_SIZE * 2, 0, BLOCK_SIZE * 0.5]} />
      <BolgattyPalace position={[BLOCK_SIZE * 2.5, 0, canalZ - 15]} />
      <MarineDrive position={[-60, 0, canalZ - 8]} length={120} />
      <PortCrane position={[120, 0, canalZ - 12]} />
      <PortCrane position={[145, 0, canalZ - 12]} />
      <PortCrane position={[170, 0, canalZ - 12]} />
      <Mosque position={[-BLOCK_SIZE * 2.5, 0, -BLOCK_SIZE * 1.5]} />
      <ClockTower position={[BLOCK_SIZE * 2.5, 0, -BLOCK_SIZE * 2]} />
      <Stadium position={[-BLOCK_SIZE * 3.5, 0, BLOCK_SIZE * 3]} />
      <Lighthouse position={[-130, 0, canalZ - 10]} />
      <HillPalace position={[BLOCK_SIZE * 3.5, 0, BLOCK_SIZE * 2]} />

      {/* Chinese fishing nets along the backwater */}
      {netPositions.map((pos, i) => (
        <ChineseFishingNet key={i} position={pos} />
      ))}
    </group>
  );
}

export const RoadNetwork = React.memo(RoadNetworkComponent);
