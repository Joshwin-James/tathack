import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SignalState } from './types';

interface TrafficSignalProps {
  position: [number, number, number];
  rotationY: number;
  state: SignalState;
  phaseRemaining?: number;
}

const _poleBaseGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.2, 12);
const _poleBaseMat = new THREE.MeshStandardMaterial({ color: '#333', roughness: 0.7, metalness: 0.3 });
const _poleShaftGeo = new THREE.CylinderGeometry(0.1, 0.12, 4.8, 10);
const _poleShaftMat = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.6, metalness: 0.4 });
const _armGeo = new THREE.BoxGeometry(1.4, 0.12, 0.12);
const _headBoxGeo = new THREE.BoxGeometry(0.35, 1.25, 0.35);
const _headBoxMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5, metalness: 0.3 });
const _lightCircleGeo = new THREE.CircleGeometry(0.12, 16);
const _hoodGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.1, 12, 1, true);
const _hoodMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5, side: THREE.DoubleSide });

/** Procedural digital 7-segment/number canvas texture for countdown */
function createDigitCanvasTexture(seconds: number, state: SignalState): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = state === 'green' ? '#00ff44' : state === 'amber' ? '#ffaa00' : '#ff2222';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 60, 60);

  ctx.font = 'bold 36px monospace';
  ctx.fillStyle = state === 'green' ? '#00ff44' : state === 'amber' ? '#ffaa00' : '#ff3333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const text = String(Math.max(0, Math.ceil(seconds))).padStart(2, '0');
  ctx.fillText(text, 32, 34);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/** A 3D traffic signal pole with 3 lights (red, amber, green) & live digital countdown display */
export const TrafficSignal = React.memo(function TrafficSignal({
  position,
  rotationY,
  state,
  phaseRemaining = 0,
}: TrafficSignalProps) {
  const redRef = useRef<THREE.MeshStandardMaterial>(null);
  const amberRef = useRef<THREE.MeshStandardMaterial>(null);
  const greenRef = useRef<THREE.MeshStandardMaterial>(null);
  const redLightRef = useRef<THREE.PointLight>(null);
  const greenLightRef = useRef<THREE.PointLight>(null);
  const amberLightRef = useRef<THREE.PointLight>(null);
  const digitMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const phaseRef = useRef(0);
  const stateRef = useRef<SignalState>(state);
  const lastSecRef = useRef<number>(-1);

  stateRef.current = state;

  useFrame((_, delta) => {
    phaseRef.current += delta;
    const s = stateRef.current;
    const amberPulse = s === 'amber' ? Math.sin(phaseRef.current * 7) * 0.5 + 0.5 : 0;

    if (redRef.current) {
      const on = s === 'red';
      redRef.current.emissiveIntensity = on ? 2.5 : 0.08;
      redRef.current.color.setHex(on ? 0xff2222 : 0x330000);
      redRef.current.emissive.setHex(on ? 0xff2222 : 0x110000);
    }
    if (amberRef.current) {
      amberRef.current.emissiveIntensity = amberPulse * 2.8;
      amberRef.current.color.setHex(s === 'amber' ? 0xff8800 : 0x221100);
      amberRef.current.emissive.setHex(s === 'amber' ? 0xff8800 : 0x110800);
    }
    if (greenRef.current) {
      const on = s === 'green';
      greenRef.current.emissiveIntensity = on ? 2.5 : 0.08;
      greenRef.current.color.setHex(on ? 0x00ff44 : 0x003300);
      greenRef.current.emissive.setHex(on ? 0x00ff44 : 0x001100);
    }

    if (redLightRef.current) redLightRef.current.intensity = s === 'red' ? 7 : 0;
    if (greenLightRef.current) greenLightRef.current.intensity = s === 'green' ? 7 : 0;
    if (amberLightRef.current) amberLightRef.current.intensity = s === 'amber' ? amberPulse * 9 : 0;

    // Update digital countdown billboard
    const currentSec = Math.ceil(phaseRemaining);
    if (digitMatRef.current && currentSec !== lastSecRef.current && typeof document !== 'undefined') {
      lastSecRef.current = currentSec;
      if (digitMatRef.current.map) {
        digitMatRef.current.map.dispose();
      }
      digitMatRef.current.map = createDigitCanvasTexture(currentSec, s);
      digitMatRef.current.needsUpdate = true;
    }
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Pole base */}
      <mesh position={[0, 0.1, 0]} geometry={_poleBaseGeo} material={_poleBaseMat} castShadow />

      {/* Pole */}
      <mesh position={[0, 2.5, 0]} geometry={_poleShaftGeo} material={_poleShaftMat} castShadow />

      {/* Arm */}
      <mesh position={[0.7, 4.7, 0]} geometry={_armGeo} material={_poleShaftMat} castShadow />

      {/* Main Signal Housing */}
      <mesh position={[1.3, 3.6, 0]} geometry={_headBoxGeo} material={_headBoxMat} castShadow />

      {/* Digital Countdown Timer Display (mounted on top of signal head) */}
      <group position={[1.3, 4.65, 0.18]}>
        <mesh position={[0, 0, -0.05]}>
          <boxGeometry args={[0.7, 0.7, 0.1]} />
          <meshStandardMaterial color="#111111" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[0.65, 0.65]} />
          <meshBasicMaterial ref={digitMatRef} color="#ffffff" />
        </mesh>
      </group>

      {/* Red light */}
      <mesh position={[1.3, 4.05, 0.18]} geometry={_lightCircleGeo}>
        <meshStandardMaterial ref={redRef} color="#ff2222" emissive="#ff2222" emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      <pointLight ref={redLightRef} position={[1.3, 4.05, 0.4]} color="#ff2222" intensity={7} distance={8} decay={2} />

      {/* Amber light */}
      <mesh position={[1.3, 3.6, 0.18]} geometry={_lightCircleGeo}>
        <meshStandardMaterial ref={amberRef} color="#221100" emissive="#110800" emissiveIntensity={0.1} toneMapped={false} />
      </mesh>
      <pointLight ref={amberLightRef} position={[1.3, 3.6, 0.4]} color="#ff8800" intensity={0} distance={8} decay={2} />

      {/* Green light */}
      <mesh position={[1.3, 3.15, 0.18]} geometry={_lightCircleGeo}>
        <meshStandardMaterial ref={greenRef} color="#00ff44" emissive="#00ff44" emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      <pointLight ref={greenLightRef} position={[1.3, 3.15, 0.4]} color="#00ff44" intensity={7} distance={8} decay={2} />

      {/* Visors */}
      {[4.05, 3.6, 3.15].map((y, i) => (
        <mesh key={i} position={[1.3, y, 0.22]} rotation={[Math.PI / 2, 0, 0]} geometry={_hoodGeo} material={_hoodMat} />
      ))}
    </group>
  );
});
