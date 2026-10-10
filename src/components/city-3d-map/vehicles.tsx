import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CarProps {
  color?: THREE.ColorRepresentation;
  speedRef?: React.MutableRefObject<number>;
  brakeLightRef?: React.MutableRefObject<boolean>;
}

// Module-level shared geometries & materials
const _wheelGeo = new THREE.CylinderGeometry(1, 1, 1, 16);
const _hubGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
const _tireMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.85, metalness: 0.2 });
const _hubMat = new THREE.MeshStandardMaterial({ color: '#ccc', metalness: 0.9, roughness: 0.15 });

const _glassMat = new THREE.MeshStandardMaterial({
  color: '#0a0a14',
  metalness: 0.8,
  roughness: 0.1,
  transparent: true,
  opacity: 0.65,
});

const _headlightMat = new THREE.MeshStandardMaterial({
  color: '#fffbe6',
  emissive: '#fffbe6',
  emissiveIntensity: 0.6,
  toneMapped: false,
});

const _darkTrimMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.8 });
const _metalTrimMat = new THREE.MeshStandardMaterial({ color: '#333333', metalness: 0.7, roughness: 0.3 });

// Car shared geometries
const _carLowerBodyGeo = new THREE.BoxGeometry(1.85, 0.5, 4.3);
const _carUpperCabinGeo = new THREE.BoxGeometry(1.6, 0.6, 2.2);
const _carRoofGeo = new THREE.BoxGeometry(1.45, 0.08, 1.8);
const _carWindshieldGeo = new THREE.BoxGeometry(1.45, 0.52, 0.05);
const _carRearWinGeo = new THREE.BoxGeometry(1.45, 0.46, 0.05);
const _carSideWinGeo = new THREE.BoxGeometry(0.05, 0.42, 1.8);
const _carHeadlightGeo = new THREE.BoxGeometry(0.35, 0.15, 0.05);
const _carBrakelightGeo = new THREE.BoxGeometry(0.3, 0.13, 0.05);

// Motorcycle shared geometries
const _motoBodyGeo = new THREE.BoxGeometry(0.4, 0.35, 1.4);
const _motoSeatGeo = new THREE.BoxGeometry(0.35, 0.15, 0.6);
const _motoTankGeo = new THREE.BoxGeometry(0.35, 0.2, 0.5);
const _motoHandleGeo = new THREE.BoxGeometry(0.6, 0.06, 0.06);
const _motoHeadlightGeo = new THREE.SphereGeometry(0.1, 8, 8);
const _motoBrakelightGeo = new THREE.BoxGeometry(0.12, 0.08, 0.05);

// Bus shared geometries
const _busBodyGeo = new THREE.BoxGeometry(2.5, 1.8, 10.5);
const _busRoofGeo = new THREE.BoxGeometry(2.3, 0.1, 10.3);
const _busWindshieldGeo = new THREE.BoxGeometry(2.2, 1.2, 0.05);
const _busSideWinGeo = new THREE.BoxGeometry(0.05, 0.7, 1.0);
const _busHeadlightGeo = new THREE.BoxGeometry(0.35, 0.2, 0.05);
const _busBrakelightGeo = new THREE.BoxGeometry(0.4, 0.18, 0.05);

