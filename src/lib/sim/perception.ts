// Deterministic Multi-Sensor Perception, Intent Prediction & TTC Safety Engine
import { CorridorSimulation } from "./corridor-sim";
import { CORRIDOR_JUNCTION_NODES } from "./road-graph";
import { SimCar, EmergencyVehicle, Junction } from "./types";

export type SensorMode = "lidar" | "segments" | "depth";

export interface TurnIntent {
  straight: number; // 0..100
  left: number; // 0..100
  right: number; // 0..100
  yielding: number; // 0..100
}

export interface PerceptionAgent {
  id: string;
  type: "ambulance" | "car" | "cyclist" | "pedestrian";
  label: string;
  typeLabel: string; // "vehicle" | "pedestrian" | "bicycle" | "emergency"
  position: [number, number, number];
  velocity: [number, number, number];
  speedKmh: number;
  heading: number;
  roll: number;
  statusBadge: "SAFE" | "WAIT" | "ALERT";
  headline: string;
  explanation: string;
  distToZoneCenter: number;
  distToAmbulance: number;
  inZone: boolean;
  isYielding: boolean;
  stoppedAtSignal: boolean;
  followingText: string;
  followingGapMeters: number;
  nextJunctionName: string;
  distToNextJunctionM: number;
  signalCountdown: string;
  approachName: string;
  turnIntent: TurnIntent;
  dimensions: [number, number, number]; // [length, height, width]
  hasTtcWarning: boolean;
  ttcSec: number | null;
  color: string;
}

export interface TtcAlert {
  id: string;
  agentId1: string;
  agentId2: string;
  label1: string;
  label2: string;
  ttcSec: number;
  closingSpeedKmh: number;
  distanceMeters: number;
  severity: "critical" | "warning";
  detail: string;
}

export interface PerceptionAnalytics {
  pedCount: number;
  carCount: number;
  cycCount: number;
  zoneRadiusM: number;
  trackedCount: number;
  pointsCount: number;
  closeCallsCount: number;
  activeAlerts: TtcAlert[];
  signalsPreempted: number;
  corridorTimeSavedSec: number;
  etaSec: number;
  fps: number;
}

// Compute deterministic turn intent from car lane, road topology, and yielding state
export function computeAgentIntent(car: SimCar, nextJunction?: Junction): TurnIntent {
  if (car.isYielding) {
    return {
      straight: 10,
      left: 2,
      right: 8,
      yielding: 80,
    };
  }

  if (car.stoppedAtSignal) {
    return {
      straight: 76,
      left: 16,
      right: 8,
      yielding: 0,
    };
  }

  // Derive intent from lane index
  const isTurn = car.isTurnVehicle;
  if (isTurn) {
    if (car.turnDirection === "left") {
      return { straight: 15, left: 80, right: 5, yielding: 0 };
    }
    if (car.turnDirection === "right") {
      return { straight: 10, left: 5, right: 85, yielding: 0 };
    }
  }

  if (car.laneIndex === 0 || car.laneIndex === 3) {
    return { straight: 72, left: 20, right: 8, yielding: 0 };
  } else {
    return { straight: 84, left: 10, right: 6, yielding: 0 };
  }
}

// Calculate pairwise Time-To-Collision (TTC) using relative Euclidean position and velocity vectors
export function computePairwiseTtc(
  pA: [number, number, number],
  vA: [number, number, number],
  radA: number,
  pB: [number, number, number],
  vB: [number, number, number],
  radB: number
): { isClosing: boolean; ttcSec: number | null; distance: number; closingSpeed: number } {
  // Horizontal 2D plane (X, Z)
  const dx = pB[0] - pA[0];
  const dz = pB[2] - pA[2];
  const dist = Math.sqrt(dx * dx + dz * dz);

  // Relative velocity vector (vB - vA)
  const dvx = vB[0] - vA[0];
  const dvz = vB[2] - vA[2];

  // Dot product of relative displacement (A -> B) and relative velocity of B relative to A
  const dot = dx * dvx + dz * dvz;
  const isClosing = dot < -0.01;

  const relSpeedSq = dvx * dvx + dvz * dvz;
  const relSpeed = Math.sqrt(relSpeedSq);

  if (!isClosing || relSpeed < 0.2) {
    return { isClosing: false, ttcSec: null, distance: dist, closingSpeed: 0 };
  }

  const closingComponent = -dot / dist;
  const clearance = Math.max(0, dist - (radA + radB));
  const ttc = closingComponent > 0.1 ? clearance / closingComponent : null;

  return {
    isClosing: true,
    ttcSec: ttc !== null && ttc < 20 ? Math.round(ttc * 10) / 10 : null,
    distance: Math.round(dist * 10) / 10,
    closingSpeed: Math.round(closingComponent * 3.6),
  };
}

