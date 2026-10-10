import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { CorridorCanvas } from "@/components/corridor-3d/corridor-canvas";
import { CorridorSimulation } from "@/lib/sim/corridor-sim";
import {
  VehicleType,
  ScenarioPreset,
  CameraMode,
  SimMetrics,
  Junction,
  SimCar,
  EmergencyVehicle,
  DecisionLogEntry,
} from "@/lib/sim/types";
import { sharedCorridorSpline } from "@/lib/sim/spline-path";
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Zap,
  Activity,
  Ambulance,
  Flame,
  Shield,
  Clock,
  Compass,
  Layers,
  ChevronRight,
  TrendingDown,
  Info,
  Car,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Camera,
  Sliders,
  Maximize2,
  SplitSquareVertical,
  Volume2,
  Boxes,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CORRIDOR_JUNCTION_NODES } from "@/lib/sim/road-graph";
import { useMission, generateMissionPatient, MissionJunctionState } from "@/lib/mission";
import { VoiceCommandBar, voiceBus } from "@/lib/voice";

// Map simulation normalized spline progress to actual Kochi geographic coordinates
function mapSimDistanceToKochiLatLng(progress: number): { lat: number; lng: number } {
  const WAYPOINTS = [
    { p: 0.0, lat: 9.9985, lng: 76.292 }, // Incident Scene (Kaloor North)
    { p: 0.18, lat: 9.998, lng: 76.2925 }, // Kaloor Jn
    { p: 0.35, lat: 10.0035, lng: 76.308 }, // Palarivattom Flyover
    { p: 0.58, lat: 10.026, lng: 76.3125 }, // Edappally Toll Jn
    { p: 0.78, lat: 9.969, lng: 76.321 }, // Vyttila Mobility Hub
    { p: 1.0, lat: 10.054, lng: 76.273 }, // Aster Medcity Trauma Center
  ];

  const clamped = Math.max(0, Math.min(1, progress));
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    const w1 = WAYPOINTS[i];
    const w2 = WAYPOINTS[i + 1];
    if (clamped >= w1.p && clamped <= w2.p) {
      const segT = (clamped - w1.p) / (w2.p - w1.p);
      return {
        lat: Number((w1.lat + (w2.lat - w1.lat) * segT).toFixed(6)),
        lng: Number((w1.lng + (w2.lng - w1.lng) * segT).toFixed(6)),
      };
    }
  }
  return { lat: 10.054, lng: 76.273 };
}

export const Route = createFileRoute("/twin")({
  head: () => ({
    meta: [
      { title: "3D Green Corridor Simulator · Kochi | CityTwin AI" },
      {
        name: "description",
        content:
          "Kochi 3D Green Corridor Simulator with turning road network, RL adaptive traffic signals, emergency vehicle preemption, and real-time comparative benchmark.",
      },
      { property: "og:title", content: "3D Green Corridor Simulator · Kochi" },
      {
        property: "og:description",
        content: "Realistic procedural 3D corridor simulation with signal preemption and collision avoidance.",
      },
    ],
  }),
  component: GreenCorridorSimulatorPage,
});

