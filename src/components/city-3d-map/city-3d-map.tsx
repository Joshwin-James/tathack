import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TrafficSimulation } from './traffic-simulation';
import { TrafficEngine } from './engine';
import type {
  CameraMode,
  SnapshotData,
  SimulationMode,
  ScenarioPreset,
  Direction,
  ComparisonResult,
} from './types';
import type { Incident } from '@/data/kochi';
import { useSentinelStore } from '@/lib/store';
import { SeverityChip } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  RotateCcw,
  Compass,
  Eye,
  Camera,
  Siren,
  Sliders,
  Car,
  Activity,
  Layers,
  X,
  Radio,
  MapPin,
  Sparkles,
  BarChart2,
  ShieldAlert,
  Cpu,
  AlertTriangle,
  ArrowRight,
  Gauge,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Construction,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export interface City3DMapProps {
  height?: number | string;
  className?: string;
  selectedIncidentId?: string | null;
  onSelectIncident?: (incident: Incident | null) => void;
  incidents?: Incident[];
}

const PRESET_LABELS: Record<ScenarioPreset, { name: string; desc: string }> = {
  balanced: { name: 'Balanced All Approaches', desc: '14 veh/min per approach with standard vehicle fleet mix.' },
  heavy_east: { name: 'Heavy East Corridor', desc: 'High East demand (35 veh/min). Demonstrates adaptive green extension.' },
  heavy_ns: { name: 'North-South Rush', desc: 'Rush-hour surge on North (32 veh/min) and South (28 veh/min).' },
  random_arrivals: { name: 'Stochastic Arrivals', desc: 'Randomized Poisson vehicle arrivals across all 4 corridors.' },
  rush_hour: { name: 'City Rush Hour Peak', desc: 'Heavy demand (30–38 veh/min) across all directions simultaneously.' },
  bus_heavy: { name: 'Heavy Transit Fleet', desc: '50% Buses, 35% Cars. Tests heavy vehicle turning and clearance.' },
  downstream_block: { name: 'Downstream Blockage (Spillback)', desc: 'West exit lane blocked. Tests Yellow Box rule & gridlock containment.' },
  emergency_corridor: { name: 'Emergency Priority Corridor', desc: 'Heavy traffic with priority ALS ambulance inbound on South.' },
  gridlock_stress: { name: 'Gridlock Saturation Test', desc: 'Extreme 48 veh/min on all approaches pushing intersection capacity.' },
  custom: { name: 'Custom Configuration', desc: 'Manual demand, fleet mix, and signal timing parameters.' },
};

