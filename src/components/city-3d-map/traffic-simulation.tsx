import React, { useRef, useMemo, useReducer } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { TrafficEngine } from './engine';
import type { Direction, SignalState, CameraMode, SnapshotData } from './types';
import { ROAD_WIDTH, SIDEWALK_WIDTH, STOP_LINE_OFFSET, LANE_WIDTH } from './constants';
import { RoadNetwork } from './road-network';
import { TrafficSignal } from './traffic-signal';
import { Car, Motorcycle, Bus } from './vehicles';
import { Ambulance } from './ambulance';
import { IncidentLayer } from './incident-layer';
import type { Incident } from '@/data/kochi';

// R3F compatibility patch for Vite devtools JSX data-tsd-source attribute injection
if (typeof window !== 'undefined' && !(THREE.Object3D.prototype as any).data) {
  (THREE.Object3D.prototype as any).data = {};
}

interface SceneProps {
  engine: TrafficEngine;
  onSnapshot?: (snapshot: SnapshotData) => void;
  followAmbulance: boolean;
  selectedVehicleId: number | null;
  cameraMode: CameraMode;
  incidents: Incident[];
  selectedIncidentId: string | null;
  onSelectIncident: (incident: Incident) => void;
  orbitControlsRef: React.RefObject<OrbitControlsImpl | null>;
}

// ---- Pooled vehicle slot ----
interface VehicleSlotData {
  groupRef: React.RefObject<THREE.Group>;
  speedRef: React.MutableRefObject<number>;
  brakeLightRef: React.MutableRefObject<boolean>;
  activeRef: React.MutableRefObject<boolean>;
  kindRef: React.MutableRefObject<string>;
  colorRef: React.MutableRefObject<THREE.ColorRepresentation>;
  idRef: React.MutableRefObject<number>;
}

function useVehiclePool(size: number): VehicleSlotData[] {
  return useMemo(() => {
    return Array.from({ length: size }, () => ({
      groupRef: { current: null } as unknown as React.RefObject<THREE.Group>,
      speedRef: { current: 0 } as React.MutableRefObject<number>,
      brakeLightRef: { current: false } as React.MutableRefObject<boolean>,
      activeRef: { current: false } as React.MutableRefObject<boolean>,
      kindRef: { current: 'car' } as React.MutableRefObject<string>,
      colorRef: { current: '#2980b9' } as React.MutableRefObject<THREE.ColorRepresentation>,
      idRef: { current: -1 } as React.MutableRefObject<number>,
    }));
  }, [size]);
}

function CarSlot({ slot }: { slot: VehicleSlotData }) {
  return (
    <group ref={slot.groupRef} visible={false}>
      <Car color={slot.colorRef.current} speedRef={slot.speedRef} brakeLightRef={slot.brakeLightRef} />
    </group>
  );
}

function MotoSlot({ slot }: { slot: VehicleSlotData }) {
  return (
    <group ref={slot.groupRef} visible={false}>
      <Motorcycle color={slot.colorRef.current} speedRef={slot.speedRef} brakeLightRef={slot.brakeLightRef} />
    </group>
  );
}

function BusSlot({ slot }: { slot: VehicleSlotData }) {
  return (
    <group ref={slot.groupRef} visible={false}>
      <Bus color={slot.colorRef.current} speedRef={slot.speedRef} brakeLightRef={slot.brakeLightRef} />
    </group>
  );
}

function AmbulanceSlot({ slot }: { slot: VehicleSlotData }) {
  const emergRef = useRef(true);
  return (
    <group ref={slot.groupRef} visible={false}>
      <Ambulance speedRef={slot.speedRef} brakeLightRef={slot.brakeLightRef} emergencyActive={emergRef.current} />
    </group>
  );
}

const KIND_COLORS: Record<string, string[]> = {
  car: [
    '#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad',
    '#16a085', '#2c3e50', '#e67e22', '#1abc9c', '#d35400',
    '#34495e', '#7f8c8d', '#fd79a8', '#6c5ce7', '#e17055',
  ],
  motorcycle: ['#c0392b', '#2c3e50', '#8e44ad', '#e67e22', '#16a085'],
  bus: ['#27ae60', '#2980b9', '#f39c12', '#c0392b', '#8e44ad'],
  ambulance: ['#ffffff'],
};

function pickColor(kind: string, slotIdx: number): THREE.ColorRepresentation {
  const arr = KIND_COLORS[kind] ?? KIND_COLORS['car'];
  return arr[slotIdx % arr.length];
}

