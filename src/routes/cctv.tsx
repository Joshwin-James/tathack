import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { GlassCard, LiveBadge, SeverityChip } from "@/components/ui-kit";
import { createAssignmentServerFn, dispatchRealtime } from "@/lib/dispatch";
import { cctvFeeds, CctvFeed } from "@/data/kochi";
import { cn } from "@/lib/utils";
import {
  Video,
  Activity,
  Radio,
  Eye,
  Crosshair,
  TrendingUp,
  AlertTriangle,
  Layers,
  Car,
  Truck,
  Bus,
  Footprints,
  Maximize2,
  Minimize2,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Sliders,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSentinelStore } from "@/lib/store";
import {
  CameraAnalyticsEngine,
  InferenceScheduler,
  loadCocoSsdModel,
  CLASS_COLORS,
  RawDetection,
  CameraAnalyticsState,
  IncidentAlert,
  TargetClass,
} from "@/lib/cctv";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export const Route = createFileRoute("/cctv")({
  head: () => ({
    meta: [
      { title: "Real-Time AI Vision CCTV · Kochi | Project Sentinel" },
      {
        name: "description",
        content:
          "Live in-browser COCO-SSD object detection across Kochi CCTV network with multi-object tracking, count lines, and stalled vehicle incident triggers.",
      },
      { property: "og:title", content: "Vision AI CCTV Analytics · Kochi" },
      {
        property: "og:description",
        content: "Real-time client-side neural vision monitoring for Kochi arterial corridors.",
      },
    ],
  }),
  component: CctvPage,
});

// Single shared scheduler instance for the session
let globalScheduler: InferenceScheduler | null = null;

