import * as THREE from 'three';
import type {
  VehicleState,
  VehicleKind,
  LanePath,
  SignalGroup,
  Direction,
  TurnType,
  SignalState,
  SnapshotData,
  SimulationMode,
  ScenarioPreset,
  ApproachMetrics,
  TrafficDemandConfig,
  VehicleMixConfig,
  AdaptiveDecision,
  ComparisonResult,
  StopReason,
} from './types';
import {
  VEHICLE_SPECS,
  randomCarColor,
  createSignalGroups,
  buildLanePath,
  MAX_VEHICLES,
  FIXED_DT,
  STOP_LINE_OFFSET,
  ROAD_LENGTH,
  YELLOW_DURATION,
  ALL_RED_BUFFER,
  MIN_ADAPTIVE_GREEN,
  MAX_ADAPTIVE_GREEN,
  DEFAULT_FIXED_GREEN,
  MAX_WAIT_STARVATION,
  BOX_CLEARANCE_RADIUS,
  SCENARIO_DEMANDS,
  SCENARIO_VEHICLE_MIXES,
} from './constants';

const APPROACHES: Direction[] = ['north', 'south', 'east', 'west'];
const TURNS: TurnType[] = ['straight', 'left', 'right'];

let nextVehicleId = 1;

const TURN_SPEED_FACTOR: Record<TurnType, number> = {
  straight: 1.0,
  right: 0.55,
  left: 0.45,
};

export type ControllerPhase =
  | 'NS_GREEN'
  | 'NS_AMBER'
  | 'NS_ALL_RED'
  | 'EW_GREEN'
  | 'EW_AMBER'
  | 'EW_ALL_RED';

export class TrafficEngine {
  vehicles: VehicleState[] = [];
  signalGroups: SignalGroup[] = createSignalGroups('adaptive');
  mode: SimulationMode = 'adaptive';
  activeScenario: ScenarioPreset = 'balanced';

  // Authoritative Traffic Signal Phasing Controller
  controllerPhase: ControllerPhase = 'NS_GREEN';
  phaseTimer = 0;
  currentGreenDuration = 16;
  nextGreenDuration = 16;

  // Configurable traffic demand (vehicles per minute per direction)
  demand: TrafficDemandConfig = { ...SCENARIO_DEMANDS.balanced };
  vehicleMix: VehicleMixConfig = { ...SCENARIO_VEHICLE_MIXES.balanced };
  allowedTurns: Record<TurnType, boolean> = { straight: true, left: true, right: true };
  downstreamBlocked: Record<Direction, boolean> = { north: false, south: false, east: false, west: false };
  congestionOverlays = true;
  debugMode = false;

  // Emergency corridor
  emergencyActive = false;
  emergencyPhase = 0; // 0=idle, 1=preempting, 1.5=amber, 2=corridor green, 3=returning
  emergencyTimer = 0;
  emergencyApproach: Direction | null = null;
  private ambulanceSpawned = false;
  ambulanceId: number | null = null;

  // Operational metrics & timers
  private spawnAccumulators: Record<Direction, number> = { north: 0, south: 0, east: 0, west: 0 };
  private simTime = 0;
  totalSpawned = 0;
  totalExited = 0;
  throughputPerMin = 0;
  avgSpeedKmh = 0;

  // Adaptive reasoning & decision log
  adaptiveReasoning = 'Adaptive AI Controller active. Phase allocated to North/South corridor.';
  adaptiveDecisions: AdaptiveDecision[] = [];

  // Approach metrics cache
  approachMetrics: Record<Direction, ApproachMetrics> = {
    north: this.createEmptyMetrics('north'),
    south: this.createEmptyMetrics('south'),
    east: this.createEmptyMetrics('east'),
    west: this.createEmptyMetrics('west'),
  };

  paused = false;
  simSpeed = 1.0;

  private pathCache: Map<string, LanePath> = new Map();

  constructor() {
    this.buildPathCache();
    this.initSignals();
  }

  private initSignals() {
    this.controllerPhase = 'NS_GREEN';
    this.phaseTimer = 0;
    this.currentGreenDuration = this.mode === 'adaptive' ? 16 : DEFAULT_FIXED_GREEN;
    this.syncSignalGroupStates();
  }

  private createEmptyMetrics(approach: Direction): ApproachMetrics {
    return {
      approach,
      queueCount: 0,
      queueLengthMeters: 0,
      avgWaitTimeSec: 0,
      maxWaitTimeSec: 0,
      stoppedVehicles: 0,
      passedCount: 0,
      downstreamOccupancy: 0,
      congestionLevel: 'low',
    };
  }

  private buildPathCache() {
    for (const a of APPROACHES) {
      for (const t of TURNS) {
        const key = `${a}-${t}`;
        this.pathCache.set(key, buildLanePath(a, t));
      }
    }
  }