export function City3DMap({
  height = 620,
  className,
  selectedIncidentId: externalSelectedId,
  onSelectIncident: externalOnSelect,
  incidents: externalIncidents,
}: City3DMapProps) {
  const { incidents: storeIncidents } = useSentinelStore();
  const incidents = externalIncidents ?? storeIncidents;

  const engineRef = useRef<TrafficEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new TrafficEngine();
  }
  const engine = engineRef.current;

  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');
  const [followAmbulance, setFollowAmbulance] = useState(false);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [simSpeed, setSimSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(true);
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<ComparisonResult | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);

  // Demand state for live controls
  const [demands, setDemands] = useState({ north: 14, south: 14, east: 14, west: 14 });
  const [signalMode, setSignalMode] = useState<SimulationMode>('adaptive');
  const [activeScenario, setActiveScenario] = useState<ScenarioPreset>('balanced');
  const [westBlocked, setWestBlocked] = useState(false);
  const [showOverlays, setShowOverlays] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [showDebugDrawer, setShowDebugDrawer] = useState(false);

  const selectedIncidentId = externalSelectedId !== undefined ? externalSelectedId : internalSelectedId;
  const selectedIncident = incidents.find((i) => i.id === selectedIncidentId) || null;

  const handleSnapshot = useCallback((snap: SnapshotData) => {
    setSnapshot(snap);
    setSignalMode(snap.mode);
    setActiveScenario(snap.activeScenario);
  }, []);

  const handleSelectIncident = useCallback(
    (incident: Incident) => {
      if (externalOnSelect) {
        externalOnSelect(incident);
      } else {
        setInternalSelectedId(incident.id);
      }
    },
    [externalOnSelect]
  );

  const handleTogglePlay = useCallback(() => {
    if (!engine) return;
    engine.paused = !engine.paused;
    setIsPaused(engine.paused);
  }, [engine]);

  const handleSetSpeed = useCallback(
    (speed: number) => {
      if (!engine) return;
      engine.setSpeed(speed);
      setSimSpeed(speed);
    },
    [engine]
  );

  const handleReset = useCallback(() => {
    if (!engine) return;
    engine.reset();
    setFollowAmbulance(false);
    setCameraMode('orbit');
    toast.info('Traffic simulation reset to initial state.');
  }, [engine]);

  const handleToggleEmergency = useCallback(() => {
    if (!engine) return;
    if (engine.emergencyActive) {
      engine.deactivateEmergency();
      setFollowAmbulance(false);
    } else {
      engine.activateEmergency('south');
      setFollowAmbulance(true);
      setCameraMode('follow');
      toast.success('Emergency Priority Corridor Activated', {
        description: 'Ambulance inbound on South corridor. Signal preemption active.',
      });
    }
  }, [engine]);

  const handleSelectScenario = useCallback(
    (scenario: ScenarioPreset) => {
      if (!engine) return;
      engine.setScenario(scenario);
      setActiveScenario(scenario);
      setDemands({ ...engine.demand });
      setWestBlocked(engine.downstreamBlocked.west);
      toast.success(`Preset Applied: ${PRESET_LABELS[scenario].name}`);
    },
    [engine]
  );

  const handleToggleSignalMode = useCallback(
    (checked: boolean) => {
      if (!engine) return;
      const newMode = checked ? 'adaptive' : 'fixed';
      engine.setMode(newMode);
      setSignalMode(newMode);
      toast.info(`Signal Controller: ${newMode === 'adaptive' ? 'Adaptive AI Mode' : 'Fixed-Time Mode'}`);
    },
    [engine]
  );

  const handleDemandChange = useCallback(
    (dir: Direction, val: number) => {
      if (!engine) return;
      engine.setDirectionDemand(dir, val);
      setDemands((prev) => ({ ...prev, [dir]: val }));
      setActiveScenario('custom');
    },
    [engine]
  );

  const handleToggleWestBlocked = useCallback(
    (blocked: boolean) => {
      if (!engine) return;
      engine.setDownstreamBlock('west', blocked);
      setWestBlocked(blocked);
      toast.warning(blocked ? 'West Exit Road Blocked — Spillback Active' : 'West Exit Road Cleared');
    },
    [engine]
  );

  const handleRunBenchmark = useCallback(() => {
    if (!engine) return;
    setIsBenchmarking(true);
    setTimeout(() => {
      const result = engine.runComparisonExperiment(60);
      setBenchmarkResult(result);
      setIsBenchmarking(false);
      setShowBenchmarkModal(true);
    }, 120);
  }, [engine]);

  // Sync follow state when emergency finishes
  useEffect(() => {
    if (snapshot && !snapshot.emergencyActive && followAmbulance) {
      setFollowAmbulance(false);
      setCameraMode('orbit');
    }
  }, [snapshot?.emergencyActive, followAmbulance]);

  const formattedHeight = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-2xl border border-border bg-slate-950 font-sans select-none',
        className
      )}
      style={{ height: formattedHeight }}
    >
      {/* 3D Canvas */}
      <div className="absolute inset-0 z-0">
        <TrafficSimulation
          engine={engine}
          onSnapshot={handleSnapshot}
          followAmbulance={followAmbulance}
          cameraMode={cameraMode}
          incidents={incidents}
          selectedIncidentId={selectedIncidentId}
          onSelectIncident={handleSelectIncident}
        />
      </div>

      {/* Top Floating Controls Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Camera Modes & Scenarios */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/85 p-1 backdrop-blur-md shadow-lg pointer-events-auto">
          <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold text-white/90">
            <Radio className="size-3.5 text-primary animate-pulse" />
            <span className="hidden sm:inline">3D Twin</span>
          </div>

          <div className="h-4 w-px bg-white/15 mx-0.5" />

          {/* Camera Buttons */}
          <button
            onClick={() => {
              setCameraMode('orbit');
              setFollowAmbulance(false);
            }}
            title="3D Orbit View (Drag to rotate, scroll to zoom)"
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
              cameraMode === 'orbit' && !followAmbulance
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            )}
          >
            <Compass className="size-3.5" />
            <span className="hidden md:inline">Orbit</span>
          </button>

          <button
            onClick={() => {
              setCameraMode('top_down');
              setFollowAmbulance(false);
            }}
            title="Top-Down Overhead View"
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
              cameraMode === 'top_down'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            )}
          >
            <Layers className="size-3.5" />
            <span className="hidden md:inline">Overhead</span>
          </button>

          <button
            onClick={() => {
              setCameraMode('street');
              setFollowAmbulance(false);
            }}
            title="Street Junction Perspective"
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
              cameraMode === 'street'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            )}
          >
            <Eye className="size-3.5" />
            <span className="hidden md:inline">Street</span>
          </button>

          {snapshot?.emergencyActive && (
            <button
              onClick={() => {
                setCameraMode('follow');
                setFollowAmbulance(true);
              }}
              title="Chase Emergency Ambulance"
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors animate-pulse',
                followAmbulance ? 'bg-destructive text-destructive-foreground shadow-sm' : 'text-rose-400 hover:bg-rose-500/20'
              )}
            >
              <Camera className="size-3.5" />
              <span>Chase Unit</span>
            </button>
          )}

          <div className="h-4 w-px bg-white/15 mx-0.5" />

          {/* Scenario Selector Dropdown */}
          <select
            value={activeScenario}
            onChange={(e) => handleSelectScenario(e.target.value as ScenarioPreset)}
            className="rounded-lg bg-slate-800/90 border border-white/15 px-2 py-1 text-xs font-medium text-white focus:outline-hidden cursor-pointer"
          >
            {Object.entries(PRESET_LABELS).map(([key, { name }]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Right: Controls & Toggles */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Signal Mode Toggle */}
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/85 px-3 py-1.5 backdrop-blur-md shadow-lg text-xs font-medium text-white">
            <Cpu className="size-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Adaptive AI:</span>
            <Switch
              checked={signalMode === 'adaptive'}
              onCheckedChange={handleToggleSignalMode}
              className="data-[state=checked]:bg-emerald-600 cursor-pointer"
            />
          </div>

          {/* Benchmark Compare Button */}
          <button
            onClick={handleRunBenchmark}
            disabled={isBenchmarking}
            title="Run Fixed-Time vs Adaptive Comparison Experiment"
            className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-950/70 hover:bg-cyan-900/80 px-3 py-1.5 text-xs font-semibold text-cyan-300 backdrop-blur-md shadow-lg transition-all cursor-pointer"
          >
            <BarChart2 className="size-3.5" />
            <span className="hidden sm:inline">{isBenchmarking ? 'Testing...' : 'Compare Modes'}</span>
          </button>

          {/* Emergency Priority Corridor */}
          <button
            onClick={handleToggleEmergency}
            className={cn(
              'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-lg transition-all cursor-pointer',
              snapshot?.emergencyActive
                ? 'border-rose-500/50 bg-rose-600 text-white animate-pulse shadow-rose-900/40'
                : 'border-rose-500/30 bg-slate-900/85 text-rose-400 hover:bg-rose-500/20 backdrop-blur-md'
            )}
          >
            <Siren className="size-3.5" />
            <span>{snapshot?.emergencyActive ? 'Clear Corridor' : 'Priority Corridor'}</span>
          </button>

          {/* Developer Debug Mode HUD Toggle */}
          <button
            onClick={() => {
              const next = !debugMode;
              setDebugMode(next);
              engine.debugMode = next;
              setShowDebugDrawer(next);
              toast.info(next ? 'Development Debug HUD Enabled' : 'Debug HUD Disabled');
            }}
            title="Toggle Developer Diagnostics HUD & Vehicle Telemetry"
            className={cn(
              'rounded-xl border border-white/10 p-1.5 text-xs font-medium backdrop-blur-md transition-colors shadow-lg cursor-pointer flex items-center gap-1.5',
              debugMode ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900/85 text-slate-300 hover:bg-white/10 hover:text-white'
            )}
          >
            <Cpu className="size-4" />
            <span className="hidden xl:inline text-[11px]">Debug HUD</span>
          </button>

          {/* Configuration Drawer Toggle */}
          <button
            onClick={() => setShowConfigDrawer((s) => !s)}
            title="Configure Traffic Demand & Signal Settings"
            className={cn(
              'rounded-xl border border-white/10 p-1.5 text-xs font-medium backdrop-blur-md transition-colors shadow-lg cursor-pointer',
              showConfigDrawer ? 'bg-primary text-primary-foreground' : 'bg-slate-900/85 text-slate-300 hover:bg-white/10 hover:text-white'
            )}
          >
            <Sliders className="size-4" />
          </button>
        </div>
      </div>

      {/* Floating Configuration Drawer (Sliding from Right) */}
      {showConfigDrawer && (
        <div className="absolute top-16 right-3 z-30 w-84 rounded-2xl border border-white/15 bg-slate-900/95 p-4 backdrop-blur-xl shadow-2xl text-white pointer-events-auto space-y-4 animate-in fade-in slide-in-from-right-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <Sliders className="size-4 text-primary" />
              <h3 className="font-semibold text-sm">Traffic Demand & Parameters</h3>
            </div>
            <button onClick={() => setShowConfigDrawer(false)} className="text-slate-400 hover:text-white">
              <X className="size-4" />
            </button>
          </div>

          {/* Directional Demands */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">Approaching Demand</span>
              <span className="text-[10px] font-mono text-slate-400">veh / minute</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {(['north', 'south', 'east', 'west'] as Direction[]).map((dir) => (
                <div key={dir} className="rounded-xl border border-white/10 bg-slate-800/60 p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="capitalize font-semibold text-slate-200">{dir}</span>
                    <span className="font-mono text-primary font-bold">{demands[dir]}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="2"
                    value={demands[dir]}
                    onChange={(e) => handleDemandChange(dir, Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Downstream Blockage Toggle (Spillback Demonstration) */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                <Construction className="size-3.5" />
                <span>Block West Exit (Spillback)</span>
              </div>
              <Switch checked={westBlocked} onCheckedChange={handleToggleWestBlocked} />
            </div>
            <p className="text-[10px] text-slate-300 leading-tight">
              Blocks exit road to demonstrate Yellow Box junction holding and downstream queue spillback.
            </p>
          </div>

          {/* Congestion Overlays Toggle */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10">
            <span className="text-slate-300">Show Road Heat Overlays</span>
            <Switch
              checked={showOverlays}
              onCheckedChange={(c) => {
                setShowOverlays(c);
                engine.congestionOverlays = c;
              }}
            />
          </div>
        </div>
      )}

      {/* Floating Developer Debug HUD Diagnostics Drawer */}
      {showDebugDrawer && snapshot && (
        <div className="absolute top-16 right-3 z-30 w-96 max-h-[75vh] overflow-y-auto rounded-2xl border border-amber-500/30 bg-slate-900/95 p-4 backdrop-blur-xl shadow-2xl text-white pointer-events-auto space-y-3 animate-in fade-in slide-in-from-right-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <Cpu className="size-4 text-amber-400" />
              <h3 className="font-semibold text-xs tracking-wider uppercase text-amber-300">
                Engine Diagnostics HUD
              </h3>
            </div>
            <button onClick={() => setShowDebugDrawer(false)} className="text-slate-400 hover:text-white">
              <X className="size-4" />
            </button>
          </div>

          {/* Stop Reason Summary Chips */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-2">
              <div className="text-slate-400">RED_SIGNAL</div>
              <div className="text-base font-bold font-mono text-rose-400">
                {snapshot.vehicles.filter((v) => v.stopReason === 'RED_SIGNAL').length}
              </div>
            </div>
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-2">
              <div className="text-slate-400">VEHICLE_AHEAD (Queue)</div>
              <div className="text-base font-bold font-mono text-blue-400">
                {snapshot.vehicles.filter((v) => v.stopReason === 'VEHICLE_AHEAD').length}
              </div>
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2">
              <div className="text-slate-400">INTERSECTION_OCCUPIED</div>
              <div className="text-base font-bold font-mono text-amber-400">
                {snapshot.vehicles.filter((v) => v.stopReason === 'INTERSECTION_OCCUPIED').length}
              </div>
            </div>
            <div className="rounded-lg bg-purple-500/10 border border-purple-500/30 p-2">
              <div className="text-slate-400">DOWNSTREAM_BLOCKED</div>
              <div className="text-base font-bold font-mono text-purple-400">
                {snapshot.vehicles.filter((v) => v.stopReason === 'DOWNSTREAM_BLOCKED').length}
              </div>
            </div>
          </div>

          {/* Stopped & Queued Vehicles Table */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
              <span>Active Stopped Vehicles</span>
              <span className="font-mono text-slate-400">
                {snapshot.vehicles.filter((v) => v.stopReason !== 'NONE').length} veh
              </span>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {snapshot.vehicles
                .filter((v) => v.stopReason !== 'NONE' || v.speed < 1.0)
                .map((v) => (
                  <div
                    key={v.id}
                    className="rounded-lg border border-white/10 bg-slate-800/70 p-2 text-[10px] space-y-1"
                  >
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-slate-200">
                        #{v.id} {v.kind.toUpperCase()}
                      </span>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
                          v.stopReason === 'RED_SIGNAL'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : v.stopReason === 'VEHICLE_AHEAD'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : v.stopReason === 'DOWNSTREAM_BLOCKED'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        )}
                      >
                        {v.stopReason}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-slate-300 text-[9.5px]">
                      <div>
                        App: <strong className="text-white capitalize">{v.approach}</strong>
                      </div>
                      <div>
                        Turn: <strong className="text-white capitalize">{v.turn}</strong>
                      </div>
                      <div>
                        Signal: <strong className={v.signalState === 'green' ? 'text-emerald-400' : 'text-rose-400'}>{v.signalState.toUpperCase()}</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-slate-300 text-[9.5px]">
                      <div>
                        StopLine: <span className="font-mono text-white">{v.distToStopLine}m</span>
                      </div>
                      <div>
                        Speed: <span className="font-mono text-white">{(v.speed * 3.6).toFixed(1)} km/h</span>
                      </div>
                    </div>

                    {v.stopReasonDetail && (
                      <p className="text-[9px] text-slate-400 italic leading-tight pt-0.5 border-t border-white/5">
                        ↳ {v.stopReasonDetail}
                      </p>
                    )}
                  </div>
                ))}
              {snapshot.vehicles.filter((v) => v.stopReason !== 'NONE' || v.speed < 1.0).length === 0 && (
                <div className="text-center py-4 text-[11px] text-emerald-400">
                  ✓ All vehicles in motion. Zero stationary queues.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Adaptive AI Reasoning Stream */}
      {signalMode === 'adaptive' && snapshot?.adaptiveReasoning && (
        <div className="absolute top-16 left-3 z-20 max-w-md rounded-xl border border-emerald-500/30 bg-slate-900/90 px-3 py-2 backdrop-blur-md shadow-lg pointer-events-auto">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
              Adaptive Controller Decision
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-100 font-medium leading-snug">{snapshot.adaptiveReasoning}</p>
        </div>
      )}

      {/* Bottom Floating Telemetry & Sim Speed Bar */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-end justify-between gap-2 pointer-events-none">
        {/* Left: Approach Queues & Live Metrics Ribbon */}
        {showTelemetry && snapshot && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 text-xs backdrop-blur-md shadow-lg pointer-events-auto text-slate-200">
            {/* Status & Active Mode */}
            <div className="flex items-center gap-1.5 font-medium">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[11px] font-semibold text-white">Kochi Central Junction</span>
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase',
                  signalMode === 'adaptive' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-300'
                )}
              >
                {signalMode}
              </span>
            </div>

            <div className="h-4 w-px bg-white/15" />

            {/* Approach Queues */}
            <div className="flex items-center gap-2.5 text-[11px]">
              {(['north', 'south', 'east', 'west'] as Direction[]).map((d) => {
                const m = snapshot.approachMetrics[d];
                const sig = snapshot.signals[d];
                const sec = Math.ceil(snapshot.signalTimers[d]);
                return (
                  <div key={d} className="flex items-center gap-1">
                    <span className="capitalize font-mono text-slate-400">{d[0].toUpperCase()}:</span>
                    <span
                      className={cn(
                        'rounded px-1 text-[9.5px] font-bold font-mono',
                        sig === 'green' ? 'bg-emerald-500/20 text-emerald-400' : sig === 'amber' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'
                      )}
                    >
                      {sec}s
                    </span>
                    <span
                      className={cn(
                        'font-bold font-mono text-[10px]',
                        m.queueCount >= 8 ? 'text-rose-400' : m.queueCount >= 4 ? 'text-amber-400' : 'text-slate-300'
                      )}
                    >
                      {m.queueCount}q
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="h-4 w-px bg-white/15" />

            {/* Vehicle & Throughput Counts */}
            <div className="flex items-center gap-3 text-[11px]">
              <span>
                Active: <strong className="text-white font-mono">{snapshot.vehicleCount}</strong>
              </span>
              <span>
                Throughput: <strong className="text-cyan-400 font-mono">{snapshot.throughputPerMin}</strong> veh/min
              </span>
              <span>
                Speed: <strong className="text-white font-mono">{snapshot.avgSpeedKmh}</strong> km/h
              </span>
            </div>
          </div>
        )}

        {/* Right: Sim Controls */}
        <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/85 p-1 backdrop-blur-md shadow-lg pointer-events-auto">
          {/* Play/Pause */}
          <button
            onClick={handleTogglePlay}
            title={isPaused ? 'Resume Simulation' : 'Pause Simulation'}
            className="flex items-center justify-center rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            {isPaused ? <Play className="size-3.5 text-emerald-400" /> : <Pause className="size-3.5 text-amber-400" />}
          </button>

          {/* Speed Multipliers */}
          <div className="flex items-center rounded-lg bg-black/30 p-0.5">
            {[0.5, 1, 2, 4].map((spd) => (
              <button
                key={spd}
                onClick={() => handleSetSpeed(spd)}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer',
                  simSpeed === spd ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:text-white'
                )}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Reset */}
          <button
            onClick={handleReset}
            title="Reset Simulation"
            className="flex items-center justify-center rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Benchmark Experiment Modal */}
      {showBenchmarkModal && benchmarkResult && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-white/20 bg-slate-900 p-6 shadow-2xl text-white space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="size-5 text-cyan-400" />
                <h3 className="font-display font-semibold text-lg">Experiment: Fixed-Time vs Adaptive Control</h3>
              </div>
              <button onClick={() => setShowBenchmarkModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="size-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Empirical simulation benchmark executed over 60 seconds with identical vehicle arrival schedules, route choices, and
              approach demands.
            </p>

            {/* Metrics Comparison Table */}
            <div className="rounded-xl border border-white/10 overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-800 text-slate-400 font-mono text-[10px] uppercase">
                  <tr>
                    <th className="p-2.5">Performance Metric</th>
                    <th className="p-2.5">Fixed-Time Mode</th>
                    <th className="p-2.5 text-emerald-400">Adaptive AI Mode</th>
                    <th className="p-2.5 text-right">Measured Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 font-medium">
                  <tr>
                    <td className="p-2.5 text-slate-200">Average Waiting Time</td>
                    <td className="p-2.5 font-mono">{benchmarkResult.fixed.avgWaitTime}s</td>
                    <td className="p-2.5 font-mono text-emerald-400">{benchmarkResult.adaptive.avgWaitTime}s</td>
                    <td className="p-2.5 font-mono text-right text-emerald-400 font-bold">
                      {benchmarkResult.delta.waitTimePct}%
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-slate-200">Total Stopped Delay</td>
                    <td className="p-2.5 font-mono">{benchmarkResult.fixed.totalStoppedDelay}s</td>
                    <td className="p-2.5 font-mono text-emerald-400">{benchmarkResult.adaptive.totalStoppedDelay}s</td>
                    <td className="p-2.5 font-mono text-right text-emerald-400 font-bold">
                      {benchmarkResult.delta.delayPct}%
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-slate-200">Max Queue Length</td>
                    <td className="p-2.5 font-mono">{benchmarkResult.fixed.maxQueueLength} veh</td>
                    <td className="p-2.5 font-mono text-emerald-400">{benchmarkResult.adaptive.maxQueueLength} veh</td>
                    <td className="p-2.5 font-mono text-right text-emerald-400 font-bold">
                      {benchmarkResult.delta.queuePct}%
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-slate-200">Intersection Throughput</td>
                    <td className="p-2.5 font-mono">{benchmarkResult.fixed.throughputPerMin} veh/min</td>
                    <td className="p-2.5 font-mono text-emerald-400">{benchmarkResult.adaptive.throughputPerMin} veh/min</td>
                    <td className="p-2.5 font-mono text-right text-cyan-400 font-bold">
                      +{benchmarkResult.delta.throughputPct}%
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-slate-200">Completed Journeys</td>
                    <td className="p-2.5 font-mono">{benchmarkResult.fixed.totalCompletedJourneys}</td>
                    <td className="p-2.5 font-mono text-emerald-400">{benchmarkResult.adaptive.totalCompletedJourneys}</td>
                    <td className="p-2.5 font-mono text-right text-cyan-400 font-bold">
                      +{benchmarkResult.adaptive.totalCompletedJourneys - benchmarkResult.fixed.totalCompletedJourneys}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setShowBenchmarkModal(false)}>
                Close
              </Button>
              <Button size="sm" onClick={handleRunBenchmark} className="bg-cyan-600 hover:bg-cyan-700 text-white gap-1.5">
                <RefreshCw className="size-3.5" /> Re-run Test
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
