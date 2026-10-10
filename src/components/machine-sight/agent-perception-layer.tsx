// Oriented 3D Bounding Boxes, Low-Poly Agent Meshes (Cars, Pedestrians, Cyclists, Ambulance), and Monospace Tags
import React, { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { PerceptionAgent } from "@/lib/sim/perception";

interface AgentPerceptionLayerProps {
  agents: PerceptionAgent[];
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  sensorMode: 0 | 1 | 2;
  zoneCenter: [number, number];
  zoneRadius: number;
}

export function AgentPerceptionLayer({
  agents,
  selectedAgentId,
  onSelectAgent,
  sensorMode,
  zoneCenter,
  zoneRadius,
}: AgentPerceptionLayerProps) {
  // Cull screen tags so that only agents inside zone (and max 25) render tags
  const culledAgents = useMemo(() => {
    return agents.filter((a) => a.inZone).slice(0, 25);
  }, [agents]);

  return (
    <group>
      {agents.map((agent) => (
        <SingleAgentMesh
          key={agent.id}
          agent={agent}
          isSelected={selectedAgentId === agent.id}
          onSelect={() => onSelectAgent(agent.id)}
          sensorMode={sensorMode}
        />
      ))}

      {/* Screen-space Monospace Tags matching video */}
      {culledAgents.map((agent) => (
        <AgentScreenTag
          key={`tag-${agent.id}`}
          agent={agent}
          isSelected={selectedAgentId === agent.id}
          onSelect={() => onSelectAgent(agent.id)}
        />
      ))}
    </group>
  );
}

function SingleAgentMesh({
  agent,
  isSelected,
  onSelect,
  sensorMode,
}: {
  agent: PerceptionAgent;
  isSelected: boolean;
  onSelect: () => void;
  sensorMode: 0 | 1 | 2;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.set(agent.position[0], agent.position[1], agent.position[2]);
      groupRef.current.rotation.y = -agent.heading + Math.PI / 2;
      groupRef.current.rotation.z = agent.roll;
    }
  });

  // Bounding box wireframe color
  const bboxColor = useMemo(() => {
    if (agent.hasTtcWarning) return "#ef4444"; // Flashing red alert
    if (isSelected) return "#38bdf8";          // Cyan selected
    if (agent.type === "ambulance") return "#ea580c"; // Electric orange lead
    if (agent.type === "pedestrian") return "#a855f7"; // Magenta/Purple for pedestrian
    if (agent.type === "cyclist") return "#10b981";    // Emerald for bicycle
    if (sensorMode === 0) return "#00f0ff";    // LIDAR Cyan
    if (sensorMode === 1) return "#38bdf8";    // Segment Sky
    return "#2dd4bf";                          // Depth Teal
  }, [agent.hasTtcWarning, isSelected, agent.type, sensorMode]);

  return (
    <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* 1. Oriented 3D Bounding Box (Sensor Perception) */}
      <mesh position={[0, agent.dimensions[1] / 2 - 0.2, 0]}>
        <boxGeometry args={agent.dimensions} />
        <meshBasicMaterial
          color={bboxColor}
          wireframe
          transparent
          opacity={agent.hasTtcWarning ? 0.95 : (isSelected ? 0.9 : 0.4)}
        />
      </mesh>

      {/* 2. Agent 3D Geometry */}
      {agent.type === "ambulance" ? (
        <group position={[0, 0, 0]}>
          {/* Main Cabin */}
          <mesh position={[0, 0.6, 0]} castShadow>
            <boxGeometry args={[4.6, 1.8, 1.9]} />
            <meshStandardMaterial
              color={sensorMode === 1 ? "#ea580c" : (sensorMode === 0 ? "#0f172a" : "#0d9488")}
              roughness={0.2}
            />
          </mesh>

          {/* Windshield */}
          <mesh position={[1.4, 0.7, 0]}>
            <boxGeometry args={[0.8, 0.9, 1.7]} />
            <meshStandardMaterial color="#0284c7" roughness={0.1} />
          </mesh>

          {/* Dual Flashing Emergency Lightbar */}
          <EmergencyLightbar />
        </group>
      ) : agent.type === "pedestrian" ? (
        <group position={[0, 0, 0]}>
          {/* Torso & Legs */}
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.25, 0.25, 1.2, 8]} />
            <meshStandardMaterial color={sensorMode === 1 ? "#a855f7" : (sensorMode === 0 ? "#1e293b" : "#14b8a6")} />
          </mesh>
          {/* Head */}
          <mesh position={[0, 1.5, 0]}>
            <sphereGeometry args={[0.22, 12, 12]} />
            <meshStandardMaterial color="#fbbf24" />
          </mesh>
        </group>
      ) : agent.type === "cyclist" ? (
        <group position={[0, 0, 0]}>
          {/* Bike Frame */}
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[1.6, 0.4, 0.3]} />
            <meshStandardMaterial color="#10b981" />
          </mesh>
          {/* Rider */}
          <mesh position={[-0.1, 0.9, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.9, 8]} />
            <meshStandardMaterial color={sensorMode === 1 ? "#06b6d4" : "#1e293b"} />
          </mesh>
          {/* Helmet */}
          <mesh position={[-0.1, 1.5, 0]}>
            <sphereGeometry args={[0.2, 12, 12]} />
            <meshStandardMaterial color="#f59e0b" />
          </mesh>
        </group>
      ) : (
        <group position={[0, 0, 0]}>
          {/* Car Body */}
          <mesh position={[0, 0.35, 0]} castShadow>
            <boxGeometry args={[3.8, 1.0, 1.7]} />
            <meshStandardMaterial
              color={sensorMode === 1 ? "#0284c7" : (sensorMode === 0 ? "#1e293b" : "#14b8a6")}
              roughness={0.3}
            />
          </mesh>

          {/* Cabin Glass */}
          <mesh position={[-0.2, 0.95, 0]}>
            <boxGeometry args={[2.0, 0.7, 1.4]} />
            <meshStandardMaterial
              color={sensorMode === 1 ? "#0f172a" : "#0284c7"}
              roughness={0.1}
              transparent
              opacity={0.8}
            />
          </mesh>
        </group>
      )}

      {/* Target Marker Ring when Selected */}
      {isSelected && (
        <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.5, 2.8, 32]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

// Emergency Red & Blue Lightbar with fast oscillation
function EmergencyLightbar() {
  const redLightRef = useRef<THREE.MeshBasicMaterial>(null);
  const blueLightRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * 12;
    const isRed = Math.sin(t) > 0;
    if (redLightRef.current) redLightRef.current.opacity = isRed ? 1.0 : 0.2;
    if (blueLightRef.current) blueLightRef.current.opacity = isRed ? 0.2 : 1.0;
  });

  return (
    <group position={[0.4, 1.65, 0]}>
      <mesh position={[0, 0, -0.4]}>
        <boxGeometry args={[0.3, 0.2, 0.4]} />
        <meshBasicMaterial ref={redLightRef} color="#ef4444" transparent />
      </mesh>
      <mesh position={[0, 0, 0.4]}>
        <boxGeometry args={[0.3, 0.2, 0.4]} />
        <meshBasicMaterial ref={blueLightRef} color="#3b82f6" transparent />
      </mesh>
    </group>
  );
}

