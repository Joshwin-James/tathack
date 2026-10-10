import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AmbulanceProps {
  speedRef?: React.MutableRefObject<number>;
  brakeLightRef?: React.MutableRefObject<boolean>;
  emergencyActive?: boolean;
}

const WR = 0.42;

// Shared ambulance geometries & materials
const _ambLowerBodyGeo = new THREE.BoxGeometry(2.3, 0.7, 6.5);
const _ambCabGeo = new THREE.BoxGeometry(2.2, 1.0, 2.0);
const _ambPatientGeo = new THREE.BoxGeometry(2.3, 1.4, 3.5);
const _ambRoofGeo = new THREE.BoxGeometry(2.2, 0.08, 3.3);
const _ambWindshieldGeo = new THREE.BoxGeometry(1.9, 0.85, 0.05);
const _ambSideWinGeo = new THREE.BoxGeometry(0.05, 0.7, 1.6);
const _ambCrossGeo = new THREE.PlaneGeometry(0.55, 0.55);
const _ambCrossBarGeo = new THREE.PlaneGeometry(0.15, 0.55);
const _ambStripeGeo = new THREE.BoxGeometry(0.02, 0.25, 4.0);
const _ambBarBaseGeo = new THREE.BoxGeometry(1.6, 0.12, 0.4);
const _ambLightBoxGeo = new THREE.BoxGeometry(0.72, 0.1, 0.36);
const _ambHeadlightGeo = new THREE.BoxGeometry(0.35, 0.2, 0.05);
const _ambBrakelightGeo = new THREE.BoxGeometry(0.35, 0.18, 0.05);

const _ambWheelGeo = new THREE.CylinderGeometry(WR, WR, 0.25, 16);
const _ambHubGeo = new THREE.CylinderGeometry(WR * 0.43, WR * 0.43, 0.04, 12);
const _ambTireMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.85 });
const _ambHubMat = new THREE.MeshStandardMaterial({ color: '#ccc', metalness: 0.9, roughness: 0.15 });

const _ambBodyMat = new THREE.MeshStandardMaterial({ color: '#f8f8f8', metalness: 0.3, roughness: 0.4 });
const _ambRoofMat = new THREE.MeshStandardMaterial({ color: '#e8e8e8', metalness: 0.2, roughness: 0.5 });
const _ambGlassMat = new THREE.MeshStandardMaterial({
  color: '#0a0a14',
  metalness: 0.8,
  roughness: 0.1,
  transparent: true,
  opacity: 0.6,
});
const _ambCrossRedMat = new THREE.MeshStandardMaterial({ color: '#cc0000', emissive: '#cc0000', emissiveIntensity: 0.4, side: THREE.DoubleSide });
const _ambCrossWhiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide });
const _ambStripeMat = new THREE.MeshStandardMaterial({ color: '#cc0000', emissive: '#cc0000', emissiveIntensity: 0.2 });
const _ambDarkBaseMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5 });
const _ambHeadlightMat = new THREE.MeshStandardMaterial({ color: '#fffbe6', emissive: '#fffbe6', emissiveIntensity: 1.0, toneMapped: false });

