// Typed Emergency Mission State across /twin, /citizen and /hospital
export type MissionStatus = "idle" | "dispatched" | "enroute" | "arrived" | "completed";

export type PatientSeverity = "critical" | "high" | "moderate";

export interface MissionPatient {
  severity: PatientSeverity;
  age: number;
  condition: string;
  bloodGroup: string;
  isSimulated: boolean;
  vitals?: {
    heartRate: number;
    bp: string;
    spo2: number;
    gcs: number;
  };
}

export interface MissionJunctionState {
  name: string;
  state: "NORMAL" | "PREEMPT_REQUESTED" | "ALL_RED_CLEARANCE" | "EMERGENCY_GREEN" | "RECOVERY";
  phase?: "red" | "yellow" | "green";
  distanceToJunctionM?: number;
}

export interface MissionState {
  id: string;
  status: MissionStatus;
  vehicleType: "ambulance" | "police" | "fire";
  patient: MissionPatient;
  origin: string;
  destination: string;
  etaSeconds: number;
  distanceMeters: number;
  nextJunction: string;
  distanceToNextJunctionM: number;
  junctions: MissionJunctionState[];
  position: { lat: number; lng: number };
  startedAt: number;
  updatedAt: number;
  speedKmh: number;
  trafficYieldCount?: number;
  redLightsAvoided?: number;
}
