import * as THREE from 'three';

export type Direction = 'north' | 'south' | 'east' | 'west';
export type TurnType = 'straight' | 'left' | 'right';
export type VehicleKind = 'car' | 'motorcycle' | 'bus' | 'ambulance';
export type SignalState = 'red' | 'amber' | 'green';
export type CameraMode = 'orbit' | 'follow' | 'top_down' | 'street';
export type SimulationMode = 'fixed' | 'adaptive';

export type ScenarioPreset =
  | 'balanced'
  | 'heavy_east'
  | 'heavy_ns'
  | 'random_arrivals'
  | 'rush_hour'
  | 'bus_heavy'
  | 'downstream_block'
  | 'emergency_corridor'
  | 'gridlock_stress'
  | 'custom';

export interface VehicleSpec {
  kind: VehicleKind;
  length: number;
  width: number;
  height: number;
  wheelRadius: number;
  maxSpeed: number;
  acceleration: number;
  color?: THREE.ColorRepresentation;
}

export interface LanePath {
  approach: Direction;
  turn: TurnType;
  curve: THREE.CatmullRomCurve3;
  length: number;
  laneOffset: number;
}

export type StopReason =
  | 'NONE'
  | 'RED_SIGNAL'
  | 'VEHICLE_AHEAD'
  | 'INTERSECTION_OCCUPIED'
  | 'DOWNSTREAM_BLOCKED'
  | 'INVALID_ROUTE'
  | 'NO_PERMITTED_MOVEMENT';

export interface VehicleState {
  id: number;
  kind: VehicleKind;
  spec: VehicleSpec;
  path: LanePath;
  distance: number;
  speed: number;
  isEmergency: boolean;
  position: THREE.Vector3;
  heading: number;
  targetHeading: number;
  phase: 'approach' | 'intersection' | 'exit';
  brakeLight: boolean;
  spawnedAt: number;
  stoppedDuration: number;
  waitingTime: number;
  isBlockedByBox: boolean;
  stopReason: StopReason;
  stopReasonDetail: string;
  distToStopLine: number;
}

export interface SignalGroup {
  id: string;
  approaches: Direction[];
  state: SignalState;
  timer: number;
  greenDuration: number;
  yellowDuration: number;
  redDuration: number;
  phaseRemaining: number;
}

export interface ApproachMetrics {
  approach: Direction;
  queueCount: number;
  queueLengthMeters: number;
  avgWaitTimeSec: number;
  maxWaitTimeSec: number;
  stoppedVehicles: number;
  passedCount: number;
  downstreamOccupancy: number;
  congestionLevel: 'low' | 'moderate' | 'heavy';
}

export interface TrafficDemandConfig {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface VehicleMixConfig {
  car: number;
  bus: number;
  motorcycle: number;
}

export interface AdaptiveDecision {
  id: string;
  timestamp: number;
  phase: string;
  reason: string;
  allocatedGreen: number;
  queueSummary: string;
}

export interface ComparisonMetrics {
  avgWaitTime: number;
  totalStoppedDelay: number;
  maxQueueLength: number;
  totalCompletedJourneys: number;
  throughputPerMin: number;
  avgTravelTime: number;
  avgSpeedKmh: number;
}

export interface ComparisonResult {
  fixed: ComparisonMetrics;
  adaptive: ComparisonMetrics;
  delta: {
    waitTimePct: number;
    delayPct: number;
    queuePct: number;
    throughputPct: number;
    travelTimePct: number;
  };
}

export interface SnapshotData {
  vehicles: Array<{
    id: number;
    kind: string;
    position: [number, number, number];
    heading: number;
    brakeLight: boolean;
    isEmergency: boolean;
    speed: number;
    phase: string;
    isBlockedByBox: boolean;
    stopReason: StopReason;
    stopReasonDetail: string;
    distToStopLine: number;
    approach: Direction;
    turn: TurnType;
    signalState: SignalState;
  }>;
  signals: Record<Direction, SignalState>;
  signalTimers: Record<Direction, number>;
  emergencyActive: boolean;
  emergencyPhase: number;
  emergencyApproach: Direction | null;
  vehicleCount: number;
  totalSpawned: number;
  totalExited: number;
  throughputPerMin: number;
  avgSpeedKmh: number;
  paused: boolean;
  simSpeed: number;
  ambulanceId: number | null;
  mode: SimulationMode;
  approachMetrics: Record<Direction, ApproachMetrics>;
  adaptiveReasoning: string;
  adaptiveDecisions: AdaptiveDecision[];
  downstreamBlocked: Record<Direction, boolean>;
  activeScenario: ScenarioPreset;
  congestionOverlays: boolean;
  debugMode: boolean;
}