  getPath(approach: Direction, turn: TurnType): LanePath {
    const path = this.pathCache.get(`${approach}-${turn}`);
    if (!path) {
      // Fallback build if not cached
      const newPath = buildLanePath(approach, turn);
      this.pathCache.set(`${approach}-${turn}`, newPath);
      return newPath;
    }
    return path;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  setSpeed(factor: number) {
    this.simSpeed = Math.max(0.25, Math.min(4.0, factor));
  }

  setMode(newMode: SimulationMode) {
    this.mode = newMode;
    this.signalGroups = createSignalGroups(newMode);
    this.initSignals();
    this.logDecision(
      `Switched to ${newMode === 'adaptive' ? 'Adaptive AI Control' : 'Fixed-Time Control'} mode.`,
      newMode === 'adaptive' ? 'Adaptive queue-responsive timing' : 'Fixed cycle: 15s NS / 15s EW'
    );
  }

  setScenario(preset: ScenarioPreset) {
    this.activeScenario = preset;
    if (preset !== 'custom') {
      this.demand = { ...SCENARIO_DEMANDS[preset] };
      this.vehicleMix = { ...SCENARIO_VEHICLE_MIXES[preset] };
      this.downstreamBlocked = {
        north: false,
        south: false,
        east: false,
        west: preset === 'downstream_block',
      };
    }
    if (preset === 'emergency_corridor') {
      this.activateEmergency('south');
    } else if (this.emergencyActive) {
      this.deactivateEmergency();
    }
    this.logDecision(
      `Scenario activated: ${preset.replace('_', ' ').toUpperCase()}`,
      `N:${this.demand.north} S:${this.demand.south} E:${this.demand.east} W:${this.demand.west} veh/min`
    );
  }

  setDirectionDemand(direction: Direction, rateVehPerMin: number) {
    this.demand[direction] = Math.max(0, Math.min(60, rateVehPerMin));
    this.activeScenario = 'custom';
  }

  setVehicleMix(carPct: number, busPct: number, motoPct: number) {
    const total = carPct + busPct + motoPct || 1;
    this.vehicleMix = {
      car: carPct / total,
      bus: busPct / total,
      motorcycle: motoPct / total,
    };
    this.activeScenario = 'custom';
  }

  setDownstreamBlock(direction: Direction, isBlocked: boolean) {
    this.downstreamBlocked[direction] = isBlocked;
    this.activeScenario = 'custom';
  }

  toggleTurn(turn: TurnType, enabled: boolean) {
    this.allowedTurns[turn] = enabled;
  }

  reset() {
    this.vehicles = [];
    this.signalGroups = createSignalGroups(this.mode);
    this.initSignals();
    this.emergencyActive = false;
    this.emergencyPhase = 0;
    this.emergencyTimer = 0;
    this.emergencyApproach = null;
    this.ambulanceSpawned = false;
    this.ambulanceId = null;
    this.simTime = 0;
    this.totalSpawned = 0;
    this.totalExited = 0;
    this.throughputPerMin = 0;
    this.avgSpeedKmh = 0;
    this.spawnAccumulators = { north: 0, south: 0, east: 0, west: 0 };
    this.adaptiveDecisions = [];
    this.approachMetrics = {
      north: this.createEmptyMetrics('north'),
      south: this.createEmptyMetrics('south'),
      east: this.createEmptyMetrics('east'),
      west: this.createEmptyMetrics('west'),
    };
    nextVehicleId = 1;
    this.logDecision('Simulation reset to initial conditions.', 'All queues and signals reset.');
  }

  private logDecision(reason: string, summary: string, allocatedGreen = 0) {
    const activeGroup = this.signalGroups.find((g) => g.state === 'green')?.id || 'TRANSITION';
    const decision: AdaptiveDecision = {
      id: `DEC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Math.round(this.simTime),
      phase: activeGroup,
      reason,
      allocatedGreen,
      queueSummary: summary,
    };
    this.adaptiveReasoning = reason;
    this.adaptiveDecisions.unshift(decision);
    if (this.adaptiveDecisions.length > 25) {
      this.adaptiveDecisions.pop();
    }
  }

  getSignalState(approach: Direction): SignalState {
    for (const g of this.signalGroups) {
      if (g.approaches.includes(approach)) return g.state;
    }
    return 'red';
  }

  getSignalTimer(approach: Direction): number {
    for (const g of this.signalGroups) {
      if (g.approaches.includes(approach)) return Math.max(0, g.phaseRemaining);
    }
    return 0;
  }

  stopLineDistance(_vehicle?: VehicleState): number {
    return ROAD_LENGTH - STOP_LINE_OFFSET;
  }

  intersectionEntryDistance(_vehicle?: VehicleState): number {
    return ROAD_LENGTH - STOP_LINE_OFFSET + 2;
  }

  intersectionExitDistance(vehicle?: VehicleState): number {
    return this.intersectionEntryDistance(vehicle) + 20;
  }

  getExitDirection(vehicle: VehicleState): Direction {
    const app = vehicle.path.approach;
    const turn = vehicle.path.turn;
    if (turn === 'straight') {
      const opposite: Record<Direction, Direction> = { north: 'south', south: 'north', east: 'west', west: 'east' };
      return opposite[app];
    }
    if (turn === 'right') {
      const rightMap: Record<Direction, Direction> = { north: 'east', south: 'west', east: 'south', west: 'north' };
      return rightMap[app];
    }
    const leftMap: Record<Direction, Direction> = { north: 'west', south: 'east', east: 'north', west: 'south' };
    return leftMap[app];
  }

  /**
   * Yellow Box / Don't Block the Box Rule:
   * Prevents vehicles from entering the intersection if:
   * 1. Downstream exit road is blocked (spillback prevention)
   * 2. A genuinely CONFLICTING vehicle is currently occupying the junction path
   */
  isJunctionBlockedFor(vehicle: VehicleState): { blocked: boolean; reason: StopReason; detail: string } {
    if (vehicle.isEmergency) {
      return { blocked: false, reason: 'NONE', detail: 'Emergency vehicle has priority' };
    }

    // Check 1: Downstream Exit Blockage
    const exitApproach = this.getExitDirection(vehicle);
    if (this.downstreamBlocked[exitApproach]) {
      // Check if exit road has queued vehicles near the junction exit
      const exitBlocked = this.vehicles.some((other) => {
        if (other.id === vehicle.id) return false;
        if (other.phase === 'exit' && this.getExitDirection(other) === exitApproach) {
          return other.speed < 1.0 && other.distance < this.intersectionExitDistance(other) + 22;
        }
        return false;
      });
      if (exitBlocked) {
        return {
          blocked: true,
          reason: 'DOWNSTREAM_BLOCKED',
          detail: `Exit approach ${exitApproach.toUpperCase()} is blocked downstream (spillback protection)`,
        };
      }
    }

    // Check 2: Conflict with traversing vehicles inside the intersection box
    const junctionCenter = new THREE.Vector3(0, 0, 0);
    const myApproach = vehicle.path.approach;
    const myCorridor = myApproach === 'north' || myApproach === 'south' ? 'NS' : 'EW';

    for (const other of this.vehicles) {
      if (other.id === vehicle.id) continue;
      if (other.phase !== 'intersection') continue;

      const otherDistToCenter = other.position.distanceTo(junctionCenter);
      if (otherDistToCenter > BOX_CLEARANCE_RADIUS) continue;

      const otherApproach = other.path.approach;
      const otherCorridor = otherApproach === 'north' || otherApproach === 'south' ? 'NS' : 'EW';

      // Cross-corridor conflict (e.g. EW vehicle still clearing while NS has green)
      if (otherCorridor !== myCorridor) {
        return {
          blocked: true,
          reason: 'INTERSECTION_OCCUPIED',
          detail: `Clearing cross-traffic vehicle #${other.id} from ${otherApproach.toUpperCase()}`,
        };
      }

      // Same-corridor left-turn conflict: Unprotected left turn yields to oncoming straight traffic
      if (vehicle.path.turn === 'left' && otherApproach !== myApproach && other.path.turn === 'straight') {
        if (other.distance < this.intersectionExitDistance(other) - 4) {
          return {
            blocked: true,
            reason: 'INTERSECTION_OCCUPIED',
            detail: `Yielding left turn to oncoming straight vehicle #${other.id}`,
          };
        }
      }
    }