// Projected Screen Monospace Tag matching the reference video layout
function AgentScreenTag({
  agent,
  isSelected,
  onSelect,
}: {
  agent: PerceptionAgent;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const dotColor = useMemo(() => {
    if (agent.hasTtcWarning) return "bg-red-500 animate-ping";
    if (agent.statusBadge === "WAIT") return "bg-sky-400";
    if (agent.type === "ambulance") return "bg-orange-500 animate-pulse";
    return "bg-emerald-400";
  }, [agent.hasTtcWarning, agent.statusBadge, agent.type]);

  return (
    <Html
      position={[
        agent.position[0],
        agent.position[1] + (agent.type === "ambulance" ? 2.8 : agent.type === "pedestrian" ? 2.1 : 2.0),
        agent.position[2],
      ]}
      center
      distanceFactor={90}
      zIndexRange={[80, 0]}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={`pointer-events-auto cursor-pointer select-none rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold tracking-tight shadow-md backdrop-blur-md transition-all ${
          agent.hasTtcWarning
            ? "border-red-500 bg-red-950/90 text-red-200 animate-pulse"
            : isSelected
            ? "border-cyan-400 bg-cyan-950/95 text-cyan-200 ring-2 ring-cyan-400/60 scale-105"
            : agent.type === "ambulance"
            ? "border-orange-500/80 bg-orange-950/90 text-orange-200"
            : "border-slate-800/80 bg-slate-950/85 text-slate-200 hover:border-slate-600 hover:bg-slate-900"
        }`}
      >
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className={`size-1.5 rounded-full ${dotColor}`} />
          <span>{agent.label}</span>
          <span className="text-slate-500 font-normal">·</span>
          <span className="font-medium text-slate-300">{agent.speedKmh} km/h</span>
        </span>
      </button>
    </Html>
  );
}
