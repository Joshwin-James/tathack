// Main Three.js R3F Canvas for Machine Sight: Isometric Aerial View, Agent Tracking & Cursor Zone Raycasting
import React, { useEffect, useState, useRef, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { CorridorSimulation } from "@/lib/sim/corridor-sim";
import { ClayCityScene } from "./clay-city-scene";
import { LidarPoints } from "./lidar-points";
import { SensorCorridorRibbon } from "./sensor-corridor-ribbon";
import { AgentPerceptionLayer } from "./agent-perception-layer";
import { PerceptionAgent, extractPerceptionState } from "@/lib/sim/perception";

interface MachineSightCanvasProps {
  simRef: React.RefObject<CorridorSimulation>;
  isRunning: boolean;
  sensorMode: "lidar" | "segments" | "depth";
  greenCorridorActive: boolean;
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  onAgentsUpdate: (agents: PerceptionAgent[], ambulance: PerceptionAgent) => void;
  onFpsUpdate: (fps: number) => void;
  lowQuality?: boolean;
  shiftHeld: boolean;
}

export function MachineSightCanvas({
  simRef,
  isRunning,
  sensorMode,
  greenCorridorActive,
  selectedAgentId,
  onSelectAgent,
  onAgentsUpdate,
  onFpsUpdate,
  lowQuality,
  shiftHeld,
}: MachineSightCanvasProps) {
  const [zoneCenter, setZoneCenter] = useState<[number, number]>([0, 0]);
  const [agents, setAgents] = useState<PerceptionAgent[]>([]);
  const cursorWorldPos = useRef<[number, number]>([0, 0]);

  // Mode index mapping
  const modeIdx: 0 | 1 | 2 = sensorMode === "lidar" ? 0 : (sensorMode === "segments" ? 1 : 2);

  return (
    <div className="relative h-full w-full min-h-[600px] overflow-hidden rounded-3xl bg-[#090e17]">
      <Canvas
        camera={{ position: [-190, 52, -60], fov: 45, near: 0.5, far: 1200 }}
        dpr={[1, lowQuality ? 1 : 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onPointerMissed={() => onSelectAgent(null)}
      >
        {/* Sky / Deep Ambient Tone */}
        <color attach="background" args={["#090e17"]} />
        <fog attach="fog" args={["#090e17", 120, 600]} />

        {/* Ambient & Directional Lighting for Clay Aesthetics */}
        <ambientLight intensity={0.65} />
        <directionalLight position={[80, 180, 60]} intensity={0.9} castShadow />

        {/* Core Physics & Perception Loop */}
        <MachineSightEngine
          simRef={simRef}
          isRunning={isRunning}
          shiftHeld={shiftHeld}
          cursorWorldPos={cursorWorldPos}
          selectedAgentId={selectedAgentId}
          onZoneCenterChange={setZoneCenter}
          onAgentsCalculated={(agts, amb) => {
            setAgents(agts);
            onAgentsUpdate(agts, amb);
          }}
          onFps={onFpsUpdate}
        />

        {/* Ground Raycast Receiver for Shift-Key Cursor Zone Tracking */}
        <GroundRaycastPlane
          onCursorMove={(x, z) => {
            cursorWorldPos.current = [x, z];
          }}
        />

        {/* 1. Procedural Clay City & Signals */}
        <ClayCityScene
          simRef={simRef}
          zoneCenter={zoneCenter}
          zoneRadius={60}
          sensorMode={modeIdx}
        />

        {/* 2. LIDAR Point Cloud & Scan Waves */}
        <LidarPoints
          simRef={simRef}
          zoneCenter={zoneCenter}
          zoneRadius={60}
          sensorMode={modeIdx}
          lowQuality={lowQuality}
        />

        {/* 3. Glowing Emerald Corridor Ribbon */}
        <SensorCorridorRibbon
          simRef={simRef}
          greenCorridorActive={greenCorridorActive}
        />

        {/* 4. Agents Perception Layer (3D Bounding Boxes & Screen Tags) */}
        <AgentPerceptionLayer
          agents={agents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={onSelectAgent}
          sensorMode={modeIdx}
          zoneCenter={zoneCenter}
          zoneRadius={60}
        />

        {/* 5. Smooth Camera Tracking with Orbit Pan */}
        <SmoothCameraController
          simRef={simRef}
          selectedAgentId={selectedAgentId}
          agents={agents}
        />

        {/* 6. Postprocessing (Bloom & Subtle Glow) */}
        {!lowQuality && (
          <EffectComposer>
            <Bloom
              luminanceThreshold={0.7}
              luminanceSmoothing={0.3}
              intensity={0.65}
              mipmapBlur
            />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}

// 60Hz Stepper & Perception Calculation
function MachineSightEngine({
  simRef,
  isRunning,
  shiftHeld,
  cursorWorldPos,
  selectedAgentId,
  onZoneCenterChange,
  onAgentsCalculated,
  onFps,
}: {
  simRef: React.RefObject<CorridorSimulation>;
  isRunning: boolean;
  shiftHeld: boolean;
  cursorWorldPos: React.RefObject<[number, number]>;
  selectedAgentId: string | null;
  onZoneCenterChange: (center: [number, number]) => void;
  onAgentsCalculated: (agents: PerceptionAgent[], amb: PerceptionAgent) => void;
  onFps: (fps: number) => void;
}) {
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const updateTick = useRef(0);

  useFrame((state, delta) => {
    // 1. Live FPS calculation
    frameCount.current++;
    const now = performance.now();
    if (now - lastTime.current >= 500) {
      const currentFps = Math.round((frameCount.current * 1000) / (now - lastTime.current));
      onFps(currentFps);
      frameCount.current = 0;
      lastTime.current = now;
    }

    if (!simRef.current) return;

    // 2. Step simulation
    if (isRunning) {
      const dt = Math.min(delta, 0.05);
      simRef.current.step(dt);
    }

    // 3. Compute Zone Center
    const amb = simRef.current.vehicle;
    let targetCenter: [number, number] = [amb.x, amb.z];
    if (shiftHeld && cursorWorldPos.current) {
      targetCenter = [cursorWorldPos.current[0], cursorWorldPos.current[1]];
    }
    onZoneCenterChange(targetCenter);

    // 4. Extract Perception State every 2 frames for top performance
    updateTick.current++;
    if (updateTick.current % 2 === 0) {
      const { agents, ambulanceAgent } = extractPerceptionState(
        simRef.current,
        targetCenter,
        60.0
      );
      onAgentsCalculated(agents, ambulanceAgent);
    }
  });

  return null;
}

// Raycast plane for cursor coordinate tracking
function GroundRaycastPlane({ onCursorMove }: { onCursorMove: (x: number, z: number) => void }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.1, 0]}
      visible={false}
      onPointerMove={(e) => {
        onCursorMove(e.point.x, e.point.z);
      }}
    >
      <planeGeometry args={[1200, 1200]} />
      <meshBasicMaterial />
    </mesh>
  );
}

// Camera Director with smooth focus on tracked agent or ambulance
function SmoothCameraController({
  simRef,
  selectedAgentId,
  agents,
}: {
  simRef: React.RefObject<CorridorSimulation>;
  selectedAgentId: string | null;
  agents: PerceptionAgent[];
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const targetPos = useRef(new THREE.Vector3(-190, 0, -60));

  useFrame((state, delta) => {
    if (!simRef.current) return;

    let focusX = simRef.current.vehicle.x;
    let focusZ = simRef.current.vehicle.z;

    // If an agent is selected, focus on that agent
    if (selectedAgentId) {
      const selected = agents.find((a) => a.id === selectedAgentId);
      if (selected) {
        focusX = selected.position[0];
        focusZ = selected.position[2];
      }
    }

    // Smoothly lerp target center
    targetPos.current.lerp(new THREE.Vector3(focusX, 0, focusZ), delta * 3.5);

    if (controlsRef.current) {
      controlsRef.current.target.copy(targetPos.current);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI / 2 - 0.1}
      minDistance={15}
      maxDistance={350}
    />
  );
}