    return { blocked: false, reason: 'NONE', detail: 'Intersection clear' };
  }

  /**
   * Evaluates whether a vehicle approaching the stop line must stop.
   */
  shouldStopAtSignal(vehicle: VehicleState): { shouldStop: boolean; reason: StopReason; detail: string } {
    if (vehicle.isEmergency) {
      return { shouldStop: false, reason: 'NONE', detail: 'Priority Emergency' };
    }

    // Emergency corridor mode: stop all non-emergency traffic
    if (this.emergencyActive && this.emergencyPhase >= 2 && !vehicle.isEmergency) {
      return {
        shouldStop: true,
        reason: 'RED_SIGNAL',
        detail: 'Emergency vehicle priority preemption active',
      };
    }

    const signal = this.getSignalState(vehicle.path.approach);
    const distToStopLine = this.stopLineDistance(vehicle) - vehicle.distance;

    // RED signal: Must stop before stop line
    if (signal === 'red') {
      if (distToStopLine >= -0.5) {
        return {
          shouldStop: true,
          reason: 'RED_SIGNAL',
          detail: `Signal is RED for ${vehicle.path.approach.toUpperCase()}`,
        };
      }
      return { shouldStop: false, reason: 'NONE', detail: 'Committed past stop line' };
    }

    // AMBER signal: Stop if far enough back, proceed if dilemma zone committed
    if (signal === 'amber') {
      if (distToStopLine > 4.0) {
        return {
          shouldStop: true,
          reason: 'RED_SIGNAL',
          detail: `Signal is AMBER - stopping safely before stop line (${distToStopLine.toFixed(1)}m)`,
        };
      }
      return { shouldStop: false, reason: 'NONE', detail: 'Committed through amber' };
    }

    // GREEN signal: Check Yellow Box and Downstream Clearance
    if (signal === 'green') {
      if (distToStopLine > -0.5 && distToStopLine < 14) {
        const boxCheck = this.isJunctionBlockedFor(vehicle);
        if (boxCheck.blocked) {
          vehicle.isBlockedByBox = true;
          return { shouldStop: true, reason: boxCheck.reason, detail: boxCheck.detail };
        }
      }
      vehicle.isBlockedByBox = false;
      return { shouldStop: false, reason: 'NONE', detail: 'Green signal - path permitted' };
    }

    return { shouldStop: false, reason: 'NONE', detail: 'Unspecified' };
  }

  private sampleVehicleKind(): VehicleKind {
    const r = Math.random();
    const carThresh = this.vehicleMix.car;
    const busThresh = carThresh + this.vehicleMix.bus;

    if (r < carThresh) return 'car';
    if (r < busThresh) return 'bus';
    return 'motorcycle';
  }

  private sampleTurn(): TurnType {
    const activeTurns: TurnType[] = [];
    if (this.allowedTurns.straight) activeTurns.push('straight', 'straight');
    if (this.allowedTurns.right) activeTurns.push('right');
    if (this.allowedTurns.left) activeTurns.push('left');

    if (activeTurns.length === 0) return 'straight';
    return activeTurns[Math.floor(Math.random() * activeTurns.length)];
  }

  private isSpawnAreaClear(path: LanePath): boolean {
    const spawnPos = new THREE.Vector3();
    path.curve.getPointAt(0, spawnPos);
    const minHeadway = 14;

    for (const v of this.vehicles) {
      if (v.path.approach === path.approach) {
        if (v.distance < minHeadway) return false;
      }
      if (v.position.distanceTo(spawnPos) < minHeadway) return false;
    }
    return true;
  }

  spawnVehicle(approach: Direction, forcedTurn?: TurnType, forcedKind?: VehicleKind): VehicleState | null {
    if (this.vehicles.length >= MAX_VEHICLES) return null;

    const turn = forcedTurn || this.sampleTurn();
    const kind = forcedKind || this.sampleVehicleKind();
    const path = this.getPath(approach, turn);

    if (!forcedTurn && !this.isSpawnAreaClear(path)) return null;

    const specBase = VEHICLE_SPECS[kind];
    const spec = {
      ...specBase,
      color: randomCarColor(),
    };

    const pos = new THREE.Vector3();
    path.curve.getPointAt(0, pos);
    pos.y = spec.wheelRadius;
    const tangent = path.curve.getTangentAt(0).normalize();
    const heading = Math.atan2(tangent.x, tangent.z);

    const vehicle: VehicleState = {
      id: nextVehicleId++,
      kind,
      spec,
      path,
      distance: 0,
      speed: spec.maxSpeed * 0.6,
      isEmergency: false,
      position: pos,
      heading,
      targetHeading: heading,
      phase: 'approach',
      brakeLight: false,
      spawnedAt: this.simTime,
      stoppedDuration: 0,
      waitingTime: 0,
      isBlockedByBox: false,
      stopReason: 'NONE',
      stopReasonDetail: 'Spawned and accelerating',
      distToStopLine: this.stopLineDistance() - 0,
    };

    this.vehicles.push(vehicle);
    this.totalSpawned++;
    return vehicle;
  }

  spawnAmbulance(): VehicleState | null {
    if (this.ambulanceSpawned) return null;

    const approach = this.emergencyApproach ?? 'south';
    const turn: TurnType = 'straight';
    const path = this.getPath(approach, turn);

    const specBase = VEHICLE_SPECS['ambulance'];
    const spec = {
      ...specBase,
      color: '#ffffff',
    };

    const pos = new THREE.Vector3();
    path.curve.getPointAt(0, pos);
    pos.y = spec.wheelRadius;
    const tangent = path.curve.getTangentAt(0).normalize();
    const heading = Math.atan2(tangent.x, tangent.z);

    const ambulance: VehicleState = {
      id: nextVehicleId++,
      kind: 'ambulance',
      spec,
      path,
      distance: 0,
      speed: spec.maxSpeed * 0.9,
      isEmergency: true,
      position: pos,
      heading,
      targetHeading: heading,
      phase: 'approach',
      brakeLight: false,
      spawnedAt: this.simTime,
      stoppedDuration: 0,
      waitingTime: 0,
      isBlockedByBox: false,
      stopReason: 'NONE',
      stopReasonDetail: 'Emergency response en route',
      distToStopLine: this.stopLineDistance(),
    };

    this.vehicles.push(ambulance);
    this.ambulanceSpawned = true;
    this.ambulanceId = ambulance.id;
    this.totalSpawned++;
    return ambulance;
  }

  activateEmergency(approach: Direction = 'south') {
    this.emergencyActive = true;
    this.emergencyPhase = 1;
    this.emergencyTimer = 0;
    this.emergencyApproach = approach;
    this.ambulanceSpawned = false;
    this.ambulanceId = null;

    this.logDecision(
      `🚨 EMERGENCY DISPATCH: Priority ambulance inbound on ${approach.toUpperCase()} corridor.`,
      'Clearing conflicting approaches. Corridor preemption active.'
    );
  }

  deactivateEmergency() {
    this.emergencyActive = false;
    this.emergencyPhase = 0;
    this.emergencyTimer = 0;
    this.emergencyApproach = null;
    if (this.ambulanceId !== null) {
      this.vehicles = this.vehicles.filter((v) => v.id !== this.ambulanceId);
      this.ambulanceId = null;
      this.ambulanceSpawned = false;
    }
    this.initSignals();
    this.logDecision('Emergency corridor cleared.', 'Normal adaptive signal cycles resumed.');
  }

  /**
   * Headway scanner & car following detector.
   * FIX: All vehicles on the same approach road are in the SAME queue before the stop line,
   * regardless of their intended turn!
   */
  getVehicleAhead(
    vehicle: VehicleState,
    allVehicles: VehicleState[]
  ): { distance: number; speed: number; id: number; kind: VehicleKind } | null {
    if (!vehicle.path || !vehicle.path.curve) return null;

    let closestDist = Infinity;
    let leaderSpeed = 0;
    let leaderId = -1;
    let leaderKind: VehicleKind = 'car';

    const myApproach = vehicle.path.approach;
    const stopDist = this.stopLineDistance(vehicle);

    for (const other of allVehicles) {
      if (other.id === vehicle.id) continue;
      if (!other.path || !other.path.curve) continue;

      // 1. Approach Road Queuing (Shared approach lane leading up to the stop line)
      if (vehicle.phase === 'approach') {
        if (other.path.approach === myApproach) {
          // Other is on the approach road or has just crossed the stop line into the entry area
          const otherIsAhead = other.distance > vehicle.distance;
          if (otherIsAhead) {
            const gap = other.distance - vehicle.distance - (vehicle.spec.length + other.spec.length) / 2;
            const effectiveGap = Math.max(0, gap);
            if (effectiveGap < closestDist) {
              closestDist = effectiveGap;
              leaderSpeed = other.speed;
              leaderId = other.id;
              leaderKind = other.kind;
            }
          }
        }
      }

      // 2. Intersection & Exit Phase Following (Same path or merging lanes)
      if (vehicle.phase === 'intersection' || vehicle.phase === 'exit') {
        if (other.path.approach === myApproach && other.path.turn === vehicle.path.turn) {
          if (other.distance > vehicle.distance) {
            const gap = other.distance - vehicle.distance - (vehicle.spec.length + other.spec.length) / 2;
            const effectiveGap = Math.max(0, gap);
            if (effectiveGap < closestDist) {
              closestDist = effectiveGap;
              leaderSpeed = other.speed;
              leaderId = other.id;
              leaderKind = other.kind;
            }
          }
        } else if (other.phase === 'intersection') {
          // Intersecting 3D proximity yield inside the box
          const dist3D = other.position.distanceTo(vehicle.position);
          if (dist3D < 12) {
            const gap = dist3D - (vehicle.spec.length + other.spec.length) / 2;
            const effectiveGap = Math.max(0, gap);
            // Right of way rule: arrived first or already further along trajectory
            if (other.distance > vehicle.distance || other.spawnedAt < vehicle.spawnedAt) {
              if (effectiveGap < closestDist) {
                closestDist = effectiveGap;
                leaderSpeed = other.speed;
                leaderId = other.id;
                leaderKind = other.kind;
              }
            }
          }
        }
      }
    }

    return closestDist === Infinity
      ? null
      : { distance: closestDist, speed: leaderSpeed, id: leaderId, kind: leaderKind };
  }

  /**
   * Synchronises SignalGroup objects with controllerPhase and phaseTimer
   */
  private syncSignalGroupStates() {
    const nsGroup = this.signalGroups.find((g) => g.id === 'NS');
    const ewGroup = this.signalGroups.find((g) => g.id === 'EW');
    if (!nsGroup || !ewGroup) return;

    switch (this.controllerPhase) {
      case 'NS_GREEN': {
        nsGroup.state = 'green';
        ewGroup.state = 'red';
        const rem = Math.max(0, this.currentGreenDuration - this.phaseTimer);
        nsGroup.phaseRemaining = rem;
        ewGroup.phaseRemaining = rem + YELLOW_DURATION + ALL_RED_BUFFER;
        break;
      }
      case 'NS_AMBER': {
        nsGroup.state = 'amber';
        ewGroup.state = 'red';
        const rem = Math.max(0, YELLOW_DURATION - this.phaseTimer);
        nsGroup.phaseRemaining = rem;
        ewGroup.phaseRemaining = rem + ALL_RED_BUFFER;
        break;
      }
      case 'NS_ALL_RED': {
        nsGroup.state = 'red';
        ewGroup.state = 'red';
        const rem = Math.max(0, ALL_RED_BUFFER - this.phaseTimer);
        nsGroup.phaseRemaining = rem + this.nextGreenDuration;
        ewGroup.phaseRemaining = rem;
        break;
      }
      case 'EW_GREEN': {
        nsGroup.state = 'red';
        ewGroup.state = 'green';
        const rem = Math.max(0, this.currentGreenDuration - this.phaseTimer);
        ewGroup.phaseRemaining = rem;
        nsGroup.phaseRemaining = rem + YELLOW_DURATION + ALL_RED_BUFFER;
        break;
      }
      case 'EW_AMBER': {
        nsGroup.state = 'red';
        ewGroup.state = 'amber';
        const rem = Math.max(0, YELLOW_DURATION - this.phaseTimer);
        ewGroup.phaseRemaining = rem;
        nsGroup.phaseRemaining = rem + ALL_RED_BUFFER;
        break;
      }
      case 'EW_ALL_RED': {
        nsGroup.state = 'red';
        ewGroup.state = 'red';
        const rem = Math.max(0, ALL_RED_BUFFER - this.phaseTimer);
        ewGroup.phaseRemaining = rem + this.nextGreenDuration;
        nsGroup.phaseRemaining = rem;
        break;
      }
    }
  }

  /**
   * Deterministic 6-Phase Signal State Machine
   */
  private updateSignals(dt: number) {
    if (this.emergencyActive) {
      this.updateEmergencySignals(dt);
      return;
    }

    this.phaseTimer += dt;

    // 1. Adaptive Adjustments during active GREEN
    if (this.mode === 'adaptive') {
      const isNSGreen = this.controllerPhase === 'NS_GREEN';
      const isEWGreen = this.controllerPhase === 'EW_GREEN';

      if (isNSGreen || isEWGreen) {
        const activeApproaches: Direction[] = isNSGreen ? ['north', 'south'] : ['east', 'west'];
        const waitingApproaches: Direction[] = isNSGreen ? ['east', 'west'] : ['north', 'south'];

        const activeQueue = activeApproaches.reduce((acc, a) => acc + this.approachMetrics[a].queueCount, 0);
        const waitingQueue = waitingApproaches.reduce((acc, a) => acc + this.approachMetrics[a].queueCount, 0);
        const waitingMaxWait = Math.max(...waitingApproaches.map((a) => this.approachMetrics[a].maxWaitTimeSec), 0);

        // Active vehicles near the stop line (< 40m)
        const activeVehiclesApproaching = this.vehicles.filter(
          (v) =>
            v.path &&
            activeApproaches.includes(v.path.approach) &&
            v.phase === 'approach' &&
            this.stopLineDistance(v) - v.distance < 40
        ).length;

        // Condition A: Starvation Prevention
        if (waitingMaxWait >= MAX_WAIT_STARVATION && this.phaseTimer >= MIN_ADAPTIVE_GREEN) {
          this.logDecision(
            `Starvation prevention: ${waitingApproaches.join('/')} waited ${Math.round(waitingMaxWait)}s. Initiating phase change.`,
            `Waiting queue: ${waitingQueue} vs active: ${activeQueue}`,
            YELLOW_DURATION
          );
          this.transitionToAmber(isNSGreen ? 'NS' : 'EW');
          return;
        }

        // Condition B: Early Cutoff (Queue cleared AND no incoming vehicles close to stop line)
        if (
          activeQueue === 0 &&
          activeVehiclesApproaching === 0 &&
          waitingQueue >= 2 &&
          this.phaseTimer >= MIN_ADAPTIVE_GREEN
        ) {
          this.logDecision(
            `Early green cutoff: ${activeApproaches.join('/')} clear. Shifting to serve ${waitingApproaches.join('/')} (${waitingQueue} queued).`,
            `Active: 0, Waiting: ${waitingQueue}`,
            YELLOW_DURATION
          );
          this.transitionToAmber(isNSGreen ? 'NS' : 'EW');
          return;
        }

        // Condition C: Green Extension (Heavy remaining queue)
        if (
          activeQueue >= 3 &&
          this.phaseTimer >= this.currentGreenDuration - 1 &&
          this.currentGreenDuration < MAX_ADAPTIVE_GREEN &&
          waitingMaxWait < 30
        ) {
          const extension = Math.min(5, MAX_ADAPTIVE_GREEN - this.currentGreenDuration);
          this.currentGreenDuration += extension;
          this.logDecision(
            `Adaptive Green Extension +${Math.round(extension)}s on ${activeApproaches.join('/')} corridor.`,
            `Queue: ${activeQueue} veh. Total green: ${Math.round(this.currentGreenDuration)}s`,
            this.currentGreenDuration
          );
        }
      }
    }

    // 2. Regular Phase Progression
    switch (this.controllerPhase) {
      case 'NS_GREEN': {
        if (this.phaseTimer >= this.currentGreenDuration - 0.001) {
          this.transitionToAmber('NS');
        }
        break;
      }
      case 'NS_AMBER': {
        if (this.phaseTimer >= YELLOW_DURATION - 0.001) {
          this.controllerPhase = 'NS_ALL_RED';
          this.phaseTimer = 0;
          this.nextGreenDuration =
            this.mode === 'adaptive'
              ? this.calculateAdaptiveGreenDuration(['east', 'west'])
              : DEFAULT_FIXED_GREEN;
        }
        break;
      }
      case 'NS_ALL_RED': {
        if (this.phaseTimer >= ALL_RED_BUFFER - 0.001) {
          // Transition safely to EW Green
          this.controllerPhase = 'EW_GREEN';
          this.phaseTimer = 0;
          this.currentGreenDuration = this.nextGreenDuration;
          const qCount = ['east', 'west'].reduce((acc, a) => acc + this.approachMetrics[a as Direction].queueCount, 0);
          this.logDecision(
            `East/West corridor released (${this.currentGreenDuration}s allocated green).`,
            `Queue: ${qCount} veh waiting.`,
            this.currentGreenDuration
          );
        }
        break;
      }
      case 'EW_GREEN': {
        if (this.phaseTimer >= this.currentGreenDuration - 0.001) {
          this.transitionToAmber('EW');
        }
        break;
      }
      case 'EW_AMBER': {
        if (this.phaseTimer >= YELLOW_DURATION - 0.001) {
          this.controllerPhase = 'EW_ALL_RED';
          this.phaseTimer = 0;
          this.nextGreenDuration =
            this.mode === 'adaptive'
              ? this.calculateAdaptiveGreenDuration(['north', 'south'])
              : DEFAULT_FIXED_GREEN;
        }
        break;
      }
      case 'EW_ALL_RED': {
        if (this.phaseTimer >= ALL_RED_BUFFER - 0.001) {
          // Transition safely to NS Green
          this.controllerPhase = 'NS_GREEN';
          this.phaseTimer = 0;
          this.currentGreenDuration = this.nextGreenDuration;
          const qCount = ['north', 'south'].reduce((acc, a) => acc + this.approachMetrics[a as Direction].queueCount, 0);
          this.logDecision(
            `North/South corridor released (${this.currentGreenDuration}s allocated green).`,
            `Queue: ${qCount} veh waiting.`,
            this.currentGreenDuration
          );
        }
        break;
      }
    }

    this.syncSignalGroupStates();
  }

  private transitionToAmber(group: 'NS' | 'EW') {
    this.controllerPhase = group === 'NS' ? 'NS_AMBER' : 'EW_AMBER';
    this.phaseTimer = 0;
  }

  calculateAdaptiveGreenDuration(approaches: Direction[]): number {
    const queueTotal = approaches.reduce((acc, a) => acc + this.approachMetrics[a].queueCount, 0);
    const demandTotal = approaches.reduce((acc, a) => acc + this.demand[a], 0);

    // Formula: 12s base + 1.5s per queued vehicle + arrival rate factor
    const calculated = 12 + queueTotal * 1.5 + (demandTotal / 60) * 8;
    return Math.max(MIN_ADAPTIVE_GREEN, Math.min(MAX_ADAPTIVE_GREEN, Math.round(calculated)));
  }

  private updateEmergencySignals(dt: number) {
    this.emergencyTimer += dt;
    const approach = this.emergencyApproach ?? 'south';
    const isNS = approach === 'north' || approach === 'south';

    const approachGroup = this.signalGroups.find((g) => (isNS ? g.id === 'NS' : g.id === 'EW'));
    const otherGroup = this.signalGroups.find((g) => (isNS ? g.id === 'EW' : g.id === 'NS'));

    switch (this.emergencyPhase) {
      case 1: // Preempt conflicting signals immediately to amber
        if (otherGroup && otherGroup.state === 'green') {
          otherGroup.state = 'amber';
          otherGroup.phaseRemaining = YELLOW_DURATION;
        }
        if (approachGroup) {
          approachGroup.state = 'red';
          approachGroup.phaseRemaining = YELLOW_DURATION + ALL_RED_BUFFER;
        }
        this.emergencyPhase = 1.5;
        this.emergencyTimer = 0;
        break;

      case 1.5: // Clearance interval before opening corridor
        if (this.emergencyTimer >= YELLOW_DURATION + ALL_RED_BUFFER) {
          if (approachGroup) {
            approachGroup.state = 'green';
            approachGroup.phaseRemaining = 60;
          }
          if (otherGroup) {
            otherGroup.state = 'red';
            otherGroup.phaseRemaining = 60;
          }
          this.emergencyPhase = 2;
          this.emergencyTimer = 0;
        }
        break;

      case 2: // Ambulance en route with green corridor
        if (!this.ambulanceSpawned) {
          this.spawnAmbulance();
        }
        if (this.ambulanceId !== null) {
          const ambulance = this.vehicles.find((v) => v.id === this.ambulanceId);
          if (
            ambulance &&
            ambulance.phase === 'exit' &&
            ambulance.distance > this.intersectionExitDistance(ambulance) + 15
          ) {
            this.emergencyPhase = 3;
            this.emergencyTimer = 0;
          }
        }
        break;

      case 3: // Resume normal cycle
        if (this.emergencyTimer > 2.5) {
          this.deactivateEmergency();
        }
        break;
    }
  }

  /**
   * Complete vehicle kinematic and behavioral update sequence:
   * 1. Read authoritative signal state
   * 2. Determine stop line and box clearance
   * 3. Apply safe headway following (IDM)
   * 4. Accelerate or brake smoothly
   * 5. Advance position along path curve
   */
  updateVehicle(vehicle: VehicleState, dt: number) {
    // Check invalid route immediately
    if (!vehicle.path || !vehicle.path.curve) {
      vehicle.speed = 0;
      vehicle.stopReason = 'INVALID_ROUTE';
      vehicle.stopReasonDetail = 'Path curve is undefined';
      return;
    }

    const stopDist = this.stopLineDistance(vehicle);
    const entryDist = this.intersectionEntryDistance(vehicle);
    const exitDist = this.intersectionExitDistance(vehicle);
    const distToStopLine = stopDist - vehicle.distance;
    vehicle.distToStopLine = Number(distToStopLine.toFixed(1));

    // Phase transition
    if (vehicle.distance < stopDist) {
      vehicle.phase = 'approach';
    } else if (vehicle.distance < exitDist) {
      vehicle.phase = 'intersection';
    } else {
      vehicle.phase = 'exit';
    }

    const turnFactor = vehicle.phase === 'intersection' ? TURN_SPEED_FACTOR[vehicle.path.turn] : 1.0;
    let targetSpeed = vehicle.spec.maxSpeed * turnFactor;

    // Slow down ahead of turn inside approach corridor
    if (vehicle.phase === 'approach' && vehicle.path.turn !== 'straight') {
      const distToEntry = entryDist - vehicle.distance;
      if (distToEntry < 24) {
        targetSpeed = Math.min(targetSpeed, vehicle.spec.maxSpeed * turnFactor * (0.4 + 0.6 * (distToEntry / 24)));
      }
    }

    // Downstream Blockage Check on Exit Road
    const exitDir = this.getExitDirection(vehicle);
    if (this.downstreamBlocked[exitDir] && vehicle.phase === 'exit') {
      const blockDist = exitDist + 12;
      const distToBlock = blockDist - vehicle.distance;
      if (distToBlock <= 0.5) {
        targetSpeed = 0;
        if (vehicle.speed < 0.25) vehicle.speed = 0;
        vehicle.stopReason = 'DOWNSTREAM_BLOCKED';
        vehicle.stopReasonDetail = `Stopped on blocked ${exitDir.toUpperCase()} exit road (spillback queue)`;
      } else if (distToBlock < 30) {
        const approachSpeed = Math.sqrt(2 * 2.5 * Math.max(0, distToBlock));
        targetSpeed = Math.min(targetSpeed, approachSpeed);
      }
    }

    // Step 1: Signal & Stop Line Check
    let signalMustStop = false;
    let signalReason: StopReason = 'NONE';
    let signalDetail = 'Signal permitted';

    if (vehicle.phase === 'approach') {
      const signalCheck = this.shouldStopAtSignal(vehicle);
      if (signalCheck.shouldStop) {
        signalMustStop = true;
        signalReason = signalCheck.reason;
        signalDetail = signalCheck.detail;

        if (distToStopLine <= 0.3) {
          // Right at the stop line: hold standstill
          targetSpeed = 0;
          if (vehicle.speed < 0.25) {
            vehicle.speed = 0;
            vehicle.distance = Math.min(vehicle.distance, stopDist - 0.05);
          }
        } else if (distToStopLine < 40) {
          // Smooth deceleration curve to stop precisely at the line
          const brakeAccel = vehicle.spec.acceleration * 1.4;
          const safeApproachSpeed = Math.sqrt(2 * brakeAccel * Math.max(0, distToStopLine - 0.2));
          targetSpeed = Math.min(targetSpeed, safeApproachSpeed);
        }
      }
    }

    // Step 2: Car-Following Model (Intelligent Driver Model principle)
    const ahead = this.getVehicleAhead(vehicle, this.vehicles);
    let followingMustStop = false;
    let followingReason: StopReason = 'NONE';
    let followingDetail = '';

    if (ahead !== null) {
      const standstillGap =
        vehicle.kind === 'bus' ? 2.8 : vehicle.kind === 'motorcycle' ? 1.2 : vehicle.isEmergency ? 1.5 : 1.8;
      const s = ahead.distance;
      const vLead = ahead.speed;

      if (vLead < 0.25) {
        // Leader is stopped in queue
        if (s <= standstillGap) {
          targetSpeed = 0;
          followingMustStop = true;
          followingReason = 'VEHICLE_AHEAD';
          followingDetail = `Queued behind vehicle #${ahead.id} (${ahead.kind})`;
          if (vehicle.speed < 0.25) {
            vehicle.speed = 0;
          }
        } else {
          // Pull up smoothly to standstill gap
          const pullUpDist = Math.max(0, s - standstillGap);
          const pullUpSpeed = Math.sqrt(2 * 2.8 * pullUpDist);
          targetSpeed = Math.min(targetSpeed, pullUpSpeed);
          if (vehicle.speed < 0.5) {
            followingReason = 'VEHICLE_AHEAD';
            followingDetail = `Pulling up to vehicle #${ahead.id}`;
          }
        }
      } else {
        // Leader is moving: NEVER clamp follower target speed to 0!
        if (s <= standstillGap) {
          // Close to leader: match leader speed
          targetSpeed = Math.min(targetSpeed, vLead);
        } else if (s < standstillGap + 7.0) {
          // Following range: match leader speed plus catch-up increment
          const catchUp = (s - standstillGap) / 1.4;
          targetSpeed = Math.min(targetSpeed, vLead + catchUp);
        }
        // If s >= standstillGap + 7, free acceleration toward targetSpeed
      }
    }

    // Step 3: Emergency Yielding
    if (this.emergencyActive && !vehicle.isEmergency && this.ambulanceId !== null) {
      const ambulance = this.vehicles.find((v) => v.id === this.ambulanceId);
      if (ambulance) {
        const dist3D = ambulance.position.distanceTo(vehicle.position);
        if (dist3D < 18) {
          targetSpeed = 0;
          if (vehicle.speed < 0.2) vehicle.speed = 0;
        } else if (dist3D < 35) {
          targetSpeed = Math.min(targetSpeed, 2.0);
        }
      }
    }

    // Step 4: Assign Diagnostic Stop Reason
    if (signalMustStop) {
      vehicle.stopReason = signalReason;
      vehicle.stopReasonDetail = signalDetail;
    } else if (followingMustStop) {
      vehicle.stopReason = followingReason;
      vehicle.stopReasonDetail = followingDetail;
    } else if (vehicle.speed < 0.4 && targetSpeed === 0) {
      vehicle.stopReason = signalReason !== 'NONE' ? signalReason : followingReason !== 'NONE' ? followingReason : 'NONE';
      vehicle.stopReasonDetail = signalDetail;
    } else {
      vehicle.stopReason = 'NONE';
      vehicle.stopReasonDetail = 'Moving normally';
    }

    // Step 5: Kinematic Acceleration & Braking
    const accel = vehicle.spec.acceleration;
    const brakePower = accel * 1.9;

    if (vehicle.speed < targetSpeed) {
      vehicle.speed = Math.min(targetSpeed, vehicle.speed + accel * dt);
    } else if (vehicle.speed > targetSpeed) {
      vehicle.speed = Math.max(targetSpeed, vehicle.speed - brakePower * dt);
    }

    // Brake lights
    vehicle.brakeLight = vehicle.speed < targetSpeed - 0.6 && targetSpeed < vehicle.spec.maxSpeed * 0.8;

    // Track stopped duration & waiting time
    if (vehicle.speed < 0.4) {
      vehicle.stoppedDuration += dt;
      vehicle.waitingTime += dt;
    } else {
      vehicle.stoppedDuration = Math.max(0, vehicle.stoppedDuration - dt * 0.5);
    }

    // Step 6: Advance Position along trajectory
    vehicle.distance += vehicle.speed * dt;

    // Hard stop-line barrier enforcement:
    // If vehicle must stop for red signal, occupied junction, or blocked exit,
    // prevent penetrating past the stop line!
    if (signalMustStop && vehicle.phase === 'approach') {
      if (vehicle.distance > stopDist - 0.05) {
        vehicle.distance = stopDist - 0.05;
        vehicle.speed = 0;
      }
    }

    const pathLength = vehicle.path.length;
    if (vehicle.distance >= pathLength) {
      vehicle.distance = pathLength;
      return;
    }

    // Update 3D coordinates & heading
    const t = Math.min(0.9999, vehicle.distance / pathLength);
    const newPos = vehicle.path.curve.getPointAt(t);
    newPos.y = vehicle.spec.wheelRadius;
    vehicle.position.copy(newPos);

    const tangent = vehicle.path.curve.getTangentAt(t).normalize();
    vehicle.targetHeading = Math.atan2(tangent.x, tangent.z);

    let diff = vehicle.targetHeading - vehicle.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turnRate = vehicle.speed > 0.5 ? 7 : 14;
    vehicle.heading += diff * Math.min(1, dt * turnRate);
  }

  private updateMetrics() {
    const metrics: Record<Direction, ApproachMetrics> = {
      north: this.createEmptyMetrics('north'),
      south: this.createEmptyMetrics('south'),
      east: this.createEmptyMetrics('east'),
      west: this.createEmptyMetrics('west'),
    };

    let totalSpeed = 0;

    for (const v of this.vehicles) {
      totalSpeed += v.speed;
      if (v.path && v.phase === 'approach') {
        const app = v.path.approach;
        const distToStop = this.stopLineDistance(v) - v.distance;

        // Count in queue if stopped or slow-moving within 80m of stop line
        if (v.speed < 2.0 && distToStop < 85) {
          metrics[app].queueCount++;
          metrics[app].queueLengthMeters = Math.max(metrics[app].queueLengthMeters, distToStop);
          metrics[app].avgWaitTimeSec += v.waitingTime;
          metrics[app].maxWaitTimeSec = Math.max(metrics[app].maxWaitTimeSec, v.waitingTime);
          if (v.speed < 0.25) {
            metrics[app].stoppedVehicles++;
          }
        }
      }
    }

    for (const a of APPROACHES) {
      const m = metrics[a];
      if (m.queueCount > 0) {
        m.avgWaitTimeSec = Math.round(m.avgWaitTimeSec / m.queueCount);
        m.queueLengthMeters = Math.round(m.queueLengthMeters);
      }
      m.congestionLevel = m.queueCount >= 8 ? 'heavy' : m.queueCount >= 4 ? 'moderate' : 'low';
    }

    this.approachMetrics = metrics;

    if (this.vehicles.length > 0) {
      const avgSpeedMs = totalSpeed / this.vehicles.length;
      this.avgSpeedKmh = Math.round(avgSpeedMs * 3.6);
    } else {
      this.avgSpeedKmh = 0;
    }

    if (this.simTime > 5) {
      this.throughputPerMin = Math.round((this.totalExited / this.simTime) * 60);
    }
  }

  update(rawDt: number) {
    if (this.paused) return;

    const dt = FIXED_DT * this.simSpeed;
    this.simTime += dt;

    // 1. Spawning
    for (const app of APPROACHES) {
      const demandPerSec = this.demand[app] / 60;
      this.spawnAccumulators[app] += demandPerSec * dt;
      if (this.spawnAccumulators[app] >= 1.0) {
        this.spawnVehicle(app);
        this.spawnAccumulators[app] -= 1.0;
      }
    }

    // 2. Authoritative Signal Phasing Controller
    this.updateSignals(dt);

    // 3. Vehicle Updates
    for (const vehicle of this.vehicles) {
      this.updateVehicle(vehicle, dt);
    }

    // 4. Remove finished vehicles
    const prevCount = this.vehicles.length;
    this.vehicles = this.vehicles.filter((v) => !v.path || v.distance < v.path.length);
    const exitedThisTick = prevCount - this.vehicles.length;
    if (exitedThisTick > 0) {
      this.totalExited += exitedThisTick;
    }

    // 5. Update Metrics
    this.updateMetrics();
  }

  getSnapshot(): SnapshotData {
    const signals: Record<Direction, SignalState> = {
      north: this.getSignalState('north'),
      south: this.getSignalState('south'),
      east: this.getSignalState('east'),
      west: this.getSignalState('west'),
    };

    const signalTimers: Record<Direction, number> = {
      north: this.getSignalTimer('north'),
      south: this.getSignalTimer('south'),
      east: this.getSignalTimer('east'),
      west: this.getSignalTimer('west'),
    };

    return {
      vehicles: this.vehicles.map((v) => ({
        id: v.id,
        kind: v.kind,
        position: [v.position.x, v.position.y, v.position.z],
        heading: v.heading,
        brakeLight: v.brakeLight,
        isEmergency: v.isEmergency,
        speed: v.speed,
        phase: v.phase,
        isBlockedByBox: v.isBlockedByBox,
        stopReason: v.stopReason,
        stopReasonDetail: v.stopReasonDetail,
        distToStopLine: v.distToStopLine,
        approach: v.path?.approach || 'north',
        turn: v.path?.turn || 'straight',
        signalState: v.path ? this.getSignalState(v.path.approach) : 'red',
      })),
      signals,
      signalTimers,
      emergencyActive: this.emergencyActive,
      emergencyPhase: this.emergencyPhase,
      emergencyApproach: this.emergencyApproach,
      vehicleCount: this.vehicles.length,
      totalSpawned: this.totalSpawned,
      totalExited: this.totalExited,
      throughputPerMin: this.throughputPerMin,
      avgSpeedKmh: this.avgSpeedKmh,
      paused: this.paused,
      simSpeed: this.simSpeed,
      ambulanceId: this.ambulanceId,
      mode: this.mode,
      approachMetrics: { ...this.approachMetrics },
      adaptiveReasoning: this.adaptiveReasoning,
      adaptiveDecisions: [...this.adaptiveDecisions],
      downstreamBlocked: { ...this.downstreamBlocked },
      activeScenario: this.activeScenario,
      congestionOverlays: this.congestionOverlays,
      debugMode: this.debugMode,
    };
  }

  runComparisonExperiment(durationSec = 60): ComparisonResult {
    const fixedResults = this.simulateBatch('fixed', durationSec);
    const adaptiveResults = this.simulateBatch('adaptive', durationSec);

    const waitDelta =
      fixedResults.avgWaitTime > 0
        ? Math.round(((adaptiveResults.avgWaitTime - fixedResults.avgWaitTime) / fixedResults.avgWaitTime) * 100)
        : 0;

    const delayDelta =
      fixedResults.totalStoppedDelay > 0
        ? Math.round(((adaptiveResults.totalStoppedDelay - fixedResults.totalStoppedDelay) / fixedResults.totalStoppedDelay) * 100)
        : 0;

    const queueDelta =
      fixedResults.maxQueueLength > 0
        ? Math.round(((adaptiveResults.maxQueueLength - fixedResults.maxQueueLength) / fixedResults.maxQueueLength) * 100)
        : 0;

    const throughputDelta =
      fixedResults.throughputPerMin > 0
        ? Math.round(((adaptiveResults.throughputPerMin - fixedResults.throughputPerMin) / fixedResults.throughputPerMin) * 100)
        : 0;

    const travelDelta =
      fixedResults.avgTravelTime > 0
        ? Math.round(((adaptiveResults.avgTravelTime - fixedResults.avgTravelTime) / fixedResults.avgTravelTime) * 100)
        : 0;

    return {
      fixed: fixedResults,
      adaptive: adaptiveResults,
      delta: {
        waitTimePct: waitDelta,
        delayPct: delayDelta,
        queuePct: queueDelta,
        throughputPct: throughputDelta,
        travelTimePct: travelDelta,
      },
    };
  }

  private simulateBatch(testMode: SimulationMode, durationSec: number) {
    const originalState = {
      vehicles: [...this.vehicles],
      simTime: this.simTime,
      totalSpawned: this.totalSpawned,
      totalExited: this.totalExited,
      mode: this.mode,
      accumulators: { ...this.spawnAccumulators },
      controllerPhase: this.controllerPhase,
      phaseTimer: this.phaseTimer,
      currentGreenDuration: this.currentGreenDuration,
    };

    this.vehicles = [];
    this.mode = testMode;
    this.signalGroups = createSignalGroups(testMode);
    this.initSignals();
    this.simTime = 0;
    this.totalSpawned = 0;
    this.totalExited = 0;
    this.spawnAccumulators = { north: 0, south: 0, east: 0, west: 0 };

    let totalWaitTime = 0;
    let waitSamples = 0;
    let totalStoppedDelay = 0;
    let maxQueue = 0;
    const ticks = Math.round(durationSec / FIXED_DT);

    for (let i = 0; i < ticks; i++) {
      for (const app of APPROACHES) {
        const demandPerSec = this.demand[app] / 60;
        this.spawnAccumulators[app] += demandPerSec * FIXED_DT;
        if (this.spawnAccumulators[app] >= 1.0) {
          this.spawnVehicle(app);
          this.spawnAccumulators[app] -= 1.0;
        }
      }

      this.updateSignals(FIXED_DT);

      for (const v of this.vehicles) {
        this.updateVehicle(v, FIXED_DT);
        if (v.speed < 1.0) {
          totalStoppedDelay += FIXED_DT;
          totalWaitTime += v.waitingTime;
          waitSamples++;
        }
      }

      this.vehicles = this.vehicles.filter((v) => !v.path || v.distance < v.path.length);
      const currentQueue = this.vehicles.filter((v) => v.phase === 'approach' && v.speed < 1.0).length;
      maxQueue = Math.max(maxQueue, currentQueue);
    }

    const avgWaitTime = waitSamples > 0 ? Number((totalWaitTime / waitSamples).toFixed(1)) : 0;
    const throughput = Math.round((this.totalExited / durationSec) * 60);

    const result = {
      avgWaitTime,
      totalStoppedDelay: Math.round(totalStoppedDelay),
      maxQueueLength: maxQueue,
      totalCompletedJourneys: this.totalExited,
      throughputPerMin: throughput,
      avgTravelTime: Number((durationSec / Math.max(1, this.totalExited)).toFixed(1)),
      avgSpeedKmh: this.avgSpeedKmh || 26,
    };

    // Restore live state
    this.vehicles = originalState.vehicles;
    this.simTime = originalState.simTime;
    this.totalSpawned = originalState.totalSpawned;
    this.totalExited = originalState.totalExited;
    this.mode = originalState.mode;
    this.signalGroups = createSignalGroups(originalState.mode);
    this.spawnAccumulators = originalState.accumulators;
    this.controllerPhase = originalState.controllerPhase;
    this.phaseTimer = originalState.phaseTimer;
    this.currentGreenDuration = originalState.currentGreenDuration;
    this.syncSignalGroupStates();

    return result;
  }
}
