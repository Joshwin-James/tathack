// Smooth Continuous Route Spline with Turning Arcs, Tangents, Curvature & Left-Hand Offsets

export interface PathSample {
  s: number; // Arc length from start
  x: number;
  z: number;
  heading: number; // Radians
  tangent: [number, number]; // [dx, dz] normalized
  normal: [number, number]; // Left-pointing normal [-dz, dx]
  curvature: number; // 1/R (positive for left turn, negative for right turn)
  speedFactor: number; // 0.6 in sharp turns, 1.0 on straightaways
  roll: number; // Banking angle in radians
}

export class CorridorSpline {
  public samples: PathSample[] = [];
  public totalLength: number = 0;

  constructor() {
    this.buildSpline();
  }

  private buildSpline() {
    // Waypoint definitions with turning radii
    // (2 Right Turns at Kaloor & Edappally, 2 Left Turns at Palarivattom & Vyttila, plus gentle curve into Aster Medcity)
    const rawPoints: [number, number][] = [
      [-190, -100], // Start Incident Site
      [-112, -100], // Approach Kaloor
      // Right Turn 1 at Kaloor (East -> South)
      [-100, -88],  // Post-turn Kaloor heading South
      [-100, -32],  // Approach Palarivattom
      // Left Turn 2 at Palarivattom (South -> East)
      [-88, -20],   // Post-turn Palarivattom heading East
      [8, -20],     // Approach Edappally
      // Right Turn 3 at Edappally (East -> South)
      [20, -8],     // Post-turn Edappally heading South
      [20, 68],     // Approach Vyttila
      // Left Turn 4 at Vyttila (South -> East)
      [32, 80],     // Post-turn Vyttila heading East
      [150, 80],    // Straight stretch East
      // Gentle curve into Aster Medcity
      [190, 65],
      [215, 30],
      [230, 0],     // Aster Medcity Hospital Helipad / ER Bay
    ];

    // High resolution subdivision using Catmull-Rom interpolation with smooth tangents
    const numSubdivisions = 600;
    const densePoints: [number, number][] = [];

    for (let i = 0; i < rawPoints.length - 1; i++) {
      const p0 = rawPoints[Math.max(0, i - 1)];
      const p1 = rawPoints[i];
      const p2 = rawPoints[i + 1];
      const p3 = rawPoints[Math.min(rawPoints.length - 1, i + 2)];

      const steps = Math.floor(numSubdivisions / (rawPoints.length - 1));
      for (let t = 0; t < steps; t++) {
        const u = t / steps;
        const u2 = u * u;
        const u3 = u2 * u;

        // Catmull-Rom Spline Formula
        const x =
          0.5 *
          (2 * p1[0] +
            (-p0[0] + p2[0]) * u +
            (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 +
            (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3);

        const z =
          0.5 *
          (2 * p1[1] +
            (-p0[1] + p2[1]) * u +
            (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 +
            (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3);

        densePoints.push([x, z]);
      }
    }
    densePoints.push(rawPoints[rawPoints.length - 1]);

    // Compute arc lengths, headings, normals, and curvatures
    let currentDist = 0;
    this.samples = [];

    for (let i = 0; i < densePoints.length; i++) {
      const curr = densePoints[i];
      const prev = densePoints[Math.max(0, i - 1)];
      const next = densePoints[Math.min(densePoints.length - 1, i + 1)];

      const segLen = Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);
      currentDist += segLen;

      // Tangent vector
      const dx = next[0] - prev[0];
      const dz = next[1] - prev[1];
      const len = Math.hypot(dx, dz) || 1;
      const tx = dx / len;
      const tz = dz / len;

      // Heading angle (0 rad = +X, PI/2 rad = +Z)
      const heading = Math.atan2(tz, tx);

      // Normal vector (pointing left for Indian Left-Hand Drive)
      const normal: [number, number] = [-tz, tx];

      // Curvature approximation: dTheta / ds
      const nextNext = densePoints[Math.min(densePoints.length - 1, i + 2)];
      const nextHeading = Math.atan2(nextNext[1] - curr[1], nextNext[0] - curr[0]);
      let dHeading = nextHeading - heading;
      while (dHeading > Math.PI) dHeading -= 2 * Math.PI;
      while (dHeading < -Math.PI) dHeading += 2 * Math.PI;
      const curvature = dHeading / (Math.max(0.1, segLen) * 2);

      // Speed factor: slow down in sharp turns to ~40% (0.6x)
      const turnSeverity = Math.min(1.0, Math.abs(curvature) * 18);
      const speedFactor = 1.0 - turnSeverity * 0.42;

      // Banking angle (roll) into turns
      const roll = Math.max(-0.16, Math.min(0.16, curvature * 2.5));

      this.samples.push({
        s: currentDist,
        x: curr[0],
        z: curr[1],
        heading,
        tangent: [tx, tz],
        normal,
        curvature,
        speedFactor,
        roll,
      });
    }

    this.totalLength = currentDist;
  }

  // Sample the spline at a specific arc length distance `dist`
  public sampleAtDistance(dist: number, lateralOffset = 0): PathSample & { finalX: number; finalZ: number } {
    const clampedDist = Math.max(0, Math.min(this.totalLength, dist));

    // Binary search for closest sample
    let low = 0;
    let high = this.samples.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.samples[mid].s < clampedDist) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx = Math.max(0, Math.min(this.samples.length - 1, low));
    const sample = this.samples[idx];

    // Apply lateral offset along normal (left/right of lane)
    const finalX = sample.x + sample.normal[0] * lateralOffset;
    const finalZ = sample.z + sample.normal[1] * lateralOffset;

    return {
      ...sample,
      finalX,
      finalZ,
    };
  }

  // Get sample at progress [0..1]
  public sampleAtProgress(progress: number, lateralOffset = 0) {
    return this.sampleAtDistance(progress * this.totalLength, lateralOffset);
  }
}

export const sharedCorridorSpline = new CorridorSpline();