// Fixed sidewalks & crosswalk definitions for pedestrians and cyclists
const SYNTHETIC_PEDESTRIANS = [
  { id: "ped-01", base: [-160, 0.4, -48], dir: [0, 1], speed: 4.2, label: "PED 07" },
  { id: "ped-02", base: [-145, 0.4, -58], dir: [1, 0], speed: 3.8, label: "PED 12" },
  { id: "ped-03", base: [-60, 0.4, -48], dir: [0, 1], speed: 4.5, label: "PED 18" },
  { id: "ped-04", base: [-40, 0.4, -58], dir: [1, 0], speed: 3.6, label: "PED 21" },
  { id: "ped-05", base: [60, 0.4, -18], dir: [0, 1], speed: 4.0, label: "PED 34" },
  { id: "ped-06", base: [80, 0.4, 2], dir: [1, 0], speed: 4.6, label: "PED 39" },
  { id: "ped-07", base: [140, 0.4, 18], dir: [0, 1], speed: 3.9, label: "PED 44" },
  { id: "ped-08", base: [160, 0.4, 2], dir: [-1, 0], speed: 4.1, label: "PED 52" },
];

const SYNTHETIC_CYCLISTS = [
  { id: "cyc-01", base: [-170, 0.5, -44], heading: 0, speed: 18.0, label: "CYC 03" },
  { id: "cyc-02", base: [-70, 0.5, -44], heading: 0, speed: 20.5, label: "CYC 09" },
  { id: "cyc-03", base: [50, 0.5, -6], heading: Math.PI / 2, speed: 16.0, label: "CYC 14" },
  { id: "cyc-04", base: [130, 0.5, 14], heading: 0, speed: 19.2, label: "CYC 27" },
];

