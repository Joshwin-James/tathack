// Real-Time CCTV Analytics Engine: Congestion, Incidents, Density Sparklines
import {
  CameraAnalyticsState,
  CountingLine,
  IncidentAlert,
  RawDetection,
  TargetClass,
  TrackedObject,
} from "./types";
import { ObjectTracker } from "./tracker";

export interface IncidentCallback {
  (incident: IncidentAlert): void;
}

export class CameraAnalyticsEngine {
  public readonly cameraId: string;
  public readonly location: string;
  private tracker: ObjectTracker;
  public countingLine: CountingLine;

  private totalPassed: number = 0;
  private classCounts: Record<TargetClass, number> = {
    car: 0,
    truck: 0,
    bus: 0,
    motorcycle: 0,
    person: 0,
  };

  private densityHistory: { time: string; density: number }[] = [];
  private activeIncident: IncidentAlert | null = null;
  private lastIncident: IncidentAlert | null = null;
  private lastIncidentTime: number = 0;
  private readonly incidentCooldownMs: number = 40000; // 40s cooldown to prevent notification spam

  private lastFpsTime: number = performance.now();
  private frameCount: number = 0;
  private currentFps: number = 0;

  // Previous density for spike detection
  private prevDensity: number = 0;
  private lastSpikeCheckTime: number = performance.now();

  constructor(
    cameraId: string,
    location: string,
    initialCount: number = 40,
    countingLine: CountingLine = { p1: [0.1, 0.65], p2: [0.9, 0.65] }
  ) {
    this.cameraId = cameraId;
    this.location = location;
    this.totalPassed = initialCount;
    this.tracker = new ObjectTracker();
    this.countingLine = countingLine;

    // Seed initial density history sparkline
    const now = new Date();
    for (let i = 12; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 4000);
      const timeStr = `${d.getMinutes()}:${d.getSeconds() < 10 ? "0" : ""}${d.getSeconds()}`;
      this.densityHistory.push({
        time: timeStr,
        density: Math.max(1, Math.min(8, Math.floor(initialCount / 15) + (i % 3))),
      });
    }
  }

  public processFrame(
    detections: RawDetection[],
    onIncident?: IncidentCallback
  ): CameraAnalyticsState {
    const now = performance.now();

    // 1. Calculate FPS
    this.frameCount++;
    if (now - this.lastFpsTime >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    // 2. Multi-Object Tracking & Line Crossing
    const { tracks, newlyCrossed, stalledTracks } = this.tracker.update(
      detections,
      now,
      this.countingLine
    );

    // Update vehicle counts from line crossings
    for (const cross of newlyCrossed) {
      this.totalPassed++;
      this.classCounts[cross.class] = (this.classCounts[cross.class] || 0) + 1;
    }

    // 3. Density & Congestion Calculation
    const vehicleTracks = tracks.filter((t) => t.class !== "person");
    const objectsInFrame = tracks.length;
    const avgSpeed =
      vehicleTracks.length > 0
        ? vehicleTracks.reduce((acc, t) => acc + t.speed, 0) / vehicleTracks.length
        : 0.05;

    let congestion: "Low" | "Medium" | "High" = "Low";
    if (vehicleTracks.length >= 6 || (vehicleTracks.length >= 4 && avgSpeed < 0.02)) {
      congestion = "High";
    } else if (vehicleTracks.length >= 3 || avgSpeed < 0.04) {
      congestion = "Medium";
    }

    // 4. Update Density Sparkline History (every ~2.5s)
    if (this.densityHistory.length === 0 || now - this.lastSpikeCheckTime >= 2500) {
      const d = new Date();
      const timeStr = `${d.getMinutes()}:${d.getSeconds() < 10 ? "0" : ""}${d.getSeconds()}`;
      this.densityHistory.push({ time: timeStr, density: objectsInFrame });
      if (this.densityHistory.length > 15) {
        this.densityHistory.shift();
      }
      this.lastSpikeCheckTime = now;
    }

    // 5. Incident Detection Rules
    const canTriggerIncident = now - this.lastIncidentTime > this.incidentCooldownMs;

    // Rule A: Stalled Vehicle Detection (>10s stationary)
    if (stalledTracks.length > 0 && canTriggerIncident) {
      const stalled = stalledTracks[0];
      const incident: IncidentAlert = {
        id: `INC-STALL-${this.cameraId}-${Math.floor(now)}`,
        type: "stalled_vehicle",
        title: `Stalled ${stalled.class.toUpperCase()} Detected`,
        description: `Stationary vehicle #${stalled.id} detected at ${this.location}. Potential obstruction on carriageway.`,
        severity: "critical",
        timestamp: Date.now(),
        cameraId: this.cameraId,
        location: this.location,
        trackId: stalled.id,
      };

      this.activeIncident = incident;
      this.lastIncident = incident;
      this.lastIncidentTime = now;
      onIncident?.(incident);
    }

    // Rule B: Pedestrian on Carriageway (>5s active person in traffic view)
    const longPedestrians = tracks.filter(
      (t) => t.class === "person" && now - t.firstSeen > 5000
    );
    if (longPedestrians.length > 0 && canTriggerIncident && !this.activeIncident) {
      const ped = longPedestrians[0];
      const incident: IncidentAlert = {
        id: `INC-PED-${this.cameraId}-${Math.floor(now)}`,
        type: "pedestrian_danger",
        title: "Pedestrian on Roadway",
        description: `Pedestrian #${ped.id} detected on arterial corridor for >5s at ${this.location}. Safety hazard.`,
        severity: "warning",
        timestamp: Date.now(),
        cameraId: this.cameraId,
        location: this.location,
        trackId: ped.id,
      };

      this.activeIncident = incident;
      this.lastIncident = incident;
      this.lastIncidentTime = now;
      onIncident?.(incident);
    }

    // Rule C: Sudden Congestion Spike (>60% increase in <10s)
    if (
      objectsInFrame >= 6 &&
      this.prevDensity > 0 &&
      objectsInFrame >= this.prevDensity * 1.6 &&
      canTriggerIncident &&
      !this.activeIncident
    ) {
      const incident: IncidentAlert = {
        id: `INC-SPIKE-${this.cameraId}-${Math.floor(now)}`,
        type: "congestion_spike",
        title: "Sudden Congestion Surge",
        description: `Traffic volume surged +65% at ${this.location}. Adaptive signal clearance advised.`,
        severity: "warning",
        timestamp: Date.now(),
        cameraId: this.cameraId,
        location: this.location,
      };

      this.activeIncident = incident;
      this.lastIncident = incident;
      this.lastIncidentTime = now;
      onIncident?.(incident);
    }

    this.prevDensity = objectsInFrame;

    // Reset active incident banner after 12 seconds
    if (this.activeIncident && now - this.lastIncidentTime > 12000) {
      this.activeIncident = null;
    }

    return {
      cameraId: this.cameraId,
      fps: this.currentFps,
      objectsInFrame,
      classCounts: { ...this.classCounts },
      totalPassed: this.totalPassed,
      congestion,
      avgSpeed: Math.round(avgSpeed * 1000) / 10,
      densityHistory: [...this.densityHistory],
      activeIncident: this.activeIncident,
      lastIncident: this.lastIncident,
      tracks,
    };
  }

  public reset() {
    this.tracker.reset();
    this.activeIncident = null;
  }
}