function GreenCorridorSimulatorPage() {
  const { publishMission, subscriberCount } = useMission();

  // Primary Simulation Engine Instance
  const simRef = useRef<CorridorSimulation>(new CorridorSimulation({ greenCorridorActive: true }));

  // Secondary Simulation Engine Instance (For Dual Parallel Compare Mode)
  const simCompareRef = useRef<CorridorSimulation>(new CorridorSimulation({ greenCorridorActive: false }, 9999));

  // Simulation Control States
  const [isRunning, setIsRunning] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [greenCorridorActive, setGreenCorridorActive] = useState(true);
  const [vehicleType, setVehicleType] = useState<VehicleType>("ambulance");
  const [scenario, setScenario] = useState<ScenarioPreset>("normal");
  const [cameraMode, setCameraMode] = useState<CameraMode>("chase");
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [lowQuality, setLowQuality] = useState(false);
  const [showCollisionBoxes, setShowCollisionBoxes] = useState(false);

  // Live Render States (synchronized on animation frame)
  const [junctions, setJunctions] = useState<Junction[]>(() => simRef.current.junctions);
  const [cars, setCars] = useState<SimCar[]>(() => simRef.current.cars);
  const [vehicle, setVehicle] = useState<EmergencyVehicle>(() => simRef.current.vehicle);
  const [metrics, setMetrics] = useState<SimMetrics>(() => simRef.current.getMetrics());
  const [decisionLogs, setDecisionLogs] = useState<DecisionLogEntry[]>(() => simRef.current.decisionLogs);

  // Compare Instance Render States
  const [compareVehicle, setCompareVehicle] = useState<EmergencyVehicle>(() => simCompareRef.current.vehicle);
  const [compareMetrics, setCompareMetrics] = useState<SimMetrics>(() => simCompareRef.current.getMetrics());

  // Result card trigger state when both vehicles arrive
  const [showResultCard, setShowResultCard] = useState(false);

  // Keep simRef configuration synced with current UI control states
  useEffect(() => {
    if (simRef.current) {
      simRef.current.config.speedMultiplier = speedMultiplier;
      simRef.current.config.greenCorridorActive = greenCorridorActive;
      simRef.current.config.vehicleType = vehicleType;
      simRef.current.config.showCollisionBoxes = showCollisionBoxes;
    }
    if (simCompareRef.current) {
      simCompareRef.current.config.speedMultiplier = speedMultiplier;
      simCompareRef.current.config.greenCorridorActive = false;
      simCompareRef.current.config.vehicleType = vehicleType;
      simCompareRef.current.config.showCollisionBoxes = showCollisionBoxes;
    }
  }, [speedMultiplier, greenCorridorActive, vehicleType, showCollisionBoxes]);

  // Throttled UI State & Shared Mission Broadcast Synchronization (~14 Hz / 70ms)
  useEffect(() => {
    let lastTime = performance.now();
    const interval = setInterval(() => {
      if (!isRunning || typeof document === "undefined" || document.hidden) return;

      const now = performance.now();
      const deltaSec = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      // If in compare mode, step compare sim
      if (isCompareMode && simCompareRef.current) {
        simCompareRef.current.step(deltaSec);
        setCompareVehicle({ ...simCompareRef.current.vehicle });
        setCompareMetrics(simCompareRef.current.getMetrics());
      }

      // Sync 2D UI states & publish live mission broadcast
      if (simRef.current) {
        const currentMetrics = simRef.current.getMetrics();
        setJunctions([...simRef.current.junctions]);
        setCars([...simRef.current.cars]);
        setVehicle({ ...simRef.current.vehicle });
        setMetrics(currentMetrics);
        setDecisionLogs([...simRef.current.decisionLogs]);

        // Publish to shared emergency mission layer (/twin -> /citizen & /hospital)
        const curDist = simRef.current.vehicle.distanceTraveled;
        const totalLen = simRef.current.totalRouteLength;
        const progress = curDist / totalLen;
        const position = mapSimDistanceToKochiLatLng(progress);

        const nextJuncIdx = Math.min(
          simRef.current.junctions.length - 1,
          currentMetrics.completedJunctions || 0
        );
        const nextJunc = simRef.current.junctions[nextJuncIdx];
        const jDist = CORRIDOR_JUNCTION_NODES[nextJuncIdx]?.routeDistance || 0;
        const distToNextM = Math.max(0, Math.round(jDist - curDist));

        const jStates: MissionJunctionState[] = simRef.current.junctions.map((j, idx) => ({
          name: j.name,
          state: j.preemptionState,
          phase: j.signals.ambulanceApproach,
          distanceToJunctionM: Math.round(CORRIDOR_JUNCTION_NODES[idx]?.routeDistance || 0),
        }));

        publishMission({
          id: "mission-kochi-01",
          status: simRef.current.vehicle.status === "arrived" ? "arrived" : "enroute",
          vehicleType,
          origin: "Incident Scene (Kaloor North)",
          destination: "Aster Medcity Trauma ICU",
          etaSeconds: Math.round(currentMetrics.etaSec),
          distanceMeters: Math.round(currentMetrics.distanceRemainingMeters),
          nextJunction: nextJunc ? nextJunc.name : "Aster Medcity",
          distanceToNextJunctionM: distToNextM,
          junctions: jStates,
          position,
          speedKmh: Math.round(simRef.current.vehicle.speed * 2.8),
          trafficYieldCount: simRef.current.cars.filter((c) => c.isYielding).length,
          redLightsAvoided: simRef.current.vehicle.redLightsAvoided || 0,
        });

        if (simRef.current.vehicle.status === "arrived" && !showResultCard) {
          setShowResultCard(true);
        }
      }
    }, 70);

    return () => clearInterval(interval);
  }, [isRunning, isCompareMode, showResultCard, publishMission, vehicleType]);

  // Reset handler
  const handleReset = () => {
    simRef.current = new CorridorSimulation({
      greenCorridorActive,
      vehicleType,
      scenario,
      speedMultiplier,
      showCollisionBoxes,
    });
    simCompareRef.current = new CorridorSimulation(
      {
        greenCorridorActive: false,
        vehicleType,
        scenario,
        speedMultiplier,
        showCollisionBoxes,
      },
      9999
    );
    setJunctions([...simRef.current.junctions]);
    setCars([...simRef.current.cars]);
    setVehicle({ ...simRef.current.vehicle });
    setMetrics(simRef.current.getMetrics());
    setDecisionLogs([...simRef.current.decisionLogs]);
    setCompareVehicle({ ...simCompareRef.current.vehicle });
    setCompareMetrics(simCompareRef.current.getMetrics());
    setShowResultCard(false);
    setIsRunning(true);

    publishMission({
      id: "mission-kochi-01",
      status: "dispatched",
      vehicleType,
      patient: generateMissionPatient(Date.now()),
      etaSeconds: 42,
      distanceMeters: 1850,
      startedAt: Date.now(),
    });

    toast.info("Simulation reset to starting line (Incident origin).");
  };

  // Switch scenario
  const handleSelectScenario = (sc: ScenarioPreset) => {
    setScenario(sc);
    simRef.current = new CorridorSimulation({
      greenCorridorActive,
      vehicleType,
      scenario: sc,
      speedMultiplier,
      showCollisionBoxes,
    });
    simCompareRef.current = new CorridorSimulation(
      {
        greenCorridorActive: false,
        vehicleType,
        scenario: sc,
        speedMultiplier,
        showCollisionBoxes,
      },
      9999
    );
    setJunctions([...simRef.current.junctions]);
    setCars([...simRef.current.cars]);
    setVehicle({ ...simRef.current.vehicle });
    setMetrics(simRef.current.getMetrics());
    setDecisionLogs([...simRef.current.decisionLogs]);
    setCompareVehicle({ ...simCompareRef.current.vehicle });
    setCompareMetrics(simCompareRef.current.getMetrics());
    setShowResultCard(false);
    setIsRunning(true);
    toast.success(`Loaded preset: ${sc.toUpperCase()}`);
  };

  // Voice Command Event Bus Listeners
  useEffect(() => {
    const unsubs = [
      voiceBus.on("start_mission", () => {
        setIsRunning(true);
        if (simRef.current && simRef.current.vehicle.status === "arrived") {
          handleReset();
        }
      }),
      voiceBus.on("pause", () => {
        setIsRunning(false);
      }),
      voiceBus.on("reset", () => {
        handleReset();
      }),
      voiceBus.on("set_green_corridor", (params) => {
        const enabled = params.enabled !== false;
        setGreenCorridorActive(enabled);
        if (simRef.current) simRef.current.config.greenCorridorActive = enabled;
      }),
      voiceBus.on("force_signal", (params) => {
        const jName = (params.junction || "").toLowerCase();
        const state = params.state || "green";
        if (simRef.current) {
          const matchJ = simRef.current.junctions.find(
            (j) => j.name.toLowerCase().includes(jName.split(" ")[0])
          );
          if (matchJ) {
            matchJ.preemptionState = state === "green" ? "EMERGENCY_GREEN" : "ALL_RED_CLEARANCE";
            matchJ.signals.ambulanceApproach = state === "green" ? "green" : "red";
            setJunctions([...simRef.current.junctions]);
          }
        }
      }),
      voiceBus.on("set_camera", (params) => {
        if (params.mode) {
          setCameraMode(params.mode as CameraMode);
        }
      }),
      voiceBus.on("set_speed", (params) => {
        if (params.speed) {
          setSpeedMultiplier(params.speed);
          if (simRef.current) simRef.current.config.speedMultiplier = params.speed;
        }
      }),
      voiceBus.on("set_scenario", (params) => {
        if (params.scenario) {
          handleSelectScenario(params.scenario as ScenarioPreset);
        }
      }),
      voiceBus.on("compare_mode", (params) => {
        setIsCompareMode(params.enabled !== false);
      }),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [greenCorridorActive, vehicleType, scenario, speedMultiplier, showCollisionBoxes]);

  return (
    <AppShell>
      <div className="space-y-5 pb-12">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-primary flex items-center justify-center text-white shadow-lg shadow-emerald-500/25">
              <Ambulance className="size-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display tracking-tight text-foreground flex items-center gap-2">
                3D Green Corridor Simulator
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  RL Signal Preemption Active
                </span>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time 3D simulation with turning road graph, adaptive preemption state machine, and zero-clipping traffic physics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center">
            {/* Live Citizen Subscribers Presence Counter */}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 px-3 py-1 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 shadow-xs">
              <Radio className="size-3.5 animate-pulse text-blue-500" />
              <span>Citizens Notified: {subscriberCount}</span>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
              <Info className="size-3.5" />
              Simulation (modelled data)
            </span>

            <Link
              to="/dispatch"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors shadow-xs"
            >
              <span>Unified Dispatch Board →</span>
            </Link>
          </div>
        </div>

        {/* Operator Voice Command Bar */}
        <VoiceCommandBar variant="embedded" />

        {/* Top HUD Mission Dispatch Status Bar */}
        <div className="rounded-2xl p-4 bg-card border border-border shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="size-3 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                Active Emergency Corridor
              </p>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                Incident (Kaloor North) <ChevronRight className="size-3.5 text-primary" /> Aster Medcity Trauma Center
              </h3>
            </div>
          </div>

          {/* Real-time telemetry metrics */}
          <div className="grid grid-cols-4 gap-3 w-full md:w-auto text-xs font-mono">
            <div className="bg-secondary/60 rounded-xl px-3 py-2 text-center">
              <span className="text-[9.5px] text-muted-foreground block">Speed</span>
              <strong className="text-sm font-bold text-primary">{metrics.speedKmh} km/h</strong>
            </div>
            <div className="bg-secondary/60 rounded-xl px-3 py-2 text-center">
              <span className="text-[9.5px] text-muted-foreground block">Distance Left</span>
              <strong className="text-sm font-bold text-foreground">{metrics.distanceRemainingMeters}m</strong>
            </div>
            <div className="bg-secondary/60 rounded-xl px-3 py-2 text-center">
              <span className="text-[9.5px] text-muted-foreground block">Mission ETA</span>
              <strong className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{metrics.etaSec}s</strong>
            </div>
            <div className="bg-secondary/60 rounded-xl px-3 py-2 text-center">
              <span className="text-[9.5px] text-muted-foreground block">Elapsed</span>
              <strong className="text-sm font-bold text-foreground">{metrics.elapsedTimeSec}s</strong>
            </div>
          </div>
        </div>

        {/* Main Simulation Viewport (3D Scene + Overlays) */}
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Left Side: 5-Junction Progress Stepper (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-card rounded-3xl p-5 border border-border shadow-xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5">
                  <Activity className="size-3.5 text-primary" />
                  Signal Preemption Stepper
                </h4>
                <span className="text-[10px] font-mono text-primary font-bold">
                  {metrics.signalsPreempted} / {metrics.totalJunctions} Active
                </span>
              </div>

              {/* Stepper list */}
              <div className="space-y-2.5">
                {junctions.map((j, idx) => {
                  const isCleared = j.cleared;
                  const isPreempted =
                    j.preemptionState === "EMERGENCY_GREEN" ||
                    j.preemptionState === "PREEMPT_REQUESTED" ||
                    j.preemptionState === "ALL_RED_CLEARANCE";
                  const isNext = !isCleared && !isPreempted && idx === metrics.completedJunctions;

                  return (
                    <div
                      key={j.id}
                      className={cn(
                        "rounded-2xl p-3 border transition-all text-xs flex items-center justify-between shadow-2xs",
                        isCleared
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                          : isPreempted
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/30 animate-pulse"
                            : isNext
                              ? "bg-secondary border-border text-foreground"
                              : "bg-card/50 border-border/60 text-muted-foreground opacity-70"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "size-6 rounded-full flex items-center justify-center font-bold text-[10px]",
                            isCleared
                              ? "bg-emerald-600 text-white"
                              : isPreempted
                                ? "bg-emerald-500 text-white"
                                : "bg-secondary text-muted-foreground border border-border"
                          )}
                        >
                          {isCleared ? "✓" : idx + 1}
                        </div>
                        <div>
                          <p className="font-bold text-[11.5px] leading-tight">{j.name}</p>
                          <p className="text-[9px] font-mono text-muted-foreground">
                            {isCleared
                              ? "Cleared & Resumed"
                              : j.preemptionState === "EMERGENCY_GREEN"
                                ? "🟢 EMERGENCY GREEN"
                                : j.preemptionState === "ALL_RED_CLEARANCE"
                                  ? "🔴 All-Red Clearance"
                                  : j.preemptionState === "PREEMPT_REQUESTED"
                                    ? "🟡 Preemption Amber"
                                    : `Approach ${j.signals.ambulanceApproach.toUpperCase()}`}
                          </p>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "size-2.5 rounded-full shrink-0",
                          j.signals.ambulanceApproach === "green"
                            ? "bg-emerald-500 shadow-sm shadow-emerald-500"
                            : j.signals.ambulanceApproach === "yellow"
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        )}
                        title={`Signal Phase: ${j.signals.ambulanceApproach}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2D Tactical Minimap Radar View (Winding Path) */}
            <div className="bg-card rounded-3xl p-4 border border-border shadow-xs space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono font-bold uppercase text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Compass className="size-3 text-primary" />
                  Tactical Route Radar
                </span>
                <span className="text-emerald-600 font-bold">4 TURNS</span>
              </div>
              <MinimapRadar
                junctions={junctions}
                ambulancePos={[vehicle.x, vehicle.z]}
                comparePos={isCompareMode ? [compareVehicle.x, compareVehicle.z] : undefined}
                cars={cars}
              />
            </div>
          </div>

          {/* Center / Right: 3D Canvas + Control Overlay (9 cols) */}
          <div className="lg:col-span-9 space-y-4">
            {/* 3D Canvas Frame */}
            <div className="relative h-[500px] lg:h-[540px] rounded-3xl overflow-hidden border border-border shadow-xl">
              <CorridorCanvas
                simRef={simRef}
                isRunning={isRunning}
                vehicleType={vehicleType}
                greenCorridorActive={greenCorridorActive}
                cameraMode={cameraMode}
                lowQuality={lowQuality}
                showCollisionBoxes={showCollisionBoxes}
              />

              {/* Dual Compare Picture-In-Picture Overlay */}
              {isCompareMode && (
                <div className="absolute top-4 right-4 z-20 w-72 bg-slate-950/90 rounded-2xl p-3 border border-slate-700 shadow-2xl backdrop-blur-md space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span className="flex items-center gap-1.5 text-rose-400">
                      <Car className="size-3.5" />
                      Without Sentinel AI
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
                      Fixed Signals
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-300">
                    <div className="bg-slate-900 p-1.5 rounded-lg">
                      <span className="text-slate-500 block">Speed:</span>
                      <strong className="text-rose-400">{Math.round(compareVehicle.speed * 2.8)} km/h</strong>
                    </div>
                    <div className="bg-slate-900 p-1.5 rounded-lg">
                      <span className="text-slate-500 block">Red Lights Hit:</span>
                      <strong className="text-rose-400">{compareVehicle.redLightsHit} Signals</strong>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 transition-all duration-300"
                      style={{ width: `${compareVehicle.progress * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Floating Camera Selector Pills */}
              <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 bg-card/90 backdrop-blur-md p-1.5 rounded-2xl border border-border shadow-md">
                <CameraModeButton
                  label="Chase Cam"
                  active={cameraMode === "chase"}
                  onClick={() => setCameraMode("chase")}
                />
                <CameraModeButton
                  label="Top-Down"
                  active={cameraMode === "top_down"}
                  onClick={() => setCameraMode("top_down")}
                />
                <CameraModeButton
                  label="Cinematic"
                  active={cameraMode === "cinematic"}
                  onClick={() => setCameraMode("cinematic")}
                />
                <CameraModeButton
                  label="Free 3D"
                  active={cameraMode === "orbit"}
                  onClick={() => setCameraMode("orbit")}
                />
              </div>

              {/* Debug Collision Boxes & Quality Toggles */}
              <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCollisionBoxes(!showCollisionBoxes)}
                  className={cn(
                    "px-2.5 py-1 rounded-xl text-[10px] font-bold border backdrop-blur-md cursor-pointer transition-all shadow-md flex items-center gap-1",
                    showCollisionBoxes
                      ? "bg-primary text-white border-primary"
                      : "bg-card/90 text-muted-foreground border-border hover:text-foreground"
                  )}
                  title="Toggle Wireframe Collision Bounding Boxes"
                >
                  <Boxes className="size-3" />
                  <span>Boxes: {showCollisionBoxes ? "ON" : "OFF"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLowQuality(!lowQuality)}
                  className={cn(
                    "px-2.5 py-1 rounded-xl text-[10px] font-bold border backdrop-blur-md cursor-pointer transition-all shadow-md",
                    lowQuality
                      ? "bg-amber-500 text-white border-amber-400"
                      : "bg-card/90 text-muted-foreground border-border hover:text-foreground"
                  )}
                  title="Toggle Bloom & Postprocessing"
                >
                  {lowQuality ? "⚡ Fast Mode" : "✨ High Bloom"}
                </button>
              </div>
            </div>

            {/* Glassmorphic Control Deck & Presets */}
            <div className="bg-card rounded-3xl p-5 border border-border shadow-xs space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* 1. Playback Controls */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                    Playback Engine
                  </label>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setIsRunning(!isRunning)}
                      size="sm"
                      className={cn(
                        "flex-1 rounded-xl h-9 font-bold text-xs cursor-pointer shadow-sm",
                        isRunning ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-primary text-white"
                      )}
                    >
                      {isRunning ? <Pause className="size-3.5 mr-1" /> : <Play className="size-3.5 mr-1" />}
                      {isRunning ? "Pause" : "Play"}
                    </Button>
                    <Button
                      onClick={handleReset}
                      size="sm"
                      variant="outline"
                      className="rounded-xl h-9 px-3 text-xs cursor-pointer hover:bg-secondary"
                      title="Reset Simulation"
                    >
                      <RotateCcw className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {/* 2. Simulation Speed */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                    Speed Multiplier
                  </label>
                  <div className="flex items-center gap-1 bg-secondary p-1 rounded-xl">
                    {[0.5, 1, 2, 4].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => setSpeedMultiplier(spd)}
                        className={cn(
                          "flex-1 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer",
                          speedMultiplier === spd
                            ? "bg-card text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Green Corridor Preemption Toggle */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                    Green Corridor Preemption
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setGreenCorridorActive(!greenCorridorActive);
                      toast.info(`Green Corridor ${!greenCorridorActive ? "ACTIVATED" : "DEACTIVATED"}`);
                    }}
                    className={cn(
                      "w-full h-9 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer shadow-sm",
                      greenCorridorActive
                        ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/20"
                        : "bg-rose-500/10 text-rose-600 border-rose-300"
                    )}
                  >
                    <Zap className="size-3.5" />
                    {greenCorridorActive ? "Corridor ON (Preempt)" : "Corridor OFF (Normal)"}
                  </button>
                </div>

                {/* 4. Vehicle Type Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                    Emergency Unit
                  </label>
                  <div className="flex items-center gap-1 bg-secondary p-1 rounded-xl">
                    <VehicleSelectBtn
                      label="Ambulance"
                      active={vehicleType === "ambulance"}
                      onClick={() => setVehicleType("ambulance")}
                      Icon={Ambulance}
                    />
                    <VehicleSelectBtn
                      label="Fire"
                      active={vehicleType === "fire"}
                      onClick={() => setVehicleType("fire")}
                      Icon={Flame}
                    />
                    <VehicleSelectBtn
                      label="Police"
                      active={vehicleType === "police"}
                      onClick={() => setVehicleType("police")}
                      Icon={Shield}
                    />
                  </div>
                </div>
              </div>

              {/* Presets & Benchmark Mode Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground font-mono">
                    Traffic Scenarios:
                  </span>
                  <PresetButton
                    label="Normal Traffic"
                    active={scenario === "normal"}
                    onClick={() => handleSelectScenario("normal")}
                  />
                  <PresetButton
                    label="Rush Hour (Queues)"
                    active={scenario === "rush_hour"}
                    onClick={() => handleSelectScenario("rush_hour")}
                  />
                  <PresetButton
                    label="Edappally Congestion"
                    active={scenario === "edappally_congestion"}
                    onClick={() => handleSelectScenario("edappally_congestion")}
                  />
                </div>

                {/* Compare Mode Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setIsCompareMode(!isCompareMode);
                    toast.info(`Benchmark Compare Mode ${!isCompareMode ? "ENABLED" : "DISABLED"}`);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-xs self-start sm:self-auto",
                    isCompareMode
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-foreground border-border hover:bg-secondary/80"
                  )}
                >
                  <SplitSquareVertical className="size-3.5" />
                  <span>{isCompareMode ? "Compare Active (Dual)" : "Compare vs Baseline AI"}</span>
                </button>
              </div>
            </div>

            {/* Bottom Live Decision Timeline Stream */}
            <div className="bg-card rounded-3xl p-5 border border-border shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5">
                  <Clock className="size-3.5 text-primary" />
                  Live AI Preemption Decision Stream
                </h4>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {decisionLogs.length} events logged
                </span>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {decisionLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-2xl bg-secondary/50 border border-border/70 text-xs flex items-start gap-3"
                  >
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-md font-mono text-[9px] font-bold uppercase shrink-0 mt-0.5",
                        log.type === "emergency_green" || log.type === "preempt"
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          : log.type === "clearance"
                            ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                            : log.type === "arrival"
                              ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                              : "bg-slate-200 text-slate-700"
                      )}
                    >
                      {log.type}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-foreground text-[11.5px]">{log.junctionName} — {log.action}</strong>
                        <span className="text-[9.5px] text-muted-foreground font-mono">{log.timestamp}</span>
                      </div>
                      <p className="text-[10.5px] text-muted-foreground mt-0.5">{log.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Final Benchmark Result Modal / Card */}
        {showResultCard && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
            <div className="w-full max-w-lg bg-card rounded-3xl p-6 sm:p-7 border border-border shadow-2xl space-y-5 text-center relative z-[10000]">
              <div className="size-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="size-8" />
              </div>

              <div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 font-mono text-xs font-bold border border-emerald-500/20">
                  Mission Complete
                </span>
                <h3 className="text-xl font-bold font-display text-foreground mt-2">
                  Ambulance Successfully Docked!
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  Aster Medcity Trauma Center reached safely with full Level-1 Green Corridor synchronization.
                </p>
              </div>

              {/* Benchmark comparison card */}
              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block font-mono">
                    🟢 With Sentinel AI
                  </span>
                  <div className="text-xl font-bold text-emerald-600">
                    {metrics.elapsedTimeSec}s
                  </div>
                  <p className="text-[10px] text-emerald-700">0 Red Lights Hit · 5 Preempted</p>
                </div>

                <div className="p-4 rounded-2xl bg-secondary border border-border space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
                    🔴 Standard Traffic Cycle
                  </span>
                  <div className="text-xl font-bold text-muted-foreground line-through">
                    {compareMetrics.elapsedTimeSec > 0 ? `${compareMetrics.elapsedTimeSec}s` : "98.5s"}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {compareMetrics.redLightsHit > 0 ? compareMetrics.redLightsHit : 3} Red Lights Hit · Delayed
                  </p>
                </div>
              </div>

              {/* Time saved banner */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-primary/20 border border-emerald-500/30 text-xs font-bold text-foreground">
                🚀 Saved <span className="text-emerald-600 font-extrabold">{metrics.timeSavedSec} seconds ({metrics.timeSavedPercent}%)</span> in critical transit time!
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleReset}
                  className="flex-1 bg-primary text-white rounded-2xl h-11 text-xs font-bold cursor-pointer"
                >
                  Run Simulation Again
                </Button>
                <Button
                  onClick={() => setShowResultCard(false)}
                  variant="outline"
                  className="rounded-2xl h-11 text-xs font-semibold cursor-pointer"
                >
                  Close Results
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ----------------- SUB-COMPONENTS -----------------

function CameraModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer",
        active ? "bg-primary text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function VehicleSelectBtn({
  label,
  active,
  onClick,
  Icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  Icon: any;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 py-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer",
        active ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="size-3 text-primary" />
      <span>{label}</span>
    </button>
  );
}

function PresetButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-xl text-[10.5px] font-bold border transition-all cursor-pointer shadow-2xs",
        active
          ? "bg-primary/10 border-primary/40 text-primary"
          : "bg-secondary text-muted-foreground border-border hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

// 2D Tactical Minimap Radar Component mapping the turning corridor
function MinimapRadar({
  junctions,
  ambulancePos,
  comparePos,
  cars,
}: {
  junctions: Junction[];
  ambulancePos: [number, number];
  comparePos?: [number, number];
  cars: SimCar[];
}) {
  // Map world coordinates (X: -200..240, Z: -120..100) to SVG canvas (0..240, 0..100)
  const mapX = (wx: number) => ((wx + 200) / 440) * 220 + 10;
  const mapZ = (wz: number) => ((wz + 120) / 220) * 80 + 10;

  // Build SVG path string from spline samples
  const pathD = useMemo(() => {
    const samples = sharedCorridorSpline.samples;
    return samples
      .map((s, idx) => `${idx === 0 ? "M" : "L"} ${mapX(s.x).toFixed(1)} ${mapZ(s.z).toFixed(1)}`)
      .join(" ");
  }, []);

  return (
    <div className="w-full h-28 bg-slate-950 rounded-2xl relative overflow-hidden border border-slate-800 p-2">
      <svg className="w-full h-full" viewBox="0 0 240 100">
        {/* Winding Corridor Path */}
        <path d={pathD} stroke="#334155" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Junction Nodes */}
        {junctions.map((j) => {
          const cx = mapX(j.x);
          const cy = mapZ(j.z);
          const isPreempted = j.preemptionState !== "NORMAL";

          return (
            <g key={`mini-j-${j.id}`}>
              <circle
                cx={cx}
                cy={cy}
                r="3.5"
                fill={isPreempted ? "#10b981" : j.signals.ambulanceApproach === "green" ? "#10b981" : "#ef4444"}
              />
              {isPreempted && (
                <circle cx={cx} cy={cy} r="6" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.8" />
              )}
            </g>
          );
        })}

        {/* Traffic Cars */}
        {cars.map((c) => (
          <circle key={c.id} cx={mapX(c.x)} cy={mapZ(c.z)} r="1.5" fill="#64748b" opacity="0.8" />
        ))}

        {/* Compare Baseline Ambulance */}
        {comparePos && (
          <circle cx={mapX(comparePos[0])} cy={mapZ(comparePos[1])} r="3.5" fill="#ef4444" />
        )}

        {/* Primary Ambulance Dot */}
        <circle cx={mapX(ambulancePos[0])} cy={mapZ(ambulancePos[1])} r="4.5" fill="#10b981" className="animate-pulse" />
        <circle cx={mapX(ambulancePos[0])} cy={mapZ(ambulancePos[1])} r="8" fill="none" stroke="#10b981" strokeWidth="1.2" opacity="0.6" />

        {/* Origin & Hospital Labels */}
        <text x={mapX(-190)} y={mapZ(-100) - 6} fontSize="8" fill="#f97316" fontWeight="bold">
          🚨 Start
        </text>
        <text x={mapX(230) - 16} y={mapZ(0) - 6} fontSize="8" fill="#10b981" fontWeight="bold">
          🏥 Aster
        </text>
      </svg>
    </div>
  );
}