// Extract full set of perception-tracked agents and run safety checks
export function extractPerceptionState(
  sim: CorridorSimulation,
  zoneCenter: [number, number],
  zoneRadius: number
): {
  agents: PerceptionAgent[];
  activeAlerts: TtcAlert[];
  ambulanceAgent: PerceptionAgent;
} {
  const v = sim.vehicle;
  const junctions = sim.junctions;
  const t = sim.elapsedTime;

  // Velocity vectors
  const ambVx = Math.cos(v.heading) * v.speed;
  const ambVz = Math.sin(v.heading) * v.speed;
  const ambPos: [number, number, number] = [v.x, 0.8, v.z];

  const ambDistToCenter = Math.hypot(v.x - zoneCenter[0], v.z - zoneCenter[1]);

  // Next junction info for ambulance
  const nextJunctionNode = CORRIDOR_JUNCTION_NODES[v.currentJunctionIndex] || CORRIDOR_JUNCTION_NODES[0];
  const nextJunction = junctions[v.currentJunctionIndex] || junctions[0];
  const distToNextJunctionM = Math.max(0, Math.round((nextJunctionNode.routeDistance - v.distanceTraveled) * 4.5));

  let ambSignalCountdown = "CLEAR CORRIDOR";
  if (nextJunction.preemptionState === "EMERGENCY_GREEN") {
    ambSignalCountdown = "preempted · green for emergency";
  } else if (nextJunction.preemptionState === "ALL_RED_CLEARANCE") {
    ambSignalCountdown = "all-red · clearing corridor";
  } else {
    ambSignalCountdown = `hold · ${nextJunction.signals.ambulanceApproach.toLowerCase()} phase`;
  }

  const ambulanceAgent: PerceptionAgent = {
    id: "ambulance-lead",
    type: "ambulance",
    label: "AMB 01",
    typeLabel: "emergency",
    position: ambPos,
    velocity: [ambVx, 0, ambVz],
    speedKmh: Math.round(v.speed * 2.8),
    heading: v.heading,
    roll: v.roll,
    statusBadge: "SAFE",
    headline: "Leading emergency corridor",
    explanation: `Active preemption engaged. Approaching ${nextJunctionNode.name} (${distToNextJunctionM} m).`,
    distToZoneCenter: ambDistToCenter,
    distToAmbulance: 0,
    inZone: ambDistToCenter <= zoneRadius,
    isYielding: false,
    stoppedAtSignal: false,
    followingText: "none (lead vehicle)",
    followingGapMeters: 0,
    nextJunctionName: nextJunctionNode.name,
    distToNextJunctionM,
    signalCountdown: ambSignalCountdown,
    approachName: "west approach",
    turnIntent: { straight: 95, left: 3, right: 2, yielding: 0 },
    dimensions: [5.2, 2.2, 2.2],
    hasTtcWarning: false,
    ttcSec: null,
    color: "#ea580c",
  };

  const agents: PerceptionAgent[] = [ambulanceAgent];
  const activeAlerts: TtcAlert[] = [];

  // 1. Process Traffic Cars
  sim.cars.forEach((car, idx) => {
    const carVx = Math.cos(car.heading) * car.speed;
    const carVz = Math.sin(car.heading) * car.speed;
    const carPos: [number, number, number] = [car.x, 0.6, car.z];

    const distToCenter = Math.hypot(car.x - zoneCenter[0], car.z - zoneCenter[1]);
    const inZone = distToCenter <= zoneRadius;
    const distToAmbulance = Math.hypot(car.x - v.x, car.z - v.z);

    // Find closest junction ahead
    let closestJunction = CORRIDOR_JUNCTION_NODES[0];
    let minJunctionDist = 9999;
    CORRIDOR_JUNCTION_NODES.forEach((jn) => {
      const d = Math.hypot(car.x - jn.x, car.z - jn.z);
      if (d < minJunctionDist) {
        minJunctionDist = d;
        closestJunction = jn;
      }
    });

    const junctionObj = junctions.find((j) => j.id === closestJunction.id);
    let signalCountdown = "green · free flow";
    if (junctionObj) {
      if (junctionObj.preemptionState === "EMERGENCY_GREEN") {
        signalCountdown = "preempted · green in 0.0 s";
      } else if (junctionObj.signals.ambulanceApproach === "red") {
        const remaining = Math.max(0, 14 - junctionObj.signals.normalTimer);
        signalCountdown = `red · green in ${remaining.toFixed(1)} s`;
      } else {
        const remaining = Math.max(0, 11 - junctionObj.signals.normalTimer);
        signalCountdown = `green · red in ${remaining.toFixed(1)} s`;
      }
    }

    const turnIntent = computeAgentIntent(car, junctionObj);

    let statusBadge: "SAFE" | "WAIT" | "ALERT" = "SAFE";
    let headline = "Moving in corridor";
    let explanation = `Cruising eastbound at ${Math.round(car.speed * 2.8)} km/h. Clear of conflicts.`;

    const carAheadId = idx > 0 ? `CAR ${String(idx).padStart(2, "0")}` : "lead";
    const gapM = Math.round(10 + (idx % 4) * 4);

    if (car.isYielding) {
      statusBadge = "WAIT";
      headline = "Yielding to corridor";
      explanation = `Shifted to shoulder lane (${gapM} m clear). Yielding to approaching AMB 01.`;
    } else if (car.stoppedAtSignal) {
      statusBadge = "WAIT";
      headline = "Holding at red";
      explanation = `Stopped 14 m before the line. ${signalCountdown}, then it will go straight.`;
    } else if (minJunctionDist < 8) {
      statusBadge = "SAFE";
      headline = "Crossing the junction";
      explanation = `Inside the junction at ${Math.round(car.speed * 2.8)} km/h, clear.`;
    } else if (minJunctionDist < 18 && car.speed > 8) {
      statusBadge = "SAFE";
      headline = "Leaving the junction";
      explanation = `Clear of the intersection, eastbound at ${Math.round(car.speed * 2.8)} km/h.`;
    } else if (idx % 3 === 0 && car.speed < 4) {
      statusBadge = "WAIT";
      headline = `Queued behind ${carAheadId}`;
      explanation = `Waiting ${gapM} m behind the vehicle ahead. ${signalCountdown}.`;
    }

    // Pairwise TTC Check against Emergency Vehicle
    let hasTtcWarning = false;
    let ttcSec: number | null = null;

    if (inZone && distToAmbulance < 65) {
      const ttcRes = computePairwiseTtc(
        carPos,
        [carVx, 0, carVz],
        car.collisionRadius,
        ambPos,
        [ambVx, 0, ambVz],
        v.collisionRadius
      );

      if (ttcRes.isClosing && ttcRes.ttcSec !== null && ttcRes.ttcSec <= 2.5) {
        hasTtcWarning = true;
        ttcSec = ttcRes.ttcSec;
        statusBadge = "ALERT";
        headline = "Yielding to Ambulance";
        explanation = `TTC ${ttcRes.ttcSec}s to AMB 01. Pulling into left shoulder.`;

        const alert: TtcAlert = {
          id: `ttc-${car.id}-amb`,
          agentId1: car.id,
          agentId2: ambulanceAgent.id,
          label1: `CAR ${String(idx + 1).padStart(2, "0")}`,
          label2: "AMB 01",
          ttcSec: ttcRes.ttcSec,
          closingSpeedKmh: ttcRes.closingSpeed,
          distanceMeters: Math.round(ttcRes.distance * 4.5),
          severity: ttcRes.ttcSec < 1.6 ? "critical" : "warning",
          detail: car.isYielding ? "Yielding maneuver in progress" : "Obstruction detected ahead of corridor",
        };
        activeAlerts.push(alert);
      }
    }

    agents.push({
      id: car.id,
      type: "car",
      label: `CAR ${String(idx + 1).padStart(2, "0")}`,
      typeLabel: "vehicle",
      position: carPos,
      velocity: [carVx, 0, carVz],
      speedKmh: Math.round(car.speed * 2.8),
      heading: car.heading,
      roll: car.roll,
      statusBadge,
      headline,
      explanation,
      distToZoneCenter: distToCenter,
      distToAmbulance,
      inZone,
      isYielding: car.isYielding,
      stoppedAtSignal: car.stoppedAtSignal,
      followingText: `${carAheadId} (${gapM} m)`,
      followingGapMeters: gapM,
      nextJunctionName: closestJunction.name,
      distToNextJunctionM: Math.round(minJunctionDist * 4.5),
      signalCountdown,
      approachName: car.heading < Math.PI / 2 ? "west approach" : "east approach",
      turnIntent,
      dimensions: [4.2, 1.6, 1.9],
      hasTtcWarning,
      ttcSec,
      color: car.color,
    });
  });

  // 2. Process Pedestrians
  SYNTHETIC_PEDESTRIANS.forEach((ped, pIdx) => {
    // Oscillation along sidewalk
    const offset = Math.sin(t * 0.8 + pIdx * 1.5) * 8;
    const px = ped.base[0] + ped.dir[0] * offset;
    const pz = ped.base[2] + ped.dir[1] * offset;
    const pos: [number, number, number] = [px, 0.4, pz];

    const distToCenter = Math.hypot(px - zoneCenter[0], pz - zoneCenter[1]);
    const inZone = distToCenter <= zoneRadius;
    const distToAmb = Math.hypot(px - v.x, pz - v.z);

    const isCrossing = Math.abs(offset) < 2;
    const headline = isCrossing ? "Crossing on walk" : (pIdx % 2 === 0 ? "On the sidewalk" : "Waiting to cross");
    const explanation = isCrossing
      ? "Crossing at crosswalk, clear of traffic path."
      : (pIdx % 2 === 0
        ? "Walking at 4 km/h, not heading into traffic."
        : "Walk signal in about 6.0 s. Standing at curb.");

    agents.push({
      id: ped.id,
      type: "pedestrian",
      label: ped.label,
      typeLabel: "pedestrian",
      position: pos,
      velocity: [ped.dir[0] * 1.1, 0, ped.dir[1] * 1.1],
      speedKmh: Math.round(ped.speed),
      heading: ped.dir[0] !== 0 ? 0 : Math.PI / 2,
      roll: 0,
      statusBadge: isCrossing ? "WAIT" : "SAFE",
      headline,
      explanation,
      distToZoneCenter: distToCenter,
      distToAmbulance: distToAmb,
      inZone,
      isYielding: false,
      stoppedAtSignal: !isCrossing,
      followingText: "none (pedestrian path)",
      followingGapMeters: 12,
      nextJunctionName: "Pedestrian Crosswalk",
      distToNextJunctionM: Math.round(Math.abs(offset) * 2),
      signalCountdown: isCrossing ? "walk · 8.2 s remaining" : "don't walk · 6.0 s",
      approachName: "sidewalk node",
      turnIntent: { straight: 92, left: 4, right: 4, yielding: 0 },
      dimensions: [0.6, 1.8, 0.6],
      hasTtcWarning: false,
      ttcSec: null,
      color: "#38bdf8",
    });
  });

  // 3. Process Cyclists
  SYNTHETIC_CYCLISTS.forEach((cyc, cIdx) => {
    const cycDist = ((t * cyc.speed * 0.4 + cIdx * 60) % 350) - 150;
    const cx = cyc.heading === 0 ? cycDist : cyc.base[0];
    const cz = cyc.heading === 0 ? cyc.base[2] : cycDist;
    const pos: [number, number, number] = [cx, 0.5, cz];

    const distToCenter = Math.hypot(cx - zoneCenter[0], cz - zoneCenter[1]);
    const inZone = distToCenter <= zoneRadius;
    const distToAmb = Math.hypot(cx - v.x, cz - v.z);

    agents.push({
      id: cyc.id,
      type: "cyclist",
      label: cyc.label,
      typeLabel: "bicycle",
      position: pos,
      velocity: [Math.cos(cyc.heading) * 4.5, 0, Math.sin(cyc.heading) * 4.5],
      speedKmh: Math.round(cyc.speed),
      heading: cyc.heading,
      roll: 0,
      statusBadge: "SAFE",
      headline: "In bike lane",
      explanation: `Riding in dedicated bike shoulder at ${Math.round(cyc.speed)} km/h.`,
      distToZoneCenter: distToCenter,
      distToAmbulance: distToAmb,
      inZone,
      isYielding: false,
      stoppedAtSignal: false,
      followingText: "none (bike path)",
      followingGapMeters: 18,
      nextJunctionName: "Kaloor North Lane",
      distToNextJunctionM: 25,
      signalCountdown: "green · 12.0 s",
      approachName: "shoulder lane",
      turnIntent: { straight: 88, left: 6, right: 6, yielding: 0 },
      dimensions: [1.8, 1.4, 0.7],
      hasTtcWarning: false,
      ttcSec: null,
      color: "#10b981",
    });
  });

  // If ambulance has any active TTC alert against it, set badge to ALERT
  if (activeAlerts.length > 0) {
    ambulanceAgent.statusBadge = "ALERT";
    ambulanceAgent.hasTtcWarning = true;
    ambulanceAgent.ttcSec = activeAlerts[0].ttcSec;
  }

  return {
    agents,
    activeAlerts,
    ambulanceAgent,
  };
}