export const Ambulance = React.memo(function Ambulance({ speedRef, brakeLightRef, emergencyActive = true }: AmbulanceProps) {
  const wheelGroupRefs = useRef<THREE.Group[]>([]);
  const redLightMat = useRef<THREE.MeshStandardMaterial>(null);
  const blueLightMat = useRef<THREE.MeshStandardMaterial>(null);
  const redGlow = useRef<THREE.PointLight>(null);
  const blueGlow = useRef<THREE.PointLight>(null);
  const brakeMats = useRef<THREE.MeshStandardMaterial[]>([]);
  const phaseRef = useRef(0);
  const emergRef = useRef(emergencyActive);
  emergRef.current = emergencyActive;

  useFrame((_, delta) => {
    const speed = speedRef?.current ?? 0;
    const braking = brakeLightRef?.current ?? false;
    const spinAngle = (speed * delta) / WR;

    for (const wg of wheelGroupRefs.current) {
      if (wg) wg.rotation.x -= spinAngle;
    }

    if (emergRef.current) {
      phaseRef.current += delta * 5;
      const t = phaseRef.current % (Math.PI * 2);
      const redOn = t < Math.PI;

      if (redLightMat.current) {
        redLightMat.current.emissiveIntensity = redOn ? 3.0 : 0.05;
        redLightMat.current.emissive.setHex(redOn ? 0xff0000 : 0x200000);
        redLightMat.current.color.setHex(redOn ? 0xff1111 : 0x400000);
      }
      if (blueLightMat.current) {
        blueLightMat.current.emissiveIntensity = redOn ? 0.05 : 3.0;
        blueLightMat.current.emissive.setHex(redOn ? 0x000020 : 0x0000ff);
        blueLightMat.current.color.setHex(redOn ? 0x000040 : 0x1111ff);
      }
      if (redGlow.current) {
        redGlow.current.intensity = redOn ? 16 : 0;
      }
      if (blueGlow.current) {
        blueGlow.current.intensity = redOn ? 0 : 16;
      }
    } else {
      if (redLightMat.current) redLightMat.current.emissiveIntensity = 0.05;
      if (blueLightMat.current) blueLightMat.current.emissiveIntensity = 0.05;
      if (redGlow.current) redGlow.current.intensity = 0;
      if (blueGlow.current) blueGlow.current.intensity = 0;
    }

    const col = braking ? 0xff0000 : 0x660000;
    const emInt = braking ? 1.8 : 0.15;
    for (const mat of brakeMats.current) {
      if (mat) {
        mat.emissiveIntensity = emInt;
        mat.emissive.setHex(col);
        mat.color.setHex(col);
      }
    }
  });

  return (
    <group>
      <mesh position={[0, WR + 0.35, 0]} geometry={_ambLowerBodyGeo} material={_ambBodyMat} castShadow receiveShadow />
      <mesh position={[0, WR + 0.8, 2.0]} geometry={_ambCabGeo} material={_ambBodyMat} castShadow receiveShadow />
      <mesh position={[0, WR + 1.05, -0.8]} geometry={_ambPatientGeo} material={_ambBodyMat} castShadow receiveShadow />
      <mesh position={[0, WR + 1.78, -0.8]} geometry={_ambRoofGeo} material={_ambRoofMat} castShadow />

      <mesh position={[1.17, WR + 1.05, -0.8]} rotation={[0, Math.PI / 2, 0]} geometry={_ambCrossGeo} material={_ambCrossRedMat} />
      <mesh position={[1.17, WR + 1.05, -0.8]} rotation={[0, Math.PI / 2, Math.PI / 2]} geometry={_ambCrossBarGeo} material={_ambCrossWhiteMat} />
      <mesh position={[1.17, WR + 0.55, 0.5]} geometry={_ambStripeGeo} material={_ambStripeMat} />

      <mesh position={[0, WR + 0.9, 3.02]} geometry={_ambWindshieldGeo} material={_ambGlassMat} />

      {[1.12, -1.12].map((x, i) => (
        <mesh key={i} position={[x, WR + 0.9, 2.0]} geometry={_ambSideWinGeo} material={_ambGlassMat} />
      ))}

      <mesh position={[0, WR + 1.88, 0.5]} geometry={_ambBarBaseGeo} material={_ambDarkBaseMat} />

      <mesh position={[-0.4, WR + 1.88, 0.5]} geometry={_ambLightBoxGeo}>
        <meshStandardMaterial
          ref={redLightMat}
          color="#ff1111"
          emissive="#ff0000"
          emissiveIntensity={3}
          toneMapped={false}
        />
      </mesh>
      <pointLight ref={redGlow} position={[-0.4, WR + 2.1, 0.5]} color="#ff0000" intensity={16} distance={15} decay={2} />

      <mesh position={[0.4, WR + 1.88, 0.5]} geometry={_ambLightBoxGeo}>
        <meshStandardMaterial
          ref={blueLightMat}
          color="#1111ff"
          emissive="#0000ff"
          emissiveIntensity={3}
          toneMapped={false}
        />
      </mesh>
      <pointLight ref={blueGlow} position={[0.4, WR + 2.1, 0.5]} color="#0000ff" intensity={0} distance={15} decay={2} />

      {[0.7, -0.7].map((x, i) => (
        <mesh key={i} position={[x, WR + 0.5, 3.3]} geometry={_ambHeadlightGeo} material={_ambHeadlightMat} />
      ))}

      {[0.65, -0.65].map((x, i) => (
        <mesh key={i} position={[x, WR + 0.6, -3.28]} geometry={_ambBrakelightGeo}>
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
        [1.1, WR, 2.0], [-1.1, WR, 2.0],
        [1.1, WR, -2.0], [-1.1, WR, -2.0],
      ].map((pos, i) => (
        <group
          key={i}
          ref={(el) => { if (el) wheelGroupRefs.current[i] = el; }}
          position={pos as [number, number, number]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <mesh geometry={_ambWheelGeo} castShadow material={_ambTireMat} />
          <mesh geometry={_ambHubGeo} position={[0.13, 0, 0]} material={_ambHubMat} />
        </group>
      ))}
    </group>
  );
});
