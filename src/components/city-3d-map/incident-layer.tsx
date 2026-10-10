import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
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

function IncidentBadgeSprite({
  title,
  location,
  color,
  selected,
}: {
  title: string;
  location: string;
  color: string;
  selected: boolean;
}) {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background rounded pill
    ctx.fillStyle = selected ? 'rgba(15, 23, 42, 0.96)' : 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = color;
    ctx.lineWidth = selected ? 4 : 2.5;
    ctx.beginPath();
    ctx.roundRect(4, 4, 292, 88, 14);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = color;
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    const displayTitle = title.length > 20 ? title.slice(0, 18) + '...' : title;
    ctx.fillText(displayTitle, 16, 38);

    // Location
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '16px system-ui, -apple-system, sans-serif';
    const displayLoc = location.length > 26 ? location.slice(0, 24) + '...' : location;
    ctx.fillText(displayLoc, 16, 72);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [title, location, color, selected]);

  if (!texture) return null;

  return (
    <sprite position={[1.8, 1.4, 0]} scale={[6.2, 2.0, 1]}>
      <spriteMaterial map={texture} depthTest={false} transparent />
    </sprite>
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

        {/* 3D WebGL Canvas Sprite Badge */}
        <IncidentBadgeSprite
          title={incident.title}
          location={incident.location}
          color={color}
          selected={selected}
        />
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