/**
 * Vehicle renderer using a pre-allocated pool of 76 slot components.
 */
function VehicleRenderer({ engine }: { engine: TrafficEngine }) {
  const carSlots = useVehiclePool(32);
  const motoSlots = useVehiclePool(20);
  const busSlots = useVehiclePool(20);
  const ambSlots = useVehiclePool(4);

  const assignedMap = useRef<Map<number, { pool: VehicleSlotData[]; idx: number }>>(new Map());

  useFrame(() => {
    const vehicles = engine.vehicles;
    const activeIds = new Set(vehicles.map((v) => v.id));

    // Release slots for exited vehicles
    for (const [id, { pool, idx }] of assignedMap.current) {
      if (!activeIds.has(id)) {
        const slot = pool[idx];
        if (slot.groupRef.current) {
          slot.groupRef.current.visible = false;
        }
        slot.activeRef.current = false;
        slot.idRef.current = -1;
        assignedMap.current.delete(id);
      }
    }

    // Assign/update slots for active vehicles
    for (const v of vehicles) {
      let assignment = assignedMap.current.get(v.id);

      if (!assignment) {
        let pool: VehicleSlotData[];
        if (v.kind === 'car') pool = carSlots;
        else if (v.kind === 'motorcycle') pool = motoSlots;
        else if (v.kind === 'bus') pool = busSlots;
        else pool = ambSlots;

        const freeIdx = pool.findIndex((s) => s.idRef.current === -1);
        if (freeIdx === -1) continue;

        const slot = pool[freeIdx];
        slot.idRef.current = v.id;
        slot.colorRef.current = pickColor(v.kind, freeIdx);
        slot.activeRef.current = true;

        assignment = { pool, idx: freeIdx };
        assignedMap.current.set(v.id, assignment);
      }

      const slot = assignment.pool[assignment.idx];

      if (slot.groupRef.current) {
        slot.groupRef.current.visible = true;
        slot.groupRef.current.position.set(v.position.x, v.position.y, v.position.z);
        slot.groupRef.current.rotation.y = v.heading;
      }

      slot.speedRef.current = v.speed;
      slot.brakeLightRef.current = v.brakeLight;
    }
  });

  return (
    <>
      <group>{carSlots.map((s, i) => <CarSlot key={`car-${i}`} slot={s} />)}</group>
      <group>{motoSlots.map((s, i) => <MotoSlot key={`moto-${i}`} slot={s} />)}</group>
      <group>{busSlots.map((s, i) => <BusSlot key={`bus-${i}`} slot={s} />)}</group>
      <group>{ambSlots.map((s, i) => <AmbulanceSlot key={`amb-${i}`} slot={s} />)}</group>
    </>
  );
}

/** Traffic signals at the four intersection approaches */
function SignalRenderer({ engine }: { engine: TrafficEngine }) {
  const offset = ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 1;
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const statesRef = useRef<Record<string, SignalState>>({});
  const lastSecRef = useRef<number>(-1);

  const signals = useMemo(
    () => [
      { pos: [offset, 0, ROAD_WIDTH / 2 + 1] as [number, number, number], rotY: 0, approach: 'south' as Direction },
      { pos: [-offset, 0, -ROAD_WIDTH / 2 - 1] as [number, number, number], rotY: Math.PI, approach: 'north' as Direction },
      { pos: [ROAD_WIDTH / 2 + 1, 0, -offset] as [number, number, number], rotY: -Math.PI / 2, approach: 'east' as Direction },
      { pos: [-ROAD_WIDTH / 2 - 1, 0, offset] as [number, number, number], rotY: Math.PI / 2, approach: 'west' as Direction },
    ],
    [offset],
  );

  useFrame(() => {
    let changed = false;
    for (const s of signals) {
      const newState = engine.getSignalState(s.approach);
      const timerVal = Math.ceil(engine.getSignalTimer(s.approach));
      if (statesRef.current[s.approach] !== newState || timerVal !== lastSecRef.current) {
        statesRef.current[s.approach] = newState;
        lastSecRef.current = timerVal;
        changed = true;
      }
    }
    if (changed) forceUpdate();
  });

  return (
    <group>
      {signals.map((s, i) => (
        <TrafficSignal
          key={i}
          position={s.pos}
          rotationY={s.rotY}
          state={engine.getSignalState(s.approach)}
          phaseRemaining={engine.getSignalTimer(s.approach)}
        />
      ))}
    </group>
  );
}

