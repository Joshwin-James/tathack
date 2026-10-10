// Headless 60-Second Automated Collision Safety & Clipping Verification Test
import { CorridorSimulation } from "./corridor-sim";

export interface CollisionTestResult {
  passed: boolean;
  simulatedSeconds: number;
  stepsRun: number;
  minInterVehicleDistance: number;
  totalCollisionEvents: number;
  details: string;
}

export function runHeadlessCollisionTest(durationSec = 60, dt = 1 / 60): CollisionTestResult {
  const sim = new CorridorSimulation({ greenCorridorActive: true, scenario: "rush_hour" }, 12345);
  const steps = Math.floor(durationSec / dt);

  let minDistance = Infinity;
  let collisionCount = 0;
  const collisionThreshold = 2.8; // Minimum center-to-center distance required to prevent physical overlap

  for (let step = 0; step < steps; step++) {
    sim.step(dt);

    const amb = sim.vehicle;
    const cars = sim.cars;

    // 1. Check distance between ambulance and all traffic cars
    for (const car of cars) {
      const deltaS = Math.abs(amb.distanceTraveled - car.distanceAlongRoad);
      const deltaLat = Math.abs(amb.currentLateralOffset - car.lateralOffset);
      const euclideanDist = Math.hypot(amb.x - car.x, amb.z - car.z);

      if (euclideanDist < minDistance) minDistance = euclideanDist;

      // True physical collision occurs if cars overlap along road (deltaS < 3.8) AND on same lane/offset (deltaLat < 1.8)
      if (deltaS < 3.8 && deltaLat < 1.8) {
        collisionCount++;
      }
    }

    // 2. Check distance between each pair of traffic cars
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const carA = cars[i];
        const carB = cars[j];

        const deltaS = Math.abs(carA.distanceAlongRoad - carB.distanceAlongRoad);
        const deltaLat = Math.abs(carA.lateralOffset - carB.lateralOffset);
        const euclideanDist = Math.hypot(carA.x - carB.x, carA.z - carB.z);

        if (euclideanDist < minDistance) minDistance = euclideanDist;

        // Physical collision check
        if (carA.roadSegmentId === carB.roadSegmentId && deltaS < 3.8 && deltaLat < 1.8) {
          collisionCount++;
        }
      }
    }
  }

  const passed = collisionCount === 0;

  return {
    passed,
    simulatedSeconds: durationSec,
    stepsRun: steps,
    minInterVehicleDistance: Math.round(minDistance * 100) / 100,
    totalCollisionEvents: collisionCount,
    details: passed
      ? `PASSED: 60s simulated (${steps} steps) with 0 clipping/collision events. Minimum vehicle separation was ${minDistance.toFixed(
          2
        )}m.`
      : `FAILED: ${collisionCount} overlap events detected below threshold ${collisionThreshold}m.`,
  };
}
