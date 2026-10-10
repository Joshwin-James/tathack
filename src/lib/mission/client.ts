// Supabase Realtime Broadcast & Cross-Tab BroadcastChannel Emergency Mission Client
import { createClient, SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { MissionState, MissionStatus } from "./types";
import { generateMissionPatient } from "./patient";

export const DEFAULT_MISSION: MissionState = {
  id: "mission-kl-01",
  status: "idle",
  vehicleType: "ambulance",
  patient: generateMissionPatient(101),
  origin: "Incident Scene (Kaloor North)",
  destination: "Aster Medcity Trauma ICU",
  etaSeconds: 42,
  distanceMeters: 1850,
  nextJunction: "Kaloor Junction",
  distanceToNextJunctionM: 180,
  junctions: [
    { name: "Kaloor Junction", state: "NORMAL" },
    { name: "Palarivattom Flyover", state: "NORMAL" },
    { name: "Edappally Toll Jn", state: "NORMAL" },
    { name: "Vyttila Mobility Hub", state: "NORMAL" },
    { name: "Aster Medcity Hospital", state: "NORMAL" },
  ],
  position: { lat: 9.9985, lng: 76.2920 },
  startedAt: Date.now(),
  updatedAt: Date.now(),
  speedKmh: 0,
  trafficYieldCount: 0,
  redLightsAvoided: 0,
};

type MissionListener = (state: MissionState) => void;
type SubscriberCountListener = (count: number) => void;

class EmergencyMissionClient {
  private supabase: SupabaseClient | null = null;
  private realtimeChannel: RealtimeChannel | null = null;
  private localBroadcast: BroadcastChannel | null = null;
  private listeners: Set<MissionListener> = new Set();
  private countListeners: Set<SubscriberCountListener> = new Set();
  private currentState: MissionState = { ...DEFAULT_MISSION };
  private lastPublishTime = 0;
  private pendingPublishState: Partial<MissionState> | null = null;
  private throttleTimer: any = null;
  private subscriberCount = 1;
  private clientId = `client-${Math.random().toString(36).substring(2, 9)}`;
  private isCitizenSubscriber = false;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === "undefined") return;

    // 1. Initialize Browser BroadcastChannel (Instant local cross-tab fallback)
    try {
      if ("BroadcastChannel" in window) {
        this.localBroadcast = new BroadcastChannel("sentinel-mission");
        this.localBroadcast.onmessage = (event) => {
          if (event.data?.type === "MISSION_UPDATE" && event.data.payload) {
            this.receiveUpdate(event.data.payload);
          } else if (event.data?.type === "PRESENCE_PING") {
            if (this.isCitizenSubscriber) {
              this.localBroadcast?.postMessage({ type: "PRESENCE_PONG", clientId: this.clientId });
            }
          } else if (event.data?.type === "PRESENCE_COUNT") {
            this.subscriberCount = Math.max(1, event.data.count || 1);
            this.notifyCountListeners();
          }
        };
      }
    } catch (e) {
      console.warn("BroadcastChannel not available:", e);
    }

    // 2. Initialize Supabase Realtime if credentials exist
    const supabaseUrl =
      (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SUPABASE_URL) ||
      (typeof process !== "undefined" && process.env?.SUPABASE_URL) ||
      "";
    const supabaseAnonKey =
      (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
      (typeof process !== "undefined" && process.env?.SUPABASE_ANON_KEY) ||
      "";

    if (supabaseUrl && supabaseAnonKey && supabaseUrl !== "undefined") {
      try {
        this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
          realtime: { params: { eventsPerSecond: 10 } },
        });

        this.realtimeChannel = this.supabase.channel("sentinel-mission", {
          config: {
            broadcast: { self: false },
            presence: { key: this.clientId },
          },
        });

        this.realtimeChannel
          .on("broadcast", { event: "mission-update" }, (payload) => {
            if (payload.payload) {
              this.receiveUpdate(payload.payload as MissionState);
            }
          })
          .on("presence", { event: "sync" }, () => {
            const state = this.realtimeChannel?.presenceState() || {};
            const count = Object.keys(state).length;
            this.subscriberCount = Math.max(1, count);
            this.notifyCountListeners();
          })
          .subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
              await this.realtimeChannel?.track({
                online_at: new Date().toISOString(),
                clientId: this.clientId,
                isCitizen: this.isCitizenSubscriber,
              });
            }
          });
      } catch (err) {
        console.warn("Supabase Realtime init fallback:", err);
      }
    }
  }

  public registerCitizenPresence(enabled: boolean) {
    this.isCitizenSubscriber = enabled;
    if (this.realtimeChannel) {
      this.realtimeChannel.track({
        online_at: new Date().toISOString(),
        clientId: this.clientId,
        isCitizen: enabled,
      });
    }
  }

  public subscribe(listener: MissionListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeCount(listener: SubscriberCountListener): () => void {
    this.countListeners.add(listener);
    listener(this.subscriberCount);
    return () => {
      this.countListeners.delete(listener);
    };
  }

  public getState(): MissionState {
    return this.currentState;
  }

  public getSubscriberCount(): number {
    return this.subscriberCount;
  }

  private receiveUpdate(updatedState: MissionState) {
    this.currentState = { ...this.currentState, ...updatedState };
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentState);
      } catch (err) {
        console.error("Mission listener error:", err);
      }
    });
  }

  private notifyCountListeners() {
    this.countListeners.forEach((listener) => {
      try {
        listener(this.subscriberCount);
      } catch (err) {
        console.error("Mission count listener error:", err);
      }
    });
  }

  // Throttled Publishing (Max 2 per second = 500ms interval)
  public publish(state: Partial<MissionState>) {
    const now = Date.now();
    this.pendingPublishState = { ...this.pendingPublishState, ...state };

    // Update local state immediately for snappy UI
    this.currentState = {
      ...this.currentState,
      ...this.pendingPublishState,
      updatedAt: now,
    };
    this.notifyListeners();

    const timeSinceLastPublish = now - this.lastPublishTime;
    if (timeSinceLastPublish >= 500) {
      this.flushPublish();
    } else if (!this.throttleTimer) {
      this.throttleTimer = setTimeout(() => {
        this.flushPublish();
      }, 500 - timeSinceLastPublish);
    }
  }

  private flushPublish() {
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }

    const payload = { ...this.currentState, updatedAt: Date.now() };
    this.lastPublishTime = Date.now();
    this.pendingPublishState = null;

    // 1. Broadcast to local cross-tab channel
    if (this.localBroadcast) {
      try {
        this.localBroadcast.postMessage({ type: "MISSION_UPDATE", payload });
      } catch (e) {
        console.warn("Local broadcast failed:", e);
      }
    }

    // 2. Broadcast via Supabase Realtime
    if (this.realtimeChannel) {
      try {
        this.realtimeChannel.send({
          type: "broadcast",
          event: "mission-update",
          payload,
        });
      } catch (e) {
        console.warn("Supabase Realtime broadcast failed:", e);
      }
    }

    // 3. Write start/complete history to Supabase 'missions' table
    if (this.supabase && (payload.status === "dispatched" || payload.status === "completed")) {
      this.persistMissionHistory(payload);
    }
  }

  private async persistMissionHistory(m: MissionState) {
    if (!this.supabase) return;
    try {
      await this.supabase.from("missions").upsert(
        {
          id: m.id,
          status: m.status,
          vehicle_type: m.vehicleType,
          patient_severity: m.patient.severity,
          patient_age: m.patient.age,
          patient_condition: m.patient.condition,
          patient_blood_group: m.patient.bloodGroup,
          origin: m.origin,
          destination: m.destination,
          duration_seconds: Math.round(m.etaSeconds),
          distance_meters: Math.round(m.distanceMeters),
          started_at: new Date(m.startedAt).toISOString(),
          completed_at: m.status === "completed" ? new Date().toISOString() : null,
        },
        { onConflict: "id" }
      );
    } catch (err) {
      // Table might not exist or network unavailable in offline demo mode - safe to ignore
      console.warn("Note: missions table write skipped:", err);
    }
  }
}

export const emergencyMissionClient = new EmergencyMissionClient();