export const Car = React.memo(function Car({ color = '#2980b9', speedRef, brakeLightRef }: CarProps) {
  const wheelGroupRefs = useRef<THREE.Group[]>([]);
  const brakeMats = useRef<THREE.MeshStandardMaterial[]>([]);
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness: 0.6,
    roughness: 0.35,
  }), [color]);

  const WR = 0.36;

  useFrame((_, delta) => {
    const speed = speedRef?.current ?? 0;
    const braking = brakeLightRef?.current ?? false;
    const spinAngle = (speed * delta) / WR;

    for (const wg of wheelGroupRefs.current) {
      if (wg) wg.rotation.x -= spinAngle;
    }

    const emissive = braking ? 1.8 : 0.15;
    const col = braking ? 0xff0000 : 0x660000;
    for (const mat of brakeMats.current) {
      if (mat) {
        mat.emissiveIntensity = emissive;
        mat.emissive.setHex(col);
        mat.color.setHex(col);
      }
    }
  });

  return (
    <group>
      <mesh position={[0, WR + 0.25, 0]} geometry={_carLowerBodyGeo} material={bodyMat} castShadow receiveShadow />
      <mesh position={[0, WR + 0.7, -0.15]} geometry={_carUpperCabinGeo} material={bodyMat} castShadow receiveShadow />
      <mesh position={[0, WR + 1.05, -0.15]} geometry={_carRoofGeo} material={bodyMat} castShadow />
      <mesh position={[0, WR + 0.73, 0.95]} geometry={_carWindshieldGeo} material={_glassMat} />
      <mesh position={[0, WR + 0.73, -1.25]} geometry={_carRearWinGeo} material={_glassMat} />

      {[0.83, -0.83].map((x, i) => (
        <mesh key={i} position={[x, WR + 0.73, -0.15]} geometry={_carSideWinGeo} material={_glassMat} />
      ))}

      {[0.6, -0.6].map((x, i) => (
        <mesh key={i} position={[x, WR + 0.38, 2.16]} geometry={_carHeadlightGeo} material={_headlightMat} />
      ))}

      {[0.55, -0.55].map((x, i) => (
        <mesh key={i} position={[x, WR + 0.38, -2.16]} geometry={_carBrakelightGeo}>
          <meshStandardMaterial
            ref={(m) => { if (m) brakeMats.current[i] = m; }}
            color="#660000"
            emissive="#220000"
            emissiveIntensity={0.15}
            toneMapped={false}
          />
        </mesh>
      ))}

      {[
        [0.95, WR, 1.35], [-0.95, WR, 1.35],
        [0.95, WR, -1.35], [-0.95, WR, -1.35],
      ].map((pos, i) => (
        <group
          key={i}
          ref={(el) => { if (el) wheelGroupRefs.current[i] = el; }}
          position={pos as [number, number, number]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <mesh geometry={_wheelGeo} scale={[WR, 0.22, WR]} castShadow material={_tireMat} />
          <mesh geometry={_hubGeo} scale={[WR * 0.44, 0.04, WR * 0.44]} position={[0.12, 0, 0]} material={_hubMat} />
        </group>
      ))}
    </group>
  );
});

export const Motorcycle = React.memo(function Motorcycle({ color = '#c0392b', speedRef, brakeLightRef }: CarProps) {
  const wheelGroupRefs = useRef<THREE.Group[]>([]);
  const brakeMat = useRef<THREE.MeshStandardMaterial>(null);
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({
    color,
    metalness: 0.5,
    roughness: 0.3,
  }), [color]);

  const WR = 0.28;

  useFrame((_, delta) => {
    const speed = speedRef?.current ?? 0;
    const braking = brakeLightRef?.current ?? false;
    const spinAngle = (speed * delta) / WR;
    for (const wg of wheelGroupRefs.current) {
      if (wg) wg.rotation.x -= spinAngle;
    }
    if (brakeMat.current) {
      brakeMat.current.emissiveIntensity = braking ? 1.2 : 0.15;
      brakeMat.current.emissive.setHex(braking ? 0xff0000 : 0x220000);
      brakeMat.current.color.setHex(braking ? 0xff0000 : 0x660000);
    }
  });

  return (
    <group>
      <mesh position={[0, WR + 0.22, 0]} geometry={_motoBodyGeo} material={bodyMat} castShadow />
      <mesh position={[0, WR + 0.44, -0.3]} geometry={_motoSeatGeo} material={_darkTrimMat} castShadow />
      <mesh position={[0, WR + 0.44, 0.3]} geometry={_motoTankGeo} material={bodyMat} castShadow />
      <mesh position={[0, WR + 0.58, 0.75]} geometry={_motoHandleGeo} material={_metalTrimMat} castShadow />
      <mesh position={[0, WR + 0.52, 0.96]} geometry={_motoHeadlightGeo} material={_headlightMat} />

      <mesh position={[0, WR + 0.32, -0.76]} geometry={_motoBrakelightGeo}>
        <meshStandardMaterial
          ref={brakeMat}
          color="#660000"
          emissive="#220000"
          emissiveIntensity={0.15}
          toneMapped={false}
        />
      </mesh>

      {[[0, WR, 0.85], [0, WR, -0.85]].map((pos, i) => (
        <group
          key={i}
          ref={(el) => { if (el) wheelGroupRefs.current[i] = el; }}
          position={pos as [number, number, number]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <mesh geometry={_wheelGeo} scale={[WR, 0.15, WR]} castShadow material={_tireMat} />
        </group>
      ))}
    </group>
  );
});

