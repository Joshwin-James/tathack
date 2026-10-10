import * as THREE from 'three';
import type {
  Direction,
  TurnType,
  LanePath,
  VehicleSpec,
  VehicleKind,
  SignalGroup,
  ScenarioPreset,
  TrafficDemandConfig,
  VehicleMixConfig,
} from './types';

// ---- Road geometry constants ----
export const ROAD_WIDTH = 16;
export const LANE_WIDTH = 4;
export const LANE_COUNT = 2;
export const INTERSECTION_SIZE = ROAD_WIDTH;
export const ROAD_LENGTH = 400;
export const SIDEWALK_WIDTH = 5;
export const CURB_HEIGHT = 0.2;

// ---- Vehicle ground clearance ----
export const VEHICLE_Y_OFFSET = 0.02;

// ---- City block layout (Kochi-inspired) ----
export const BLOCK_SIZE = 55;
export const CITY_BLOCKS_X = 5;
export const CITY_BLOCKS_Z = 5;
export const CITY_EXTENT = BLOCK_SIZE * Math.max(CITY_BLOCKS_X, CITY_BLOCKS_Z) + ROAD_LENGTH;

// ---- Traffic signal timing constants ----
export const DEFAULT_FIXED_GREEN = 15;
export const MIN_ADAPTIVE_GREEN = 8;
export const MAX_ADAPTIVE_GREEN = 38;
export const YELLOW_DURATION = 3;
export const ALL_RED_BUFFER = 2.0; // Clean clearance to prevent intersection T-bone overlaps
export const MAX_WAIT_STARVATION = 40; // Max permitted seconds before forced phase shift

// Legacy compatibility
export const GREEN_DURATION = DEFAULT_FIXED_GREEN;

// ---- Vehicle spawning capacity ----
export const MAX_VEHICLES = 65;
export const SPAWN_INTERVAL_MIN = 1.0;
export const SPAWN_INTERVAL_MAX = 3.5;

// ---- Simulation ----
export const FIXED_DT = 1 / 60;
export const STOP_LINE_OFFSET = ROAD_WIDTH / 2 + 2.0;
export const BOX_CLEARANCE_RADIUS = 9.5; // Radius inside which intersection box is occupied

// ---- Direction helpers ----
export const DIRECTIONS: Direction[] = ['north', 'south', 'east', 'west'];

export const DIR_VECTORS: Record<Direction, THREE.Vector3> = {
  north: new THREE.Vector3(0, 0, -1),
  south: new THREE.Vector3(0, 0, 1),
  east: new THREE.Vector3(1, 0, 0),
  west: new THREE.Vector3(-1, 0, 0),
};

export const OPPOSITE: Record<Direction, Direction> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
};

export const LEFT_OF: Record<Direction, Direction> = {
  north: 'west',
  south: 'east',
  east: 'north',
  west: 'south',
};

export const RIGHT_OF: Record<Direction, Direction> = {
  north: 'east',
  south: 'west',
  east: 'south',
  west: 'north',
};

// ---- Vehicle specifications ----
const CAR_COLORS = [
  '#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad',
  '#16a085', '#2c3e50', '#e67e22', '#1abc9c', '#d35400',
  '#34495e', '#7f8c8d', '#bdc3c7', '#0984e3', '#00b894',
  '#fd79a8', '#6c5ce7', '#e17055', '#00cec9',
];

export const VEHICLE_SPECS: Record<VehicleKind, Omit<VehicleSpec, 'color'>> = {
  car: {
    kind: 'car',
    length: 4.3,
    width: 1.85,
    height: 1.45,
    wheelRadius: 0.36,
    maxSpeed: 14,
    acceleration: 6,
  },
  motorcycle: {
    kind: 'motorcycle',
    length: 2.0,
    width: 0.8,
    height: 1.2,
    wheelRadius: 0.28,
    maxSpeed: 16,
    acceleration: 8,
  },
  bus: {
    kind: 'bus',
    length: 10.5,
    width: 2.5,
    height: 3.2,
    wheelRadius: 0.5,
    maxSpeed: 10,
    acceleration: 3.5, // Slower acceleration & heavier inertia
  },
  ambulance: {
    kind: 'ambulance',
    length: 6.5,
    width: 2.3,
    height: 2.6,
    wheelRadius: 0.42,
    maxSpeed: 18,
    acceleration: 8,
  },
};

// ---- Scenario Presets Configuration ----
export const SCENARIO_DEMANDS: Record<ScenarioPreset, TrafficDemandConfig> = {
  balanced: { north: 14, south: 14, east: 14, west: 14 },
  heavy_east: { north: 10, south: 6, east: 35, west: 8 },
  heavy_ns: { north: 32, south: 28, east: 8, west: 8 },
  random_arrivals: { north: 18, south: 22, east: 15, west: 25 },
  rush_hour: { north: 30, south: 34, east: 38, west: 32 },
  bus_heavy: { north: 16, south: 16, east: 20, west: 16 },
  downstream_block: { north: 15, south: 15, east: 24, west: 22 },
  emergency_corridor: { north: 12, south: 28, east: 14, west: 10 },
  gridlock_stress: { north: 45, south: 45, east: 48, west: 46 },
  custom: { north: 15, south: 15, east: 15, west: 15 },
};

