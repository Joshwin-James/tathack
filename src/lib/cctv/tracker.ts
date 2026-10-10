// Multi-Object IoU & Centroid Tracker with Trajectory History and Stalled Detection
import { RawDetection, TrackedObject, CountingLine, TargetClass } from "./types";

// Intersection over Union (IoU) calculation between two normalized bounding boxes [x, y, w, h]
export function calculateIoU(
  boxA: [number, number, number, number],
  boxB: [number, number, number, number]
): number {
  const [ax, ay, aw, ah] = boxA;
  const [bx, by, bw, bh] = boxB;

  const x1 = Math.max(ax, bx);
  const y1 = Math.max(ay, by);
  const x2 = Math.min(ax + aw, bx + bw);
  const y2 = Math.min(ay + ah, by + bh);

  const interWidth = Math.max(0, x2 - x1);
  const interHeight = Math.max(0, y2 - y1);
  const interArea = interWidth * interHeight;

  const areaA = aw * ah;
  const areaB = bw * bh;
  const unionArea = areaA + areaB - interArea;

  if (unionArea <= 0) return 0;
  return interArea / unionArea;
}

// Distance between two 2D points
export function euclideanDistance(p1: [number, number], p2: [number, number]): number {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return Math.sqrt(dx * dx + dy * dy);
}

// Line segment intersection test
function doSegmentsIntersect(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  p4: [number, number]
): boolean {
  const ccw = (a: [number, number], b: [number, number], c: [number, number]) => {
    return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
  };
  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
    ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
}

export class ObjectTracker {
  private nextId: number = 100;
  private tracks: Map<number, TrackedObject> = new Map();
  private readonly maxLostTimeMs: number = 2000;
  private readonly stallSpeedThreshold: number = 0.008; // Normalized units per second
  private readonly stallDurationThresholdMs: number = 10000; // 10 seconds

  public update(
    detections: RawDetection[],
    now: number,
    countingLine?: CountingLine
  ): {
    tracks: TrackedObject[];
    newlyCrossed: { track: TrackedObject; class: TargetClass }[];
    stalledTracks: TrackedObject[];
  } {
    const activeTrackIds = Array.from(this.tracks.keys());
    const matchedTrackIds = new Set<number>();
    const matchedDetectionIndices = new Set<number>();
    const newlyCrossed: { track: TrackedObject; class: TargetClass }[] = [];
    const stalledTracks: TrackedObject[] = [];

    // 1. Match detections to existing tracks using IoU + Centroid proximity
    for (let i = 0; i < detections.length; i++) {
      const det = detections[i];
      const detCentroid: [number, number] = [
        det.bbox[0] + det.bbox[2] / 2,
        det.bbox[1] + det.bbox[3] / 2,
      ];

      let bestTrackId: number | null = null;
      let bestScore = -1;

      for (const trackId of activeTrackIds) {
        if (matchedTrackIds.has(trackId)) continue;
        const track = this.tracks.get(trackId)!;

        // Ensure class matches or is closely related vehicle
        if (track.class !== det.class) {
          const isBothVehicles =
            ["car", "truck", "bus", "motorcycle"].includes(track.class) &&
            ["car", "truck", "bus", "motorcycle"].includes(det.class);
          if (!isBothVehicles) continue;
        }

        const iou = calculateIoU(track.bbox, det.bbox);
        const dist = euclideanDistance(track.centroid, detCentroid);

        // Combined matching score
        const score = iou > 0.1 ? iou * 2 : dist < 0.15 ? 1 - dist / 0.15 : -1;

        if (score > 0.25 && score > bestScore) {
          bestScore = score;
          bestTrackId = trackId;
        }
      }

      if (bestTrackId !== null) {
        matchedTrackIds.add(bestTrackId);
        matchedDetectionIndices.add(i);

        const track = this.tracks.get(bestTrackId)!;
        const dtSec = Math.max(0.01, (now - track.lastSeen) / 1000);
        const stepDist = euclideanDistance(track.centroid, detCentroid);
        const currentSpeed = stepDist / dtSec;

        // Smooth speed with exponential moving average
        const smoothedSpeed = track.speed * 0.6 + currentSpeed * 0.4;

        // Check if track is stationary
        let stationarySince = track.stationarySince;
        if (smoothedSpeed < this.stallSpeedThreshold) {
          if (!stationarySince) {
            stationarySince = now;
          }
        } else {
          // Moved significantly -> reset stationary timer
          if (stepDist > 0.02) {
            stationarySince = null;
          }
        }

        const isStalled =
          track.class !== "person" &&
          stationarySince !== null &&
          now - stationarySince >= this.stallDurationThresholdMs;

        // Update trajectory history
        const newHistory = [...track.history, detCentroid].slice(-16);

        // Check counting line crossing
        let crossedLine = track.crossedLine;
        if (!crossedLine && countingLine && track.history.length >= 2) {
          const pPrev = track.history[track.history.length - 1];
          if (doSegmentsIntersect(pPrev, detCentroid, countingLine.p1, countingLine.p2)) {
            crossedLine = true;
            newlyCrossed.push({ track, class: det.class });
          }
        }

        const updatedTrack: TrackedObject = {
          ...track,
          class: det.class,
          score: det.score,
          bbox: det.bbox,
          centroid: detCentroid,
          history: newHistory,
          lastSeen: now,
          stationarySince,
          speed: smoothedSpeed,
          isStalled,
          crossedLine,
        };

        this.tracks.set(bestTrackId, updatedTrack);

        if (isStalled && !track.isStalled) {
          stalledTracks.push(updatedTrack);
        }
      }
    }

    // 2. Create new tracks for unmatched detections
    for (let i = 0; i < detections.length; i++) {
      if (matchedDetectionIndices.has(i)) continue;
      const det = detections[i];
      const centroid: [number, number] = [
        det.bbox[0] + det.bbox[2] / 2,
        det.bbox[1] + det.bbox[3] / 2,
      ];

      const newId = this.nextId++;
      const newTrack: TrackedObject = {
        id: newId,
        class: det.class,
        score: det.score,
        bbox: det.bbox,
        centroid,
        history: [centroid],
        firstSeen: now,
        lastSeen: now,
        stationarySince: null,
        speed: 0.05,
        isStalled: false,
        crossedLine: false,
      };

      this.tracks.set(newId, newTrack);
    }

    // 3. Remove stale / lost tracks
    for (const [id, track] of this.tracks.entries()) {
      if (now - track.lastSeen > this.maxLostTimeMs) {
        this.tracks.delete(id);
      }
    }

    return {
      tracks: Array.from(this.tracks.values()),
      newlyCrossed,
      stalledTracks,
    };
  }

  public reset() {
    this.tracks.clear();
  }
}
