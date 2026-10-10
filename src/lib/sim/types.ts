// Pure TypeScript types for 3D Green Corridor Simulator with Turning Road Graph & Preemption State Machine

export type VehicleType = "ambulance" | "fire" | "police";

export type SignalPhase = "green" | "yellow" | "red";

export type JunctionPreemptionState =
  | "NORMAL"
  | "PREEMPT_REQUESTED"
  | "ALL_RED_CLEARANCE"
  | "EMERGENCY_GREEN"
  | "RECOVERY";

export interface SignalHead {
  id: string;
  junctionId: string;
  approach: "north" | "south" | "east" | "west";
  phase: SignalPhase;
  countdown: number;
}

export interface Junction {
  id: string;
  name: string;
  x: number; // World X position
  z: number; // World Z position
  mainHeading: number; // Heading angle in radians (0 = +X East, PI/2 = +Z South)
  turnType?: "straight" | "right" | "left" | "curve";
  incomingApproach: "west" | "north" | "south" | "east";
  outgoingApproach: "east" | "south" | "north" | "west";
  preemptionState: JunctionPreemptionState;
  stateTimer: number; // Timer for current preemption state
  signals: {
    ambulanceApproach: SignalPhase;
    opposingApproach: SignalPhase;
    crossApproachA: SignalPhase;
    crossApproachB: SignalPhase;
    normalTimer: number;
    cycleDuration: number;
    normalMainPhase: SignalPhase;
    normalCrossPhase: SignalPhase;
  };
  cleared: boolean;
  preemptedOnce: boolean;
}

export interface SimCar {
  id: string;
  laneIndex: number; // 0 = slow left, 1 = fast left, 2 = fast right (oncoming), 3 = slow right (oncoming)
  roadSegmentId: string;
  distanceAlongRoad: number; // Distance along current road segment or spline
  x: number;
  z: number;
  heading: number; // Radians
  roll: number; // Banking angle in radians
  speed: number;
  maxSpeed: number;
  targetSpeed: number;
  color: string;
  isYielding: boolean;
  yieldTimer: number;
  lateralOffset: number; // Smoothed lateral shift for yielding / overtaking
  targetLateralOffset: number;
  stoppedAtSignal: boolean;
  isTurnVehicle: boolean;
  turnDirection?: "left" | "right" | "straight";
  collisionRadius: number;
}

export interface EmergencyVehicle {
  type: VehicleType;
  x: number;
  z: number;
  heading: number;
  roll: number; // Banking angle in radians during turns
  speed: number; // units/s
  maxSpeed: number;
  progress: number; // 0 to 1 along spline route
  distanceTraveled: number;
  distanceRemaining: number;
  currentJunctionIndex: number;
  status: "idle" | "en_route" | "arrived";
  redLightsHit: number;
  redLightsAvoided: number;
  timeSpentWaitingAtRed: number;
  totalTime: number; // Seconds
  isOvertaking: boolean;
  overtakeTargetOffset: number;
  currentLateralOffset: number;
  collisionRadius: number;
}

export interface DecisionLogEntry {
  id: string;
  timestamp: string;
  junctionName: string;
  action: string;
  detail: string;
  type: "preempt" | "clearance" | "emergency_green" | "restore" | "yield" | "overtake" | "dispatch" | "arrival";
}

export type ScenarioPreset = "normal" | "rush_hour" | "edappally_congestion";

export type CameraMode = "chase" | "top_down" | "cinematic" | "orbit";

export interface SimConfig {
  greenCorridorActive: boolean;
  vehicleType: VehicleType;
  scenario: ScenarioPreset;
  speedMultiplier: number; // 0.5, 1, 2, 4
  preemptionDistance: number; // ~150 units
  yieldDistance: number; // ~60 units
  showCollisionBoxes: boolean;
}

export interface SimMetrics {
  elapsedTimeSec: number;
  etaSec: number;
  speedKmh: number;
  distanceRemainingMeters: number;
  completedJunctions: number;
  totalJunctions: number;
  redLightsHit: number;
  redLightsAvoided: number;
  timeSavedSec: number;
  timeSavedPercent: number;
  avgSpeedKmh: number;
  signalsPreempted: number;
}