export const SCENARIO_VEHICLE_MIXES: Record<ScenarioPreset, VehicleMixConfig> = {
  balanced: { car: 0.65, bus: 0.18, motorcycle: 0.17 },
  heavy_east: { car: 0.7, bus: 0.15, motorcycle: 0.15 },
  heavy_ns: { car: 0.6, bus: 0.22, motorcycle: 0.18 },
  random_arrivals: { car: 0.65, bus: 0.15, motorcycle: 0.2 },
  rush_hour: { car: 0.6, bus: 0.2, motorcycle: 0.2 },
  bus_heavy: { car: 0.35, bus: 0.5, motorcycle: 0.15 },
  downstream_block: { car: 0.65, bus: 0.2, motorcycle: 0.15 },
  emergency_corridor: { car: 0.65, bus: 0.18, motorcycle: 0.17 },
  gridlock_stress: { car: 0.6, bus: 0.22, motorcycle: 0.18 },
  custom: { car: 0.65, bus: 0.18, motorcycle: 0.17 },
};

export function randomCarColor(): THREE.ColorRepresentation {
  return CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
}

export function laneOffsetFor(_approach?: Direction): number {
  void _approach;
  return LANE_WIDTH / 2;
}

// ---- Signal groups ----
export function createSignalGroups(mode: 'fixed' | 'adaptive' = 'fixed'): SignalGroup[] {
  const gDuration = mode === 'adaptive' ? 16 : DEFAULT_FIXED_GREEN;
  return [
    {
      id: 'NS',
      approaches: ['north', 'south'],
      state: 'green',
      timer: 0,
      greenDuration: gDuration,
      yellowDuration: YELLOW_DURATION,
      redDuration: gDuration + 2 * (YELLOW_DURATION + ALL_RED_BUFFER),
      phaseRemaining: gDuration,
    },
    {
      id: 'EW',
      approaches: ['east', 'west'],
      state: 'red',
      timer: 0,
      greenDuration: gDuration,
      yellowDuration: YELLOW_DURATION,
      redDuration: gDuration + 2 * (YELLOW_DURATION + ALL_RED_BUFFER),
      phaseRemaining: gDuration + 2 * (YELLOW_DURATION + ALL_RED_BUFFER),
    },
  ];
}

// ---- Path building ----
export function buildLanePath(approach: Direction, turn: TurnType): LanePath {
  const travelDir = DIR_VECTORS[approach];
  const rightDir = DIR_VECTORS[RIGHT_OF[approach]];

  const offset = LANE_WIDTH / 2;
  const perpOffset = rightDir.clone().multiplyScalar(offset);

  const startDist = ROAD_LENGTH;
  const startPos = travelDir.clone().multiplyScalar(startDist).add(perpOffset);
  const stopPos = travelDir.clone().multiplyScalar(STOP_LINE_OFFSET).add(perpOffset);

  let exitDir: THREE.Vector3;
  if (turn === 'straight') {
    exitDir = travelDir.clone();
  } else if (turn === 'left') {
    exitDir = DIR_VECTORS[LEFT_OF[approach]].clone();
  } else {
    exitDir = DIR_VECTORS[RIGHT_OF[approach]].clone();
  }

  const exitRightDir = DIR_VECTORS[RIGHT_OF[
    turn === 'straight' ? approach :
    turn === 'left' ? LEFT_OF[approach] : RIGHT_OF[approach]
  ]];
  const exitOffset = exitRightDir.clone().multiplyScalar(LANE_WIDTH / 2);

  const enterPoint = travelDir.clone().multiplyScalar(INTERSECTION_SIZE / 2 - 0.5).add(perpOffset);
  const points: THREE.Vector3[] = [];

  if (turn === 'straight') {
    const exitStart = travelDir.clone().multiplyScalar(-(INTERSECTION_SIZE / 2 - 0.5)).add(perpOffset);
    const endPos = travelDir.clone().multiplyScalar(-startDist).add(perpOffset);
    points.push(startPos, stopPos, enterPoint, exitStart, endPos);
  } else {
    const exitEnter = exitDir.clone().multiplyScalar(INTERSECTION_SIZE / 2 - 0.5).add(exitOffset);
    const exitStop = exitDir.clone().multiplyScalar(STOP_LINE_OFFSET).add(exitOffset);
    const endPos = exitDir.clone().multiplyScalar(startDist).add(exitOffset);

    if (turn === 'right') {
      const midPoint = new THREE.Vector3().addVectors(enterPoint, exitEnter).multiplyScalar(0.5);
      const cornerDir = new THREE.Vector3().addVectors(travelDir, exitDir).normalize();
      midPoint.addScaledVector(cornerDir, INTERSECTION_SIZE * 0.18);
      points.push(startPos, stopPos, enterPoint, midPoint, exitEnter, exitStop, endPos);
    } else {
      const mid1 = new THREE.Vector3().lerpVectors(enterPoint, exitEnter, 0.33);
      const mid2 = new THREE.Vector3().lerpVectors(enterPoint, exitEnter, 0.67);
      points.push(startPos, stopPos, enterPoint, mid1, mid2, exitEnter, exitStop, endPos);
    }
  }

  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4);
  return { approach, turn, curve, length: curve.getLength(), laneOffset: offset };
}
