// Single-Threaded Round-Robin Vision AI Inference Scheduler
import { RawDetection, TargetClass, TARGET_CLASSES } from "./types";

export interface VideoFeedTarget {
  id: string;
  videoElement: HTMLVideoElement | null;
  onDetections: (detections: RawDetection[]) => void;
}

export class InferenceScheduler {
  private model: any = null;
  private isRunning: boolean = false;
  private isInferring: boolean = false;
  private feeds: Map<string, VideoFeedTarget> = new Map();
  private selectedFeedId: string | null = null;
  private lastInferenceTime: Map<string, number> = new Map();
  private rafId: number | null = null;

  // Frame rate intervals (ms)
  private readonly selectedIntervalMs: number = 125; // ~8 FPS for focused feed
  private readonly backgroundIntervalMs: number = 380; // ~2.6 FPS for background feeds

  constructor(model: any) {
    this.model = model;
  }

  public setModel(model: any) {
    this.model = model;
  }

  public registerFeed(id: string, target: VideoFeedTarget) {
    this.feeds.set(id, target);
  }

  public unregisterFeed(id: string) {
    this.feeds.delete(id);
    this.lastInferenceTime.delete(id);
  }

  public setSelectedFeed(id: string | null) {
    this.selectedFeedId = id;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleNext();
  }

  public stop() {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private scheduleNext() {
    if (!this.isRunning) return;
    this.rafId = requestAnimationFrame(() => this.step());
  }

  private async step() {
    if (!this.isRunning) return;

    // Skip inference when page is hidden or model is not ready
    if (typeof document !== "undefined" && document.hidden) {
      this.scheduleNext();
      return;
    }

    if (!this.model || this.isInferring) {
      this.scheduleNext();
      return;
    }

    const now = performance.now();
    const feedIds = Array.from(this.feeds.keys());
    if (feedIds.length === 0) {
      this.scheduleNext();
      return;
    }

    // Prioritize selected feed, then round-robin over background feeds
    let targetFeedId: string | null = null;

    if (this.selectedFeedId && this.feeds.has(this.selectedFeedId)) {
      const lastTime = this.lastInferenceTime.get(this.selectedFeedId) || 0;
      if (now - lastTime >= this.selectedIntervalMs) {
        targetFeedId = this.selectedFeedId;
      }
    }

    if (!targetFeedId) {
      // Find oldest pending background feed
      let oldestTime = Infinity;
      for (const id of feedIds) {
        const lastTime = this.lastInferenceTime.get(id) || 0;
        const interval = id === this.selectedFeedId ? this.selectedIntervalMs : this.backgroundIntervalMs;
        if (now - lastTime >= interval && lastTime < oldestTime) {
          oldestTime = lastTime;
          targetFeedId = id;
        }
      }
    }

    if (targetFeedId) {
      const feed = this.feeds.get(targetFeedId);
      const video = feed?.videoElement;

      if (
        video &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0 &&
        !video.paused &&
        !video.ended
      ) {
        this.isInferring = true;
        this.lastInferenceTime.set(targetFeedId, now);

        try {
          // Perform COCO-SSD object detection
          const predictions = await this.model.detect(video, 10, 0.45);
          const detections: RawDetection[] = [];

          const vW = video.videoWidth;
          const vH = video.videoHeight;

          for (const p of predictions) {
            let cls = p.class.toLowerCase();
            if (cls === "bicycle") cls = "motorcycle";

            if (TARGET_CLASSES.includes(cls as TargetClass) && p.score >= 0.45) {
              const [bx, by, bw, bh] = p.bbox;
              // Normalize bounding box coordinates to [0..1]
              detections.push({
                class: cls as TargetClass,
                score: Math.round(p.score * 100) / 100,
                bbox: [bx / vW, by / vH, bw / vW, bh / vH],
              });
            }
          }

          feed.onDetections(detections);
        } catch (err) {
          console.warn(`[CCTV Scheduler] Inference error on ${targetFeedId}:`, err);
        } finally {
          this.isInferring = false;
        }
      }
    }

    this.scheduleNext();
  }
}
