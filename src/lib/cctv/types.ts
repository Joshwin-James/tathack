// TypeScript Type Definitions for Real-Time Vision AI CCTV Analytics

export type TargetClass = "car" | "truck" | "bus" | "motorcycle" | "person";

export const TARGET_CLASSES: TargetClass[] = ["car", "truck", "bus", "motorcycle", "person"];

export const CLASS_COLORS: Record<TargetClass, { stroke: string; fill: string; text: string; bg: string }> = {
  car: { stroke: "#38bdf8", fill: "rgba(56, 189, 248, 0.18)", text: "#e0f2fe", bg: "#0284c7" },
  bus: { stroke: "#f59e0b", fill: "rgba(245, 158, 11, 0.18)", text: "#fef3c7", bg: "#d97706" },
  truck: { stroke: "#ef4444", fill: "rgba(239, 68, 68, 0.22)", text: "#fee2e2", bg: "#dc2626" },
  motorcycle: { stroke: "#a855f7", fill: "rgba(168, 85, 247, 0.18)", text: "#f3e8ff", bg: "#9333ea" },
  person: { stroke: "#10b981", fill: "rgba(16, 185, 129, 0.22)", text: "#d1fae5", bg: "#059669" },
};

export interface RawDetection {
  bbox: [number, number, number, number]; // [x, y, width, height] in normalized coordinates [0..1]
  class: TargetClass;
  score: number;
}

export interface TrackedObject {
  id: number;
  class: TargetClass;
  score: number;
  bbox: [number, number, number, number]; // [x, y, width, height] normalized
  centroid: [number, number]; // [x, y] normalized
  history: [number, number][]; // Centroid history trail (last 15 points)
  firstSeen: number; // timestamp ms
  lastSeen: number; // timestamp ms
  stationarySince: number | null; // timestamp when it stopped moving
  speed: number; // normalized units / sec
  isStalled: boolean;
  crossedLine: boolean;
}

export interface CountingLine {
  p1: [number, number]; // [x, y] normalized (0..1)
  p2: [number, number]; // [x, y] normalized (0..1)
}

export type CongestionLevel = "Low" | "Medium" | "High";

export interface IncidentAlert {
  id: string;
  type: "stalled_vehicle" | "pedestrian_danger" | "congestion_spike";
  title: string;
  description: string;
  severity: "critical" | "warning";
  timestamp: number;
  cameraId: string;
  location: string;
  trackId?: number;
}

export interface CameraAnalyticsState {
  cameraId: string;
  fps: number;
  objectsInFrame: number;
  classCounts: Record<TargetClass, number>;
  totalPassed: number;
  congestion: CongestionLevel;
  avgSpeed: number;
  densityHistory: { time: string; density: number }[];
  activeIncident: IncidentAlert | null;
  lastIncident: IncidentAlert | null;
  tracks: TrackedObject[];
}
