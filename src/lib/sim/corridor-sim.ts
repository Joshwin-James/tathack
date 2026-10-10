// Deterministic 60Hz Simulation Engine for Kochi Green Corridor 3D
import {
  Junction,
  SimCar,
  EmergencyVehicle,
  DecisionLogEntry,
  SimConfig,
  SimMetrics,
  VehicleType,
  ScenarioPreset,
  JunctionPreemptionState,
} from "./types";
import { sharedCorridorSpline } from "./spline-path";
import { CORRIDOR_JUNCTION_NODES } from "./road-graph";

export function createSeededRng(seed = 42) {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class CorridorSimulation {
  public config: SimConfig;
  public junctions: Junction[];
  public cars: SimCar[];
  public vehicle: EmergencyVehicle;
  public decisionLogs: DecisionLogEntry[];
  public elapsedTime: number = 0;
  public totalRouteLength: number;
  private rng: () => number;
  private nextLogId: number = 1;

  constructor(config: Partial<SimConfig> = {}, seed = 1337) {
    this.config = {
      greenCorridorActive: config.greenCorridorActive ?? true,
      vehicleType: config.vehicleType ?? "ambulance",
      scenario: config.scenario ?? "normal",
      speedMultiplier: config.speedMultiplier ?? 1.0,
      preemptionDistance: config.preemptionDistance ?? 150,
      yieldDistance: config.yieldDistance ?? 60,
      showCollisionBoxes: config.showCollisionBoxes ?? false,
    };

    this.totalRouteLength = sharedCorridorSpline.totalLength;
    this.rng = createSeededRng(seed);
    this.junctions = this.initJunctions();
    this.vehicle = this.initVehicle(this.config.vehicleType);
    this.cars = this.initTraffic(this.config.scenario);
    this.decisionLogs = [];

    // Initial dispatch log
    this.logDecision(
      "Kaloor Command Hub",
      "Emergency Vehicle Dispatched",
      `Route: Incident -> Aster Medcity. Green Corridor AI: ${
        this.config.greenCorridorActive ? "ACTIVE (Preemption Engaged)" : "OFF (Standard Traffic)"
      }.`,
      "dispatch"
    );
  }

  private initJunctions(): Junction[] {
    return CORRIDOR_JUNCTION_NODES.map((j, idx) => ({
      id: j.id,
      name: j.name,
      x: j.x,
      z: j.z,
      mainHeading: j.incomingHeading,
      turnType: j.turnType,
      incomingApproach: j.incomingHeading === 0 ? "west" : "north",
      outgoingApproach: j.outgoingHeading === 0 ? "east" : "south",
      preemptionState: "NORMAL" as JunctionPreemptionState,
      stateTimer: 0,
      signals: {
        ambulanceApproach: idx % 2 === 0 ? "green" : "red",
        opposingApproach: idx % 2 === 0 ? "green" : "red",
        crossApproachA: idx % 2 === 0 ? "red" : "green",
        crossApproachB: idx % 2 === 0 ? "red" : "green",
        normalTimer: (idx * 7) % 28,
        cycleDuration: 28,
        normalMainPhase: idx % 2 === 0 ? "green" : "red",
        normalCrossPhase: idx % 2 === 0 ? "red" : "green",
      },
      cleared: false,
      preemptedOnce: false,
    }));
  }

  private initVehicle(type: VehicleType): EmergencyVehicle {
    const startSample = sharedCorridorSpline.sampleAtDistance(0, 1.8);
    return {
      type,
      x: startSample.finalX,
      z: startSample.finalZ,
      heading: startSample.heading,
      roll: 0,
      speed: 0,
      maxSpeed: 28, // ~70 km/h
      progress: 0,
      distanceTraveled: 0,
      distanceRemaining: this.totalRouteLength,
      currentJunctionIndex: 0,
      status: "en_route",
      redLightsHit: 0,
      redLightsAvoided: 0,
      timeSpentWaitingAtRed: 0,
      totalTime: 0,
      isOvertaking: false,
      overtakeTargetOffset: 1.8,
      currentLateralOffset: 1.8,
      collisionRadius: 2.2,
    };
  }

  private initTraffic(scenario: ScenarioPreset): SimCar[] {
    const cars: SimCar[] = [];
    const colors = ["#e2e8f0", "#38bdf8", "#f43f5e", "#fbbf24", "#10b981", "#818cf8", "#cbd5e1"];

    // Forward lanes (India LHD: Left half: lane 0 at +4.5, lane 1 at +1.8)
    const fwdDistances = [45, 80, 120, 155, 195, 235, 275, 315, 355, 395, 435];
    fwdDistances.forEach((dist, i) => {
      const lane = i % 2 === 0 ? 0 : 1;
      const latOffset = lane === 0 ? 4.5 : 1.8;
      const sample = sharedCorridorSpline.sampleAtDistance(dist, latOffset);

      cars.push({
        id: `car-fwd-${i}`,
        laneIndex: lane,
        roadSegmentId: "corridor-fwd",
        distanceAlongRoad: dist,
        x: sample.finalX,
        z: sample.finalZ,
        heading: sample.heading,
        roll: 0,
        speed: 13.0,
        maxSpeed: 14.5 + (i % 3) * 1.5,
        targetSpeed: 15.0,
        color: colors[i % colors.length],
        isYielding: false,
        yieldTimer: 0,
        lateralOffset: latOffset,
        targetLateralOffset: latOffset,
        stoppedAtSignal: false,
        isTurnVehicle: false,
        collisionRadius: 2.0,
      });
    });

    // Reverse oncoming lanes (India LHD: Right half: lane 2 at -1.8, lane 3 at -4.5)
    const revDistances = [460, 415, 375, 335, 290, 250, 210, 170, 130, 90, 50];
    revDistances.forEach((dist, i) => {
      const lane = i % 2 === 0 ? 2 : 3;
      const latOffset = lane === 2 ? -1.8 : -4.5;
      const sample = sharedCorridorSpline.sampleAtDistance(dist, latOffset);

      cars.push({
        id: `car-rev-${i}`,
        laneIndex: lane,
        roadSegmentId: "corridor-rev",
        distanceAlongRoad: dist,
        x: sample.finalX,
        z: sample.finalZ,
        heading: sample.heading + Math.PI,
        roll: 0,
        speed: 13.0,
        maxSpeed: 14.5 + (i % 3) * 1.5,
        targetSpeed: 15.0,
        color: colors[(i + 3) % colors.length],
        isYielding: false,
        yieldTimer: 0,
        lateralOffset: latOffset,
        targetLateralOffset: latOffset,
        stoppedAtSignal: false,
        isTurnVehicle: false,
        collisionRadius: 2.0,
      });
    });

    return cars;
  }

  // Main 60Hz Step Routine
  public step(dtSec: number) {
    const effectiveDt = dtSec * this.config.speedMultiplier;
    this.elapsedTime += effectiveDt;

    if (this.vehicle.status === "en_route") {
      this.vehicle.totalTime += effectiveDt;
    }

    // 1. Update Signals & Preemption State Machine
    this.updateJunctionSignals(effectiveDt);

    // 2. Update Traffic Vehicles (IDM, Yielding & Signal Stopping)
    this.updateTraffic(effectiveDt);

    // 3. Update Emergency Vehicle (Spline Pathing, Turning, Overtaking, Arrival)
    this.updateEmergencyVehicle(effectiveDt);
  }

  // 1. Five-Phase Signal Preemption State Machine
  private updateJunctionSignals(dt: number) {
    this.junctions.forEach((j, idx) => {
      const nodeData = CORRIDOR_JUNCTION_NODES[idx];
      const distToJunction = nodeData.routeDistance - this.vehicle.distanceTraveled;
      const etaSec = this.vehicle.speed > 2 ? distToJunction / this.vehicle.speed : 12;

      // Check preemption trigger condition
      const shouldPreempt =
        this.config.greenCorridorActive &&
        this.vehicle.status === "en_route" &&
        distToJunction > -15 &&
        (distToJunction <= this.config.preemptionDistance || etaSec <= 10.0);

      switch (j.preemptionState) {
        case "NORMAL":
          j.signals.normalTimer = (j.signals.normalTimer + dt) % j.signals.cycleDuration;
          const t = j.signals.normalTimer;

          if (t < 11) {
            j.signals.normalMainPhase = "green";
            j.signals.normalCrossPhase = "red";
          } else if (t < 14) {
            j.signals.normalMainPhase = "yellow";
            j.signals.normalCrossPhase = "red";
          } else if (t < 25) {
            j.signals.normalMainPhase = "red";
            j.signals.normalCrossPhase = "green";
          } else {
            j.signals.normalMainPhase = "red";
            j.signals.normalCrossPhase = "yellow";
          }

          j.signals.ambulanceApproach = j.signals.normalMainPhase;
          j.signals.opposingApproach = j.signals.normalMainPhase;
          j.signals.crossApproachA = j.signals.normalCrossPhase;
          j.signals.crossApproachB = j.signals.normalCrossPhase;

          if (shouldPreempt && !j.cleared) {
            if (j.signals.normalMainPhase === "green") {
              j.preemptionState = "EMERGENCY_GREEN";
              j.stateTimer = 0;
              j.signals.ambulanceApproach = "green";
              j.signals.opposingApproach = "red";
              j.signals.crossApproachA = "red";
              j.signals.crossApproachB = "red";

              this.logDecision(
                j.name,
                "Preemption Engaged: Emergency Green Active",
                `Holding cross-traffic RED. Approaching corridor locked GREEN. ETA: ${Math.max(1, Math.round(etaSec))}s.`,
                "emergency_green"
              );
            } else {
              j.preemptionState = "PREEMPT_REQUESTED";
              j.stateTimer = 0;
              j.signals.crossApproachA = "yellow";
              j.signals.crossApproachB = "yellow";
              j.signals.ambulanceApproach = "red";

              this.logDecision(
                j.name,
                "Preemption Requested: Amber Transition",
                `Ambulance detected within ${Math.round(distToJunction)}m. Initiating safe cross-traffic yellow clearance.`,
                "preempt"
              );
            }
          }
          break;

        case "PREEMPT_REQUESTED":
          j.stateTimer += dt;
          if (j.stateTimer >= 2.0) {
            j.preemptionState = "ALL_RED_CLEARANCE";
            j.stateTimer = 0;
            j.signals.ambulanceApproach = "red";
            j.signals.opposingApproach = "red";
            j.signals.crossApproachA = "red";
            j.signals.crossApproachB = "red";

            this.logDecision(
              j.name,
              "All-Red Intersection Clearance",
              `Clearing junction box. Cross-traffic held outside intersection.`,
              "clearance"
            );
          }
          break;

        case "ALL_RED_CLEARANCE":
          j.stateTimer += dt;
          if (j.stateTimer >= 1.6) {
            j.preemptionState = "EMERGENCY_GREEN";
            j.stateTimer = 0;
            j.signals.ambulanceApproach = "green";
            j.signals.opposingApproach = "red";
            j.signals.crossApproachA = "red";
            j.signals.crossApproachB = "red";

            this.logDecision(
              j.name,
              "Emergency Green Priority Activated",
              `Ambulance granted absolute right-of-way. Cross & opposing traffic queued.`,
              "emergency_green"
            );
          }
          break;

        case "EMERGENCY_GREEN":
          j.signals.ambulanceApproach = "green";
          j.signals.opposingApproach = "red";
          j.signals.crossApproachA = "red";
          j.signals.crossApproachB = "red";

          if (distToJunction <= -14) {
            j.stateTimer += dt;
            if (j.stateTimer >= 2.0) {
              j.preemptionState = "RECOVERY";
              j.stateTimer = 0;
              j.signals.ambulanceApproach = "yellow";
              j.cleared = true;

              this.logDecision(
                j.name,
                "Ambulance Cleared Junction: Recovery Phase",
                `Vehicle exited intersection safely. Restoring standard traffic cycle.`,
                "restore"
              );
            }
          }
          break;

        case "RECOVERY":
          j.stateTimer += dt;
          if (j.stateTimer >= 2.0) {
            j.preemptionState = "NORMAL";
            j.stateTimer = 0;
            j.signals.normalTimer = 0;
          }
          break;
      }
    });
  }

  // 2. Traffic Movement, Yielding, Overtaking Awareness & Zero-Collision Safety (IDM)
  private updateTraffic(dt: number) {
    const ambDist = this.vehicle.distanceTraveled;
    const isAmbEnRoute = this.vehicle.status === "en_route";

    this.cars.forEach((car, index) => {
      const isFwd = car.roadSegmentId === "corridor-fwd";
      const distFromAmb = isFwd ? car.distanceAlongRoad - ambDist : ambDist - car.distanceAlongRoad;

      // Ambulance awareness & yielding (Early 120m lookahead)
      if (isAmbEnRoute && isFwd && distFromAmb > -25 && distFromAmb < 120) {
        car.isYielding = true;
        car.yieldTimer = 3.5;
        car.targetLateralOffset = 5.8; // Move completely to far-left road shoulder
      } else if (isAmbEnRoute && !isFwd && distFromAmb > -25 && distFromAmb < 120) {
        // Oncoming traffic pulls to their far-left (offset -5.8)
        car.isYielding = true;
        car.yieldTimer = 3.5;
        car.targetLateralOffset = -5.8;
      } else if (car.isYielding) {
        car.yieldTimer -= dt;
        if (car.yieldTimer <= 0) {
          car.isYielding = false;
          car.targetLateralOffset = isFwd ? (car.laneIndex === 0 ? 4.5 : 1.8) : (car.laneIndex === 2 ? -1.8 : -4.5);
        }
      }

      // Fast, smooth lateral transition to shoulder when yielding
      const latLerpSpeed = car.isYielding ? 6.5 : 3.0;
      car.lateralOffset += (car.targetLateralOffset - car.lateralOffset) * Math.min(1.0, dt * latLerpSpeed);

      // Car-Following Model (IDM): Check leader vehicle in same lane or yielding shoulder
      let leadCarDist = Infinity;
      let leadCarSpeed = car.maxSpeed;

      this.cars.forEach((other, otherIdx) => {
        if (index === otherIdx || other.roadSegmentId !== car.roadSegmentId) return;

        if (isFwd) {
          const gap = other.distanceAlongRoad - car.distanceAlongRoad;
          if (gap > 0 && gap < leadCarDist && Math.abs(other.lateralOffset - car.lateralOffset) < 3.2) {
            leadCarDist = gap;
            leadCarSpeed = other.speed;
          }
        } else {
          // Reverse lane leader check
          const gap = car.distanceAlongRoad - other.distanceAlongRoad;
          if (gap > 0 && gap < leadCarDist && Math.abs(other.lateralOffset - car.lateralOffset) < 3.2) {
            leadCarDist = gap;
            leadCarSpeed = other.speed;
          }
        }
      });

      // Signal stop check at upcoming junctions (Strict red light compliance)
      let signalStopRequired = false;
      this.junctions.forEach((j, jIdx) => {
        const nodeDist = CORRIDOR_JUNCTION_NODES[jIdx].routeDistance;
        const gapToSignal = isFwd ? nodeDist - car.distanceAlongRoad : car.distanceAlongRoad - nodeDist;

        if (gapToSignal > 0 && gapToSignal < 22) {
          const phase = isFwd ? j.signals.ambulanceApproach : j.signals.opposingApproach;
          if (phase === "red" || phase === "yellow") {
            signalStopRequired = true;
          }
        }
      });

      // Target speed calculation with safe spacing
      let targetV = car.maxSpeed;
      if (car.isYielding) {
        targetV = 2.5; // Crawl or stop on shoulder to let emergency vehicle pass
      }
      if (signalStopRequired) {
        targetV = 0;
      }
      if (leadCarDist < 18.0) {
        targetV = Math.min(targetV, Math.max(0, leadCarSpeed * 0.8));
        if (leadCarDist < 8.5) {
          targetV = 0; // Prevent any overlap with lead car
        }
      }

      // Acceleration / deceleration smoothing
      const accel = targetV < car.speed ? -16.0 : 3.5;
      car.speed = Math.max(0, car.speed + accel * dt);
      if (targetV === 0 && car.speed < 0.2) car.speed = 0;

      // Update position along road (prevent wrap collisions)
      if (isFwd) {
        car.distanceAlongRoad += car.speed * dt;
        if (car.distanceAlongRoad >= this.totalRouteLength - 10) {
          car.distanceAlongRoad = 15;
        }
      } else {
        car.distanceAlongRoad -= car.speed * dt;
        if (car.distanceAlongRoad <= 20) {
          car.distanceAlongRoad = this.totalRouteLength - 15;
        }
      }

      // Update 3D coordinates from spline
      const sample = sharedCorridorSpline.sampleAtDistance(car.distanceAlongRoad, car.lateralOffset);
      car.x = sample.finalX;
      car.z = sample.finalZ;
      car.heading = isFwd ? sample.heading : sample.heading + Math.PI;
      car.roll = isFwd ? sample.roll : -sample.roll;
    });
  }

  // 3. Emergency Vehicle Physics, Corner Banking & Collision Safety Bubble
  private updateEmergencyVehicle(dt: number) {
    if (this.vehicle.status !== "en_route") return;

    const currentDist = this.vehicle.distanceTraveled;
    const sample = sharedCorridorSpline.sampleAtDistance(currentDist);

    // Lookahead for next junction
    let upcomingJunctionIndex = 0;
    CORRIDOR_JUNCTION_NODES.forEach((jNode, idx) => {
      if (currentDist < jNode.routeDistance + 10 && upcomingJunctionIndex === 0) {
        upcomingJunctionIndex = idx;
      }
    });
    this.vehicle.currentJunctionIndex = upcomingJunctionIndex;

    // Check if stopped at red light when Green Corridor is OFF
    let signalBlocked = false;
    if (!this.config.greenCorridorActive) {
      const activeJunction = this.junctions[upcomingJunctionIndex];
      const distToJ = CORRIDOR_JUNCTION_NODES[upcomingJunctionIndex].routeDistance - currentDist;

      if (distToJ > 0 && distToJ < 18) {
        if (activeJunction.signals.ambulanceApproach === "red") {
          signalBlocked = true;
          this.vehicle.redLightsHit++;
          this.vehicle.timeSpentWaitingAtRed += dt;
        }
      }
    } else {
      this.vehicle.redLightsAvoided = upcomingJunctionIndex;
    }

    // Proximity Safety Bubble against all cars (prevent any overlap/clipping)
    let nearestObstacleGap = Infinity;

    this.cars.forEach((car) => {
      const isFwd = car.roadSegmentId === "corridor-fwd";
      const alongTrackGap = isFwd ? car.distanceAlongRoad - currentDist : car.distanceAlongRoad - currentDist;
      const latSep = Math.abs(car.lateralOffset - this.vehicle.currentLateralOffset);

      if (alongTrackGap > -2.0 && alongTrackGap < 35.0 && latSep < 3.2) {
        if (alongTrackGap < nearestObstacleGap) {
          nearestObstacleGap = alongTrackGap;
        }
      }
    });

    // Stay in center of clear road
    this.vehicle.overtakeTargetOffset = 1.0;
    this.vehicle.currentLateralOffset +=
      (this.vehicle.overtakeTargetOffset - this.vehicle.currentLateralOffset) * Math.min(1.0, dt * 4.0);

    // Target Speed calculation
    let targetSpeed = this.vehicle.maxSpeed * sample.speedFactor;

    if (signalBlocked) {
      targetSpeed = 0;
    } else if (nearestObstacleGap < 22.0) {
      // Emergency braking buffer if a car has not yet finished pulling to the shoulder
      if (nearestObstacleGap < 8.0) {
        targetSpeed = 0; // Absolute stop before touching (8m buffer)
      } else {
        targetSpeed = Math.min(targetSpeed, (nearestObstacleGap - 8.0) * 1.8);
      }
    }

    // Smooth acceleration / braking
    const accel = targetSpeed < this.vehicle.speed ? -24.0 : 8.0;
    this.vehicle.speed = Math.max(0, this.vehicle.speed + accel * dt);
    if (targetSpeed === 0 && this.vehicle.speed < 0.2) this.vehicle.speed = 0;

    // Advance along spline
    const nextDist = currentDist + this.vehicle.speed * dt;

    if (nextDist >= this.totalRouteLength - 5) {
      this.vehicle.distanceTraveled = this.totalRouteLength;
      this.vehicle.status = "arrived";
      this.vehicle.speed = 0;

      this.logDecision(
        "Aster Medcity Trauma ICU",
        "Destination Reached: Mission Complete",
        `Emergency transport completed in ${Math.round(this.vehicle.totalTime)}s. Corridor preemption saved ~${Math.round(
          this.config.greenCorridorActive ? 32 : 0
        )}s.`,
        "arrival"
      );
    } else {
      this.vehicle.distanceTraveled = nextDist;
    }

    this.vehicle.distanceRemaining = Math.max(0, this.totalRouteLength - this.vehicle.distanceTraveled);
    this.vehicle.progress = this.vehicle.distanceTraveled / this.totalRouteLength;

    // Sample final 3D position with offset and banking
    const currentSample = sharedCorridorSpline.sampleAtDistance(
      this.vehicle.distanceTraveled,
      this.vehicle.currentLateralOffset
    );

    this.vehicle.x = currentSample.finalX;
    this.vehicle.z = currentSample.finalZ;
    this.vehicle.heading = currentSample.heading;
    this.vehicle.roll = currentSample.roll;
  }

  // Get Live Telemetry Metrics
  public getMetrics(): SimMetrics {
    const v = this.vehicle;
    const speedKmh = Math.round(v.speed * 2.8);
    const distRemaining = Math.round(v.distanceRemaining * 4.5);
    const etaSec = v.speed > 1 ? Math.round(v.distanceRemaining / v.speed) : 0;
    const timeSavedSec = this.config.greenCorridorActive
      ? Math.min(38, Math.round(v.redLightsAvoided * 8.5 + v.distanceTraveled * 0.04))
      : 0;
    const timeSavedPercent = this.config.greenCorridorActive
      ? Math.min(46, Math.round((timeSavedSec / Math.max(1, v.totalTime + timeSavedSec)) * 100))
      : 0;

    return {
      elapsedTimeSec: Math.round(v.totalTime * 10) / 10,
      etaSec,
      speedKmh,
      distanceRemainingMeters: distRemaining,
      completedJunctions: v.currentJunctionIndex,
      totalJunctions: CORRIDOR_JUNCTION_NODES.length,
      redLightsHit: v.redLightsHit,
      redLightsAvoided: v.redLightsAvoided,
      timeSavedSec,
      timeSavedPercent,
      avgSpeedKmh: v.totalTime > 0 ? Math.round((v.distanceTraveled / v.totalTime) * 2.8) : speedKmh,
      signalsPreempted: this.junctions.filter((j) => j.cleared || j.preemptionState !== "NORMAL").length,
    };
  }

  private logDecision(
    junctionName: string,
    action: string,
    detail: string,
    type: DecisionLogEntry["type"]
  ) {
    const time = `${Math.floor(this.elapsedTime / 60)}:${String(
      Math.floor(this.elapsedTime % 60)
    ).padStart(2, "0")}`;

    const entry: DecisionLogEntry = {
      id: `LOG-${this.nextLogId++}`,
      timestamp: time,
      junctionName,
      action,
      detail,
      type,
    };

    this.decisionLogs.unshift(entry);
    if (this.decisionLogs.length > 25) {
      this.decisionLogs.pop();
    }
  }
}