/** Yellow Box Junction Surface Marking (Don't Block the Box) */
function YellowBoxMarking() {
  const boxSize = ROAD_WIDTH - 2;
  return (
    <group position={[0, 0.03, 0]}>
      {/* Outer yellow border */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[boxSize / 2 - 0.4, boxSize / 2, 4, 1, Math.PI / 4]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>
      {/* Diagonal yellow cross lines */}
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <planeGeometry args={[0.3, boxSize * 1.35]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, -Math.PI / 4]}>
        <planeGeometry args={[0.3, boxSize * 1.35]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Dynamic Approach Congestion Heatmap Overlays */
function CongestionOverlays({ engine }: { engine: TrafficEngine }) {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const timerRef = useRef(0);

  useFrame((_, delta) => {
    timerRef.current += delta;
    if (timerRef.current > 0.4) {
      timerRef.current = 0;
      forceUpdate();
    }
  });

  if (!engine.congestionOverlays) return null;

  const approaches: Array<{ dir: Direction; pos: [number, number, number]; rotY: number }> = [
    { dir: 'south', pos: [LANE_WIDTH / 2, 0.05, STOP_LINE_OFFSET + 30], rotY: 0 },
    { dir: 'north', pos: [-LANE_WIDTH / 2, 0.05, -(STOP_LINE_OFFSET + 30)], rotY: Math.PI },
    { dir: 'east', pos: [STOP_LINE_OFFSET + 30, 0.05, -LANE_WIDTH / 2], rotY: -Math.PI / 2 },
    { dir: 'west', pos: [-(STOP_LINE_OFFSET + 30), 0.05, LANE_WIDTH / 2], rotY: Math.PI / 2 },
  ];

  return (
    <group>
      {approaches.map(({ dir, pos, rotY }) => {
        const m = engine.approachMetrics[dir];
        const length = Math.max(12, Math.min(95, m.queueLengthMeters || m.queueCount * 6.5));
        const color = m.congestionLevel === 'heavy' ? '#ef4444' : m.congestionLevel === 'moderate' ? '#f59e0b' : '#10b981';
        const opacity = m.queueCount > 0 ? (m.congestionLevel === 'heavy' ? 0.55 : 0.35) : 0.12;

        return (
          <group key={dir} position={pos} rotation={[0, rotY, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[LANE_WIDTH * 1.8, length]} />
              <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Downstream Blockage Road Barriers */
function DownstreamBlockageBarriers({ engine }: { engine: TrafficEngine }) {
  const blockedDirs = (Object.keys(engine.downstreamBlocked) as Direction[]).filter(
    (d) => engine.downstreamBlocked[d]
  );

  if (blockedDirs.length === 0) return null;

  const exitCoords: Record<Direction, { pos: [number, number, number]; rotY: number }> = {
    north: { pos: [0, 0.5, -STOP_LINE_OFFSET - 40], rotY: 0 },
    south: { pos: [0, 0.5, STOP_LINE_OFFSET + 40], rotY: 0 },
    east: { pos: [STOP_LINE_OFFSET + 40, 0.5, 0], rotY: Math.PI / 2 },
    west: { pos: [-STOP_LINE_OFFSET - 40, 0.5, 0], rotY: Math.PI / 2 },
  };

  return (
    <group>
      {blockedDirs.map((dir) => {
        const c = exitCoords[dir];
        return (
          <group key={dir} position={c.pos} rotation={[0, c.rotY, 0]}>
            {/* Barrier body */}
            <mesh position={[0, 0.4, 0]}>
              <boxGeometry args={[ROAD_WIDTH * 0.9, 0.8, 0.4]} />
              <meshStandardMaterial color="#dc2626" roughness={0.5} />
            </mesh>
            {/* Yellow reflective hazard stripe */}
            <mesh position={[0, 0.4, 0.22]}>
              <planeGeometry args={[ROAD_WIDTH * 0.85, 0.3]} />
              <meshBasicMaterial color="#fbbf24" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** 3D Stop Line Visualizer across all 4 approaches */
function StopLineMarkers({ engine }: { engine: TrafficEngine }) {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const stateRef = useRef<Record<string, string>>({});

  useFrame(() => {
    let changed = false;
    for (const d of ['north', 'south', 'east', 'west'] as Direction[]) {
      const s = engine.getSignalState(d);
      if (stateRef.current[d] !== s) {
        stateRef.current[d] = s;
        changed = true;
      }
    }
    if (changed) forceUpdate();
  });

  const stopLines: Array<{ dir: Direction; pos: [number, number, number]; rotY: number }> = [
    { dir: 'south', pos: [LANE_WIDTH / 2, 0.05, STOP_LINE_OFFSET], rotY: 0 },
    { dir: 'north', pos: [-LANE_WIDTH / 2, 0.05, -STOP_LINE_OFFSET], rotY: Math.PI },
    { dir: 'east', pos: [STOP_LINE_OFFSET, 0.05, -LANE_WIDTH / 2], rotY: -Math.PI / 2 },
    { dir: 'west', pos: [-STOP_LINE_OFFSET, 0.05, LANE_WIDTH / 2], rotY: Math.PI / 2 },
  ];

  return (
    <group>
      {stopLines.map(({ dir, pos, rotY }) => {
        const sig = engine.getSignalState(dir);
        const color = sig === 'green' ? '#10b981' : sig === 'amber' ? '#f59e0b' : '#ef4444';
        return (
          <group key={dir} position={pos} rotation={[0, rotY, 0]}>
            {/* Primary stop bar across approach lane */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[LANE_WIDTH * 1.8, 0.7]} />
              <meshBasicMaterial color={color} side={THREE.DoubleSide} />
            </mesh>
            {/* Warning aura */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
              <planeGeometry args={[LANE_WIDTH * 1.9, 1.8]} />
              <meshBasicMaterial color={color} transparent opacity={0.25} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** 3D Diagnostic Badges over stopped vehicles when debugMode is active */
function DiagnosticBadges({ engine }: { engine: TrafficEngine }) {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const timer = useRef(0);

  useFrame((_, delta) => {
    timer.current += delta;
    if (timer.current > 0.1) {
      timer.current = 0;
      if (engine.debugMode) forceUpdate();
    }
  });

  if (!engine.debugMode) return null;

  const stoppedVehicles = engine.vehicles.filter((v) => v.stopReason !== 'NONE');

  return (
    <group>
      {stoppedVehicles.map((v) => {
        const color =
          v.stopReason === 'RED_SIGNAL'
            ? '#ef4444'
            : v.stopReason === 'VEHICLE_AHEAD'
            ? '#3b82f6'
            : v.stopReason === 'DOWNSTREAM_BLOCKED'
            ? '#a855f7'
            : '#f59e0b';
        return (
          <group key={v.id} position={[v.position.x, v.position.y + v.spec.height + 0.8, v.position.z]}>
            <mesh>
              <sphereGeometry args={[0.3, 8, 8]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <pointLight distance={3} intensity={3} color={color} />
          </group>
        );
      })}
    </group>
  );
}

/** Camera Controller for modes & following */
function CameraController({
  cameraMode,
  engine,
  followAmbulance,
  selectedVehicleId,
  orbitControlsRef,
}: {
  cameraMode: CameraMode;
  engine: TrafficEngine;
  followAmbulance: boolean;
  selectedVehicleId: number | null;
  orbitControlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const targetCamPos = useRef(new THREE.Vector3(100, 80, 100));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    if (followAmbulance || cameraMode === 'follow') {
      let followTarget: THREE.Vector3 | null = null;

      if (followAmbulance && engine.ambulanceId !== null) {
        const amb = engine.vehicles.find((v) => v.id === engine.ambulanceId);
        if (amb) followTarget = amb.position.clone().setY(0);
      } else if (selectedVehicleId !== null) {
        const sel = engine.vehicles.find((v) => v.id === selectedVehicleId);
        if (sel) followTarget = sel.position.clone().setY(0);
      }

      if (followTarget) {
        const targetPos = followTarget.clone().add(new THREE.Vector3(0, 24, 32));
        targetCamPos.current.lerp(targetPos, 0.05);
        targetLookAt.current.lerp(followTarget, 0.05);

        camera.position.lerp(targetCamPos.current, 0.06);
        if (orbitControlsRef.current) {
          orbitControlsRef.current.target.lerp(targetLookAt.current, 0.06);
          orbitControlsRef.current.update();
        } else {
          camera.lookAt(targetLookAt.current);
        }
      }
    } else if (cameraMode === 'top_down') {
      targetCamPos.current.set(0, 160, 0.1);
      targetLookAt.current.set(0, 0, 0);
      camera.position.lerp(targetCamPos.current, 0.06);
      if (orbitControlsRef.current) {
        orbitControlsRef.current.target.lerp(targetLookAt.current, 0.06);
        orbitControlsRef.current.update();
      }
    } else if (cameraMode === 'street') {
      const corner = ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 6;
      targetCamPos.current.set(corner, 3.2, corner);
      targetLookAt.current.set(0, 1.2, 0);
      camera.position.lerp(targetCamPos.current, 0.05);
      if (orbitControlsRef.current) {
        orbitControlsRef.current.target.lerp(targetLookAt.current, 0.05);
        orbitControlsRef.current.update();
      }
    }
  });

  return null;
}

/** Main scene content */
function SceneContent({
  engine,
  onSnapshot,
  followAmbulance,
  selectedVehicleId,
  cameraMode,
  incidents,
  selectedIncidentId,
  onSelectIncident,
  orbitControlsRef,
}: SceneProps) {
  const snapshotTimer = useRef(0);

  useFrame((_, delta) => {
    engine.update(delta);

    snapshotTimer.current += delta;
    if (snapshotTimer.current >= 0.12 && onSnapshot) {
      snapshotTimer.current = 0;
      onSnapshot(engine.getSnapshot());
    }
  });

  return (
    <>
      <ambientLight intensity={0.65} color="#dbeafe" />
      <directionalLight
        position={[80, 120, 60]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={10}
        shadow-camera-far={350}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        shadow-bias={-0.0004}
        color="#fffbeb"
      />
      <directionalLight position={[-60, 40, -60]} intensity={0.3} color="#93c5fd" />

      <CameraController
        cameraMode={cameraMode}
        engine={engine}
        followAmbulance={followAmbulance}
        selectedVehicleId={selectedVehicleId}
        orbitControlsRef={orbitControlsRef}
      />

      <Environment preset="city" />

      {/* Kochi Road network & 3D Landmarks */}
      <RoadNetwork />

      {/* Yellow Box Marking (Don't Block the Box) */}
      <YellowBoxMarking />

      {/* Dynamic Congestion Heatmap Overlays */}
      <CongestionOverlays engine={engine} />

      {/* Downstream Blockage Barriers */}
      <DownstreamBlockageBarriers engine={engine} />

      {/* Real-time Incident Pins & Beacons */}
      <IncidentLayer
        incidents={incidents}
        selectedId={selectedIncidentId}
        onSelect={onSelectIncident}
      />

      {/* 3D Stop Line Markers (Red/Amber/Green) */}
      <StopLineMarkers engine={engine} />

      {/* Traffic Signals */}
      <SignalRenderer engine={engine} />

      {/* Vehicles (Pooled) */}
      <VehicleRenderer engine={engine} />

      {/* 3D Diagnostics Badges (Debug HUD mode) */}
      <DiagnosticBadges engine={engine} />
    </>
  );
}

export interface TrafficSimulationProps {
  engine: TrafficEngine;
  onSnapshot?: (snapshot: SnapshotData) => void;
  followAmbulance?: boolean;
  selectedVehicleId?: number | null;
  cameraMode?: CameraMode;
  incidents?: Incident[];
  selectedIncidentId?: string | null;
  onSelectIncident?: (incident: Incident) => void;
}

/** Full 3D traffic simulation canvas */
function TrafficSimulationComponent({
  engine,
  onSnapshot,
  followAmbulance = false,
  selectedVehicleId = null,
  cameraMode = 'orbit',
  incidents = [],
  selectedIncidentId = null,
  onSelectIncident = () => {},
}: TrafficSimulationProps) {
  const orbitControlsRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <Canvas
      shadows
      camera={{ position: [100, 80, 100], fov: 50, near: 0.5, far: 1200 }}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
      dpr={[1, 1.5]}
    >
      <fog attach="fog" args={['#0f172a', 200, 650]} />
      <SceneContent
        engine={engine}
        onSnapshot={onSnapshot}
        followAmbulance={followAmbulance}
        selectedVehicleId={selectedVehicleId}
        cameraMode={cameraMode}
        incidents={incidents}
        selectedIncidentId={selectedIncidentId}
        onSelectIncident={onSelectIncident}
        orbitControlsRef={orbitControlsRef}
      />
      <OrbitControls
        ref={orbitControlsRef}
        enablePan
        enableZoom
        enableRotate
        minDistance={15}
        maxDistance={500}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 0, 0]}
        makeDefault
      />
    </Canvas>
  );
}

export const TrafficSimulation = React.memo(TrafficSimulationComponent);