export const Bus = React.memo(function Bus({ color = '#27ae60', speedRef, brakeLightRef }: CarProps) {
  const wheelGroupRefs = useRef<THREE.Group[]>([]);
  const brakeMats = useRef<THREE.MeshStandardMaterial[]>([]);
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({
    color,
    metalness: 0.4,
    roughness: 0.4,
  }), [color]);

  const WR = 0.5;

  useFrame((_, delta) => {
    const speed = speedRef?.current ?? 0;
    const braking = brakeLightRef?.current ?? false;
    const spinAngle = (speed * delta) / WR;
    for (const wg of wheelGroupRefs.current) {
      if (wg) wg.rotation.x -= spinAngle;
    }
    const emissive = braking ? 1.8 : 0.15;
    const col = braking ? 0xff0000 : 0x660000;
    for (const mat of brakeMats.current) {
      if (mat) {
        mat.emissiveIntensity = emissive;
        mat.emissive.setHex(col);
        mat.color.setHex(col);
      }
    }
  });

  return (
    <group>
      <mesh position={[0, WR + 0.9, 0]} geometry={_busBodyGeo} material={bodyMat} castShadow receiveShadow />
      <mesh position={[0, WR + 1.85, 0]} geometry={_busRoofGeo} material={_darkTrimMat} castShadow />

      <mesh position={[0, WR + 1.1, 5.28]} geometry={_busWindshieldGeo} material={_glassMat} />

      {[-3.5, -2, -0.5, 1, 2.5, 4].map((z, i) => (
        [1.28, -1.28].map((x, j) => (
          <mesh key={`${i}-${j}`} position={[x, WR + 1.1, z]} geometry={_busSideWinGeo} material={_glassMat} />
        ))
      ))}

      {[0.8, -0.8].map((x, i) => (
        <mesh key={i} position={[x, WR + 0.5, 5.28]} geometry={_busHeadlightGeo} material={_headlightMat} />
      ))}

      {[0.7, -0.7].map((x, i) => (
        <mesh key={i} position={[x, WR + 0.7, -5.28]} geometry={_busBrakelightGeo}>
          <meshStandardMaterial
            ref={(m) => { if (m) brakeMats.current[i] = m; }}
            color="#660000"
            emissive="#220000"
            emissiveIntensity={0.15}
            toneMapped={false}
          />
        </mesh>
      ))}

      {[
        [1.15, WR, 3.2], [-1.15, WR, 3.2],
        [1.15, WR, -3.2], [-1.15, WR, -3.2],
      ].map((pos, i) => (
        <group
          key={i}
          ref={(el) => { if (el) wheelGroupRefs.current[i] = el; }}
          position={pos as [number, number, number]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <mesh geometry={_wheelGeo} scale={[WR, 0.3, WR]} castShadow material={_tireMat} />
          <mesh geometry={_hubGeo} scale={[WR * 0.4, 0.04, WR * 0.4]} position={[0.16, 0, 0]} material={_hubMat} />
        </group>
      ))}
    </group>
  );
});
