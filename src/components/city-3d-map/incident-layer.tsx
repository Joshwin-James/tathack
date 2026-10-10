import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Incident } from '@/data/kochi';

interface IncidentLayerProps {
  incidents: Incident[];
  selectedId: string | null;
  onSelect: (incident: Incident) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  warning: '#f59e0b',
  info: '#06b6d4',
  resolved: '#10b981',
};

const _pinStemGeo = new THREE.CylinderGeometry(0.08, 0.12, 2.4, 8);
const _pinHeadGeo = new THREE.SphereGeometry(0.55, 16, 12);
const _ringGeo = new THREE.RingGeometry(1.2, 2.2, 24);
const _groundCircleGeo = new THREE.CircleGeometry(0.8, 16);

function PulseRing({ color, active }: { color: string; active: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const tRef = useRef(0);

  useFrame((_, delta) => {
    if (!active) return;
    tRef.current += delta * 1.5;
    const s = 1 + Math.sin(tRef.current) * 0.35;
    if (meshRef.current) {
      meshRef.current.scale.set(s, 1, s);
    }
    if (matRef.current) {
      matRef.current.opacity = Math.max(0.05, 0.5 - Math.sin(tRef.current) * 0.35);
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} geometry={_ringGeo}>
      <meshStandardMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={0.4}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function IncidentPin({
  incident,
  selected,
  onSelect,
}: {
  incident: Incident;
  selected: boolean;
  onSelect: () => void;
}) {
  const color = SEVERITY_COLORS[incident.severity] || '#f59e0b';
  const groupRef = useRef<THREE.Group>(null);
  const bobRef = useRef(0);

  // Map schematic x, y (0-100) to 3D world coordinates
  const worldPos: [number, number, number] = [
    (incident.x - 50) * 4.5,
    1.8,
    (incident.y - 50) * 4.5,
  ];

  useFrame((_, delta) => {
    bobRef.current += delta;
    if (groupRef.current) {
      groupRef.current.position.y = worldPos[1] + Math.sin(bobRef.current * 1.5) * 0.25;
    }
  });

  const isActive = incident.severity === 'critical' || incident.severity === 'warning';

  return (
    <group position={[worldPos[0], 0, worldPos[2]]}>
      {isActive && <PulseRing color={color} active={isActive} />}

      <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        {/* Pin stem */}
        <mesh position={[0, -1.2, 0]} geometry={_pinStemGeo} castShadow>
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} />
        </mesh>

        {/* Head sphere */}
        <mesh position={[0, 0, 0]} geometry={_pinHeadGeo} castShadow>
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={selected ? 0.9 : 0.4}
            metalness={0.3}
            roughness={0.4}
            toneMapped={false}
          />
        </mesh>

        {/* Glow point light */}
        <pointLight color={color} intensity={selected ? 10 : 4} distance={12} decay={2} position={[0, 0, 0]} />

        {/* HTML Tag */}
        <Html position={[0.7, 0.4, 0]} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          <div
            style={{
              background: 'rgba(11, 17, 32, 0.88)',
              color: '#fff',
              fontSize: '10px',
              padding: '3px 7px',
              borderRadius: '6px',
              border: `1px solid ${color}`,
              lineHeight: 1.3,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div style={{ color, fontWeight: 700 }}>{incident.title}</div>
            <div style={{ color: '#94a3b8', fontSize: '9px' }}>{incident.location}</div>
          </div>
        </Html>
      </group>

      {/* Ground marker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} geometry={_groundCircleGeo}>
        <meshStandardMaterial color={color} transparent opacity={0.25} depthWrite={false} />
      </mesh>
    </group>
  );
}

function IncidentLayerComponent({
  incidents,
  selectedId,
  onSelect,
}: IncidentLayerProps) {
  return (
    <group>
      {incidents.map((inc) => (
        <IncidentPin
          key={inc.id}
          incident={inc}
          selected={inc.id === selectedId}
          onSelect={() => onSelect(inc)}
        />
      ))}
    </group>
  );
}

export const IncidentLayer = React.memo(IncidentLayerComponent);