function CctvPage() {
  const { addIncident } = useSentinelStore();

  const [modelLoading, setModelLoading] = useState<boolean>(true);
  const [modelStatusText, setModelStatusText] = useState<string>(
    "Initializing WebGL neural engine..."
  );
  const [modelError, setModelError] = useState<string | null>(null);

  // Settings & Toggles
  const [showBoxes, setShowBoxes] = useState<boolean>(true);
  const [showTracks, setShowTracks] = useState<boolean>(true);
  const [showCountingLine, setShowCountingLine] = useState<boolean>(true);
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);

  // Per-camera live analytics state
  const [analyticsMap, setAnalyticsMap] = useState<Record<string, CameraAnalyticsState>>({});
  const [globalIncidents, setGlobalIncidents] = useState<IncidentAlert[]>([]);

  // Analytics engines map (one instance per camera to maintain tracker state)
  const enginesRef = useRef<Map<string, CameraAnalyticsEngine>>(new Map());

  // Incident handler synced with Sentinel Global Store
  const handleIncidentTriggered = useCallback(
    (incident: IncidentAlert) => {
      setGlobalIncidents((prev) => [incident, ...prev.slice(0, 19)]);

      // Dispatch to main Sentinel Command Center store
      addIncident({
        title: incident.title,
        location: incident.location,
        severity: incident.severity,
        confidence: 96,
        department:
          incident.type === "stalled_vehicle"
            ? "Traffic Police + Tow Unit"
            : incident.type === "pedestrian_danger"
              ? "Traffic Police"
              : "Municipal + Traffic",
        category:
          incident.type === "stalled_vehicle"
            ? "accident"
            : incident.type === "pedestrian_danger"
              ? "crowd"
              : "congestion",
        lng: cctvFeeds.find((f) => f.id === incident.cameraId)?.lng || 76.3216,
        lat: cctvFeeds.find((f) => f.id === incident.cameraId)?.lat || 9.9678,
      });

      // Synchronize with Unified Dispatch Engine
      createAssignmentServerFn({
        data: {
          title: `CCTV Alert: ${incident.title}`,
          description: `Neural vision automated alert from camera node ${incident.cameraId} at ${incident.location}. Stalled vehicle or pedestrian hazard verified.`,
          category: incident.type === "stalled_vehicle" ? "traffic" : "police",
          assignment_type: incident.type === "stalled_vehicle" ? "stalled_vehicle_review" : "cctv_verification",
          priority: incident.severity === "critical" ? "critical" : "high",
          location_name: incident.location,
          latitude: cctvFeeds.find((f) => f.id === incident.cameraId)?.lat || null,
          longitude: cctvFeeds.find((f) => f.id === incident.cameraId)?.lng || null,
          department_id: incident.type === "stalled_vehicle" ? "Traffic Police" : "Traffic Operations",
          requires_approval: false,
          target_response_sec: 600,
          source: "ai_recommendation",
        },
      })
        .then((created: any) => {
          dispatchRealtime.broadcast("assignment.created", created.id);
        })
        .catch((e) => console.warn("CCTV dispatch sync error:", e));
    },
    [addIncident]
  );

  // Initialize analytics engines
  useEffect(() => {
    cctvFeeds.forEach((feed) => {
      if (!enginesRef.current.has(feed.id)) {
        enginesRef.current.set(
          feed.id,
          new CameraAnalyticsEngine(feed.id, feed.location, feed.vehicleCount)
        );
      }
    });
  }, []);

  // Initialize and load TensorFlow.js COCO-SSD model
  useEffect(() => {
    let isMounted = true;

    async function initAi() {
      try {
        setModelLoading(true);
        const model = await loadCocoSsdModel((status) => {
          if (isMounted) setModelStatusText(status);
        });

        if (!globalScheduler) {
          globalScheduler = new InferenceScheduler(model);
          globalScheduler.start();
        } else {
          globalScheduler.setModel(model);
          globalScheduler.start();
        }

        if (isMounted) {
          setModelLoading(false);
          setModelError(null);
        }
      } catch (err: any) {
        console.error("AI Model Loading Error:", err);
        if (isMounted) {
          setModelLoading(false);
          setModelError(
            err?.message || "WebGL acceleration is unavailable. Check browser graphics support."
          );
        }
      }
    }

    initAi();

    return () => {
      isMounted = false;
    };
  }, []);

  // Update selected feed in scheduler
  useEffect(() => {
    if (globalScheduler) {
      globalScheduler.setSelectedFeed(selectedFeedId);
    }
  }, [selectedFeedId]);

  // Aggregate stats across all cameras
  const aggregatedStats = useMemo(() => {
    let totalInFrame = 0;
    let totalPassed = 0;
    let avgFpsSum = 0;
    let count = 0;

    Object.values(analyticsMap).forEach((st) => {
      totalInFrame += st.objectsInFrame;
      totalPassed += st.totalPassed;
      avgFpsSum += st.fps;
      count++;
    });

    return {
      totalInFrame,
      totalPassed,
      avgFps: count > 0 ? (avgFpsSum / count).toFixed(1) : "0.0",
      activeIncidents: Object.values(analyticsMap).filter((st) => st.activeIncident !== null).length,
    };
  }, [analyticsMap]);

  const selectedFeed = cctvFeeds.find((f) => f.id === selectedFeedId) || null;
  const selectedAnalytics = selectedFeedId ? analyticsMap[selectedFeedId] : null;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Title & Status Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
                Real-Time Vision AI · 04
              </span>
              <LiveBadge label="6 FEEDS LIVE" />
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground mt-1">
              AI Vision CCTV Grid
            </h1>
            <p className="mt-1 text-sm font-medium text-primary flex items-center gap-1.5">
              <Sparkles className="size-4 animate-pulse" />
              Demo footage — AI detection runs live in the browser (COCO-SSD MobileNetV2)
            </p>
          </div>

          {/* Quick Filter & Toggle Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowBoxes(!showBoxes)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                showBoxes
                  ? "border-primary/50 bg-primary/10 text-primary shadow-xs"
                  : "border-border bg-card/60 text-muted-foreground hover:bg-secondary"
              )}
            >
              <Crosshair className="size-3.5" />
              Bounding Boxes: {showBoxes ? "ON" : "OFF"}
            </button>

            <button
              onClick={() => setShowTracks(!showTracks)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                showTracks
                  ? "border-primary/50 bg-primary/10 text-primary shadow-xs"
                  : "border-border bg-card/60 text-muted-foreground hover:bg-secondary"
              )}
            >
              <TrendingUp className="size-3.5" />
              Track Trails: {showTracks ? "ON" : "OFF"}
            </button>

            <button
              onClick={() => setShowCountingLine(!showCountingLine)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                showCountingLine
                  ? "border-primary/50 bg-primary/10 text-primary shadow-xs"
                  : "border-border bg-card/60 text-muted-foreground hover:bg-secondary"
              )}
            >
              <Sliders className="size-3.5" />
              Counting Line: {showCountingLine ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        {/* Neural Model Status Banner */}
        {modelLoading && (
          <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-primary animate-pulse">
            <RefreshCw className="size-5 animate-spin" />
            <div className="text-sm font-medium">
              <span className="font-bold">Loading Neural Vision Model:</span> {modelStatusText}
            </div>
          </div>
        )}

        {modelError && (
          <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
            <AlertTriangle className="size-5" />
            <div className="text-sm font-medium">
              <span className="font-bold">Neural Acceleration Notice:</span> {modelError}
            </div>
          </div>
        )}

        {/* High-Level Telemetry Metrics Ribbon */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <GlassCard className="p-3.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] uppercase tracking-wider font-semibold">Active Corridors</span>
              <Video className="size-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-bold font-mono text-foreground">6 / 6</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Round-robin inference queue</p>
          </GlassCard>

          <GlassCard className="p-3.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] uppercase tracking-wider font-semibold">Live in View</span>
              <Eye className="size-4 text-sky-400" />
            </div>
            <p className="mt-2 text-2xl font-bold font-mono text-sky-400">
              {aggregatedStats.totalInFrame}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Tracked vehicles & pedestrians</p>
          </GlassCard>

          <GlassCard className="p-3.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] uppercase tracking-wider font-semibold">Total Vehicles Counted</span>
              <Activity className="size-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-bold font-mono text-emerald-400">
              {aggregatedStats.totalPassed.toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Line-crossing verified</p>
          </GlassCard>

          <GlassCard className="p-3.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] uppercase tracking-wider font-semibold">Vision Anomalies</span>
              <AlertTriangle className="size-4 text-amber-400" />
            </div>
            <p className="mt-2 text-2xl font-bold font-mono text-amber-400">
              {aggregatedStats.activeIncidents > 0
                ? `${aggregatedStats.activeIncidents} ACTIVE`
                : "NOMINAL"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Auto-dispatched to Command Center</p>
          </GlassCard>
        </div>

        {/* Focused / Enlarged Camera View */}
        {selectedFeed && selectedAnalytics && (
          <div className="space-y-4 rounded-3xl border border-primary/40 bg-card/95 p-4 md:p-6 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/80 pb-4">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-primary px-3 py-1 font-mono text-xs font-bold text-primary-foreground shadow-sm">
                  {selectedFeed.id}
                </span>
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    {selectedFeed.location} · Primary Focus Feed
                    <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Prioritized Neural Vision Stream (~8 FPS) · Multi-Object Tracking & Classification
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFeedId(null)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/80 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary cursor-pointer"
              >
                <Minimize2 className="size-3.5" />
                Exit Focus Mode
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Large Video Display (2 Columns) */}
              <div className="lg:col-span-2 space-y-3">
                <CctvFeedVideoCard
                  feed={selectedFeed}
                  engine={enginesRef.current.get(selectedFeed.id)!}
                  showBoxes={showBoxes}
                  showTracks={showTracks}
                  showCountingLine={showCountingLine}
                  isEnlarged={true}
                  onAnalyticsUpdate={(state) => {
                    setAnalyticsMap((prev) => ({ ...prev, [selectedFeed.id]: state }));
                  }}
                  onTriggerIncident={handleIncidentTriggered}
                />
              </div>

              {/* Side Panel Detailed Analytics (1 Column) */}
              <div className="space-y-4 flex flex-col justify-between">
                {/* 1. Class Breakdown Counters */}
                <div className="rounded-2xl border border-border bg-secondary/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Vehicle Class Breakdown
                    </span>
                    <span className="text-xs font-mono font-bold text-foreground">
                      {selectedAnalytics.objectsInFrame} in view
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center justify-between rounded-xl bg-card/80 p-2 border border-border/40">
                      <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
                        <Car className="size-3.5" /> Cars
                      </span>
                      <span className="font-mono font-bold">{selectedAnalytics.classCounts.car}</span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-card/80 p-2 border border-border/40">
                      <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                        <Bus className="size-3.5" /> Buses
                      </span>
                      <span className="font-mono font-bold">{selectedAnalytics.classCounts.bus}</span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-card/80 p-2 border border-border/40">
                      <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                        <Truck className="size-3.5" /> Trucks
                      </span>
                      <span className="font-mono font-bold">{selectedAnalytics.classCounts.truck}</span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-card/80 p-2 border border-border/40">
                      <span className="flex items-center gap-1.5 text-purple-400 font-semibold">
                        <Activity className="size-3.5" /> Bikes
                      </span>
                      <span className="font-mono font-bold">{selectedAnalytics.classCounts.motorcycle}</span>
                    </div>

                    <div className="col-span-2 flex items-center justify-between rounded-xl bg-card/80 p-2 border border-border/40">
                      <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                        <Footprints className="size-3.5" /> Pedestrians
                      </span>
                      <span className="font-mono font-bold">{selectedAnalytics.classCounts.person}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Rolling Density Sparkline (Recharts) */}
                <div className="rounded-2xl border border-border bg-secondary/40 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Rolling Traffic Density
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        selectedAnalytics.congestion === "High"
                          ? "bg-rose-500/20 text-rose-400"
                          : selectedAnalytics.congestion === "Medium"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-emerald-500/20 text-emerald-400"
                      )}
                    >
                      {selectedAnalytics.congestion} Congestion
                    </span>
                  </div>

                  <div className="h-28 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={selectedAnalytics.densityHistory}>
                        <defs>
                          <linearGradient id="densityGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" hide />
                        <YAxis hide domain={[0, "dataMax + 2"]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            borderColor: "#334155",
                            borderRadius: "12px",
                            fontSize: "11px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="density"
                          stroke="#38bdf8"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#densityGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 3. Live Active Trackers List */}
                <div className="rounded-2xl border border-border bg-secondary/40 p-4 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    Active Object Trackers ({selectedAnalytics.tracks.length})
                  </span>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-[11px] font-mono">
                    {selectedAnalytics.tracks.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded-lg bg-card/90 px-2.5 py-1 border border-border/50"
                      >
                        <span className="font-bold text-foreground">#{t.id}</span>
                        <span
                          className="capitalize font-semibold"
                          style={{ color: CLASS_COLORS[t.class]?.stroke || "#38bdf8" }}
                        >
                          {t.class}
                        </span>
                        <span className="text-muted-foreground">
                          {t.isStalled ? (
                            <span className="text-rose-400 font-bold">STALLED</span>
                          ) : (
                            `${t.speed.toFixed(2)} u/s`
                          )}
                        </span>
                      </div>
                    ))}
                    {selectedAnalytics.tracks.length === 0 && (
                      <div className="text-center py-4 text-xs text-muted-foreground">
                        Scanning frame for objects...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6-Feed CCTV Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cctvFeeds.map((feed) => {
            const engine = enginesRef.current.get(feed.id)!;
            const analytics = analyticsMap[feed.id];
            const isSelected = selectedFeedId === feed.id;

            return (
              <GlassCard
                key={feed.id}
                className={cn(
                  "!p-0 overflow-hidden flex flex-col transition-all duration-300 group",
                  isSelected && "ring-2 ring-primary shadow-lg"
                )}
              >
                {/* Video & AI Canvas Overlay */}
                <div className="relative aspect-video bg-slate-950 overflow-hidden cursor-pointer" onClick={() => setSelectedFeedId(isSelected ? null : feed.id)}>
                  <CctvFeedVideoCard
                    feed={feed}
                    engine={engine}
                    showBoxes={showBoxes}
                    showTracks={showTracks}
                    showCountingLine={showCountingLine}
                    isEnlarged={false}
                    onAnalyticsUpdate={(state) => {
                      setAnalyticsMap((prev) => ({ ...prev, [feed.id]: state }));
                    }}
                    onTriggerIncident={handleIncidentTriggered}
                  />

                  {/* Expand Overlay Button */}
                  <div className="absolute bottom-2.5 right-2.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFeedId(isSelected ? null : feed.id);
                      }}
                      className="rounded-lg bg-black/70 p-1.5 text-white backdrop-blur-md hover:bg-primary transition-colors cursor-pointer"
                      title="Enlarge Feed"
                    >
                      <Maximize2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Per-Camera Stats Deck Under Video */}
                <div className="p-3.5 space-y-2.5 bg-card/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-foreground">
                          {feed.id}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">·</span>
                        <span className="text-xs font-semibold text-foreground truncate max-w-[140px]">
                          {feed.location}
                        </span>
                      </div>
                    </div>

                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        analytics?.congestion === "High"
                          ? "bg-rose-500/20 text-rose-400"
                          : analytics?.congestion === "Medium"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-emerald-500/20 text-emerald-400"
                      )}
                    >
                      {analytics?.congestion || "Optimal"}
                    </span>
                  </div>

                  {/* Live Quick Stats Line */}
                  <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-mono">
                    <div className="rounded-lg bg-secondary/70 p-1.5 border border-border/40">
                      <span className="text-[9px] text-muted-foreground block uppercase">FPS</span>
                      <span className="font-bold text-primary">
                        {analytics?.fps ? `${analytics.fps} fps` : "~2.8 fps"}
                      </span>
                    </div>

                    <div className="rounded-lg bg-secondary/70 p-1.5 border border-border/40">
                      <span className="text-[9px] text-muted-foreground block uppercase">In Frame</span>
                      <span className="font-bold text-foreground">
                        {analytics?.objectsInFrame ?? 0} objs
                      </span>
                    </div>

                    <div className="rounded-lg bg-secondary/70 p-1.5 border border-border/40">
                      <span className="text-[9px] text-muted-foreground block uppercase">Crossed</span>
                      <span className="font-bold text-emerald-400">
                        {analytics?.totalPassed ?? feed.vehicleCount}
                      </span>
                    </div>
                  </div>

                  {/* Active Incident Warning Tag if Triggered */}
                  {analytics?.activeIncident && (
                    <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-2 text-xs font-semibold text-rose-300 flex items-center gap-1.5 animate-pulse">
                      <AlertTriangle className="size-3.5 shrink-0 text-rose-400" />
                      <span className="truncate">{analytics.activeIncident.title}</span>
                    </div>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>

        {/* Global Incident Event Log */}
        {globalIncidents.length > 0 && (
          <GlassCard className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-400" />
                <h3 className="text-sm font-bold text-foreground">
                  Neural Vision Event & Incident Stream
                </h3>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                {globalIncidents.length} Events Logged
              </span>
            </div>

            <div className="divide-y divide-border/40 max-h-48 overflow-y-auto">
              {globalIncidents.map((inc) => (
                <div key={inc.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        inc.severity === "critical" ? "bg-rose-500 animate-ping" : "bg-amber-500"
                      )}
                    />
                    <span className="font-mono font-bold text-primary">{inc.cameraId}</span>
                    <span className="font-semibold text-foreground">{inc.title}</span>
                    <span className="text-muted-foreground">· {inc.description}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                    {new Date(inc.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
    </AppShell>
  );
}

// Subcomponent: Live Video + Scaled HTML5 Canvas Object Detection Overlay
function CctvFeedVideoCard({
  feed,
  engine,
  showBoxes,
  showTracks,
  showCountingLine,
  isEnlarged,
  onAnalyticsUpdate,
  onTriggerIncident,
}: {
  feed: CctvFeed;
  engine: CameraAnalyticsEngine;
  showBoxes: boolean;
  showTracks: boolean;
  showCountingLine: boolean;
  isEnlarged?: boolean;
  onAnalyticsUpdate: (state: CameraAnalyticsState) => void;
  onTriggerIncident: (incident: IncidentAlert) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [timecode, setTimecode] = useState<string>("");
  const [activeAlert, setActiveAlert] = useState<IncidentAlert | null>(null);

  // Live timecode clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimecode(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")} IST`
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Register feed with the global round-robin scheduler
  useEffect(() => {
    if (!globalScheduler) return;

    const onDetections = (detections: RawDetection[]) => {
      // Process detection with tracker & analytics engine
      const state = engine.processFrame(detections, (inc) => {
        setActiveAlert(inc);
        onTriggerIncident(inc);
      });

      onAnalyticsUpdate(state);

      // Render detection boxes & tracks on canvas
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const cW = (canvas.width = video.clientWidth || 480);
      const cH = (canvas.height = video.clientHeight || 270);

      ctx.clearRect(0, 0, cW, cH);

      // 1. Draw Virtual Counting Line
      if (showCountingLine && engine.countingLine) {
        const line = engine.countingLine;
        ctx.beginPath();
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.75)";
        ctx.lineWidth = 2;
        ctx.moveTo(line.p1[0] * cW, line.p1[1] * cH);
        ctx.lineTo(line.p2[0] * cW, line.p2[1] * cH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = "rgba(14, 165, 233, 0.9)";
        ctx.font = "bold 9px monospace";
        ctx.fillText("COUNT LINE", line.p1[0] * cW + 6, line.p1[1] * cH - 4);
      }

      // 2. Draw Trajectory Tracks
      if (showTracks) {
        state.tracks.forEach((track) => {
          if (track.history.length < 2) return;
          const color = CLASS_COLORS[track.class] || CLASS_COLORS.car;

          ctx.beginPath();
          ctx.strokeStyle = color.stroke;
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          track.history.forEach((pt, idx) => {
            const px = pt[0] * cW;
            const py = pt[1] * cH;
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.stroke();

          // Centroid dot
          const lastPt = track.history[track.history.length - 1];
          ctx.beginPath();
          ctx.arc(lastPt[0] * cW, lastPt[1] * cH, 3, 0, 2 * Math.PI);
          ctx.fillStyle = color.stroke;
          ctx.fill();
        });
      }

      // 3. Draw Bounding Boxes & Class Labels
      if (showBoxes) {
        state.tracks.forEach((track) => {
          const [nx, ny, nw, nh] = track.bbox;
          const x = nx * cW;
          const y = ny * cH;
          const w = nw * cW;
          const h = nh * cH;

          const color = CLASS_COLORS[track.class] || CLASS_COLORS.car;

          // Box outline & fill
          if (track.isStalled) {
            ctx.fillStyle = "rgba(239, 68, 68, 0.35)";
            ctx.strokeStyle = "#ef4444";
            ctx.lineWidth = 3;
          } else {
            ctx.fillStyle = color.fill;
            ctx.strokeStyle = color.stroke;
            ctx.lineWidth = 2;
          }

          ctx.beginPath();
          ctx.roundRect(x, y, w, h, 6);
          ctx.fill();
          ctx.stroke();

          // Label Pill
          const labelText = `${track.class.toUpperCase()} #${track.id} ${(track.score * 100).toFixed(0)}%`;
          ctx.font = "bold 10px monospace";
          const textWidth = ctx.measureText(labelText).width;

          ctx.fillStyle = track.isStalled ? "#dc2626" : color.bg;
          ctx.beginPath();
          ctx.roundRect(x, Math.max(0, y - 16), textWidth + 8, 16, [4, 4, 0, 0]);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          ctx.fillText(labelText, x + 4, Math.max(12, y - 4));
        });
      }
    };

    globalScheduler.registerFeed(feed.id, {
      id: feed.id,
      videoElement: videoRef.current,
      onDetections,
    });

    return () => {
      globalScheduler?.unregisterFeed(feed.id);
    };
  }, [feed.id, engine, showBoxes, showTracks, showCountingLine, onAnalyticsUpdate, onTriggerIncident]);

  return (
    <div className="relative w-full h-full aspect-video overflow-hidden rounded-2xl bg-black select-none">
      {/* Real Local Video Stream */}
      <video
        ref={videoRef}
        src={feed.videoUrl}
        muted
        loop
        playsInline
        autoPlay
        crossOrigin="anonymous"
        className="w-full h-full object-cover"
      />

      {/* Overlay Canvas for Neural Bounding Boxes & Trajectories */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />

      {/* CCTV CRT Scanline & Grain Aesthetic Effect */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-b from-transparent via-black/[0.04] to-transparent opacity-60 bg-[length:100%_4px]" />

      {/* CCTV HUD: Top Left (REC Indicator + ID) */}
      <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-2 rounded-lg bg-black/70 px-2.5 py-1 text-[11px] font-mono text-white backdrop-blur-md border border-white/10">
        <span className="size-2 rounded-full bg-red-500 animate-pulse" />
        <span className="font-bold tracking-wider">REC</span>
        <span className="text-white/40">|</span>
        <span className="font-bold text-primary">{feed.id}</span>
      </div>

      {/* CCTV HUD: Top Right (Live Timecode Clock) */}
      <div className="absolute top-2.5 right-2.5 z-20 rounded-lg bg-black/70 px-2.5 py-1 text-[10px] font-mono text-white/90 backdrop-blur-md border border-white/10">
        {timecode}
      </div>

      {/* CCTV HUD: Bottom Left (Location Tag) */}
      <div className="absolute bottom-2.5 left-2.5 z-20 rounded-lg bg-black/70 px-2.5 py-1 text-[10px] font-mono text-white/90 backdrop-blur-md border border-white/10 flex items-center gap-1.5">
        <Radio className="size-3 text-emerald-400 animate-pulse" />
        <span>{feed.location}</span>
      </div>

      {/* Active Incident Warning Flashing Banner Overlay */}
      {activeAlert && (
        <div className="absolute top-10 inset-x-4 z-30 flex items-center justify-between rounded-xl border border-rose-500 bg-rose-600/90 px-3 py-1.5 text-xs font-bold text-white shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 animate-bounce text-yellow-300" />
            <span>{activeAlert.title} — Dispatched</span>
          </div>
          <span className="text-[10px] uppercase font-mono bg-black/30 px-1.5 py-0.5 rounded">
            {activeAlert.severity}
          </span>
        </div>
      )}
    </div>
  );
}
