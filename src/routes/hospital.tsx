// Aster Medcity Trauma Center & Emergency Department Dashboard - Hospital Pre-Alert Console
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { AppShell } from "@/components/app-shell";
import { useMission, generateSimulatedPatient, type MissionState } from "@/lib/mission";
import { useSentinelStore } from "@/lib/store";
import {
  Activity,
  HeartPulse,
  Ambulance,
  Clock,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
  Radio,
  Layers,
  ChevronRight,
  Flame,
  Zap,
  Info,
  Check,
  Volume2,
  Bed,
  Sparkles,
  RefreshCw,
  Droplet,
  Wind,
  DoorOpen,
  UserCheck,
  ArrowRight,
  Sliders,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/hospital")({
  head: () => ({
    meta: [
      { title: "Hospital Pre-Alert Console · Aster Medcity | Sentinel AI" },
      {
        name: "description",
        content:
          "Aster Medcity Trauma Center Pre-Alert Console. Real-time emergency patient telemetry, staged resuscitation readiness checklist, bed management, and green corridor preemption tracking.",
      },
    ],
  }),
  component: HospitalPreAlertPage,
});

interface ReadinessStage {
  id: string;
  title: string;
  desc: string;
  etaTriggerSec: number;
  completed: boolean;
  timestamp: string | null;
  manualOverride: boolean;
}

const INITIAL_STAGES: ReadinessStage[] = [
  {
    id: "case_received",
    title: "1. Case Received",
    desc: "Emergency corridor mission telemetry established",
    etaTriggerSec: 9999, // Triggered immediately on dispatch
    completed: false,
    timestamp: null,
    manualOverride: false,
  },
  {
    id: "team_notified",
    title: "2. Trauma Team Notified",
    desc: "Trauma Surgery Lead & Resuscitation Alpha paged (ETA < 8 min)",
    etaTriggerSec: 480,
    completed: false,
    timestamp: null,
    manualOverride: false,
  },
  {
    id: "bed_reserved",
    title: "3. ICU Bed Reserved",
    desc: "Trauma Bay 04 & ICU Bed 03 allocated with rapid infuser",
    etaTriggerSec: 360,
    completed: false,
    timestamp: null,
    manualOverride: false,
  },
  {
    id: "blood_standby",
    title: "4. Blood Bank Standby",
    desc: "4 Units Packed RBCs & Plasma reserved for patient blood group",
    etaTriggerSec: 300,
    completed: false,
    timestamp: null,
    manualOverride: false,
  },
  {
    id: "team_standby",
    title: "5. Trauma Team Standby at Entrance",
    desc: "Surgical team & gurney standing by at Emergency Bay entrance (ETA < 2 min)",
    etaTriggerSec: 120,
    completed: false,
    timestamp: null,
    manualOverride: false,
  },
  {
    id: "patient_arrived",
    title: "6. Patient Arrived",
    desc: "Ambulance docked at Trauma Bay 04; clinical handover initiated",
    etaTriggerSec: 0,
    completed: false,
    timestamp: null,
    manualOverride: false,
  },
];

function HospitalPreAlertPage() {
  const { mission, subscriberCount, publishMission } = useMission();
  const { addDecision } = useSentinelStore();

  const [stages, setStages] = useState<ReadinessStage[]>(INITIAL_STAGES);
  const loggedDecisions = useRef<Set<string>>(new Set());

  const isDispatched = mission.status !== "idle";
  const isEnroute = mission.status === "enroute";
  const isArrived = mission.status === "arrived" || mission.status === "completed";
  const etaSec = mission.etaSeconds || 0;
  const isStandbyUnder2Min = isEnroute && etaSec <= 120 && etaSec > 0;

  // Auto-advance staged readiness checklist based on ETA and mission status
  useEffect(() => {
    if (!isDispatched) {
      // Reset stages when idle
      setStages(INITIAL_STAGES);
      loggedDecisions.current.clear();
      return;
    }

    setStages((prevStages) =>
      prevStages.map((stage) => {
        let shouldBeComplete = stage.completed;

        if (stage.id === "case_received") {
          shouldBeComplete = isDispatched || stage.manualOverride;
        } else if (stage.id === "patient_arrived") {
          shouldBeComplete = isArrived || stage.manualOverride;
        } else {
          // ETA based trigger
          shouldBeComplete = (isEnroute && etaSec <= stage.etaTriggerSec) || isArrived || stage.manualOverride;
        }

        const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const timestamp = shouldBeComplete ? stage.timestamp || now : null;

        // Log decision if newly completed
        if (shouldBeComplete && !stage.completed && !loggedDecisions.current.has(stage.id)) {
          loggedDecisions.current.add(stage.id);
          const timeLabel = etaSec > 0 ? `T-${Math.floor(etaSec / 60)}:${(etaSec % 60).toString().padStart(2, "0")}` : "T-0:00";
          addDecision({
            action: `Pre-alert stage "${stage.title}" activated at ${timeLabel}. ${stage.desc} at Aster Medcity Trauma Center.`,
            agent: "Hospital Trauma AI",
            outcome: "auto",
          });
        }

        return {
          ...stage,
          completed: shouldBeComplete,
          timestamp,
        };
      })
    );
  }, [isDispatched, isEnroute, isArrived, etaSec, addDecision]);

  // Toggle manual override for an individual stage
  const handleToggleStage = (stageId: string) => {
    setStages((prev) =>
      prev.map((s) => {
        if (s.id === stageId) {
          const nextState = !s.completed;
          const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          toast.info(`Manual stage override: ${s.title} marked as ${nextState ? "COMPLETED" : "PENDING"}`);
          return {
            ...s,
            completed: nextState,
            manualOverride: nextState,
            timestamp: nextState ? (s.timestamp || now) : null,
          };
        }
        return s;
      })
    );
  };

  // Test trigger for demo/judging from the hospital screen directly
  const handleSimulateDemoDispatch = () => {
    const seeded = generateSimulatedPatient("DEMO-HOSPITAL-01");
    const demoMission: MissionState = {
      id: "MSN-TRAUMA-994",
      status: "enroute",
      vehicleType: "ambulance",
      patient: seeded,
      origin: "Incident Site (Palarivattom)",
      destination: "Aster Medcity Trauma Center",
      etaSeconds: 235,
      distanceMeters: 1850,
      nextJunction: "Palarivattom Junction",
      distanceToNextJunctionM: 320,
      junctions: [
        { name: "Incident Site (Palarivattom)", state: "EMERGENCY_GREEN", phase: "green" },
        { name: "Kaloor Junction", state: "EMERGENCY_GREEN", phase: "green" },
        { name: "Palarivattom Flyover", state: "PREEMPT_REQUESTED", phase: "yellow" },
        { name: "Edappally Toll", state: "NORMAL", phase: "red" },
        { name: "Vyttila Hub", state: "NORMAL", phase: "red" },
        { name: "Aster Medcity Gate", state: "NORMAL", phase: "red" },
      ],
      position: { lat: 9.9984, lng: 76.3072 },
      speedKmh: 64,
      startedAt: Date.now() - 60000,
      updatedAt: Date.now(),
    };
    publishMission(demoMission);
    toast.success("🚨 Simulated Emergency Mission Dispatched to Aster Medcity!");
  };

  const handleResetToIdle = () => {
    const idleMission: MissionState = {
      id: "IDLE",
      status: "idle",
      vehicleType: "ambulance",
      patient: generateSimulatedPatient("IDLE-0"),
      origin: "Kochi General",
      destination: "Aster Medcity",
      etaSeconds: 0,
      distanceMeters: 0,
      nextJunction: "",
      distanceToNextJunctionM: 0,
      junctions: [],
      position: { lat: 9.9822, lng: 76.3116 },
      speedKmh: 0,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
    publishMission(idleMission);
    setStages(INITIAL_STAGES);
    toast.info("Hospital console reset to Idle standby.");
  };

  // Format ETA into min:sec
  const formatEta = (seconds: number) => {
    if (seconds <= 0) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  };

  const completedStagesCount = stages.filter((s) => s.completed).length;
  const readinessPercent = Math.round((completedStagesCount / stages.length) * 100);

  return (
    <AppShell>
      <div className="space-y-6 pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-3.5">
            <div className="size-12 rounded-2xl bg-gradient-to-br from-rose-500 to-primary flex items-center justify-center text-white shadow-lg shadow-rose-500/25">
              <HeartPulse className="size-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-display tracking-tight text-foreground">
                  Hospital Pre-Alert Console
                </h1>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold">
                  Aster Medcity Trauma ICU
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Kochi Level-1 Trauma Resuscitation Hub · Real-time Green Corridor Pre-Hospital Ingest
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Simulation Modelled Data Badge */}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
              <Info className="size-3.5" />
              Simulation (modelled data)
            </span>

            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 px-3 py-1 text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
              <Radio className="size-3.5 animate-pulse text-blue-500" />
              <span>Citizens Notified: {subscriberCount}</span>
            </div>

            <Link
              to="/dispatch"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors shadow-xs"
            >
              <Ambulance className="size-3.5" />
              <span>Unified Dispatch Board →</span>
            </Link>

            {/* Quick Simulation Trigger Buttons */}
            {!isDispatched ? (
              <Button
                onClick={handleSimulateDemoDispatch}
                size="sm"
                className="rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-8 px-3 cursor-pointer shadow-sm"
              >
                <Flame className="size-3.5 mr-1" />
                Simulate Dispatch
              </Button>
            ) : (
              <Button
                onClick={handleResetToIdle}
                variant="outline"
                size="sm"
                className="rounded-full text-xs h-8 px-3 cursor-pointer"
              >
                <RefreshCw className="size-3.5 mr-1" />
                Reset to Idle
              </Button>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* IDLE STATE: "No incoming emergency" + Bed status cards */}
        {/* ------------------------------------------------------------------ */}
        {!isDispatched ? (
          <div className="space-y-6 animate-fade">
            {/* Idle Standby Hero Banner */}
            <div className="rounded-3xl p-6 bg-card border border-border shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="size-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0">
                  <ShieldCheck className="size-7 text-emerald-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    <h2 className="text-lg font-bold text-foreground">No Incoming Emergency</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
                    Aster Medcity Trauma ICU is in active standby. Green Corridor preemption telemetry is listening on channel{" "}
                    <code className="bg-secondary px-1.5 py-0.5 rounded font-mono text-[11px] text-primary">
                      sentinel-mission
                    </code>
                    . Staged readiness checklist will prime automatically when an emergency dispatch is initiated.
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5 w-full md:w-auto">
                <Button
                  onClick={handleSimulateDemoDispatch}
                  className="w-full md:w-auto rounded-2xl bg-primary text-white font-bold text-xs h-11 px-5 cursor-pointer shadow-md"
                >
                  <Ambulance className="size-4 mr-2" />
                  Test Simulated Incoming Case
                </Button>
                <Link
                  to="/twin"
                  className="inline-flex items-center justify-center rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-semibold hover:bg-secondary transition-colors"
                >
                  Launch 3D Twin →
                </Link>
              </div>
            </div>

            {/* Simulated Bed Status Cards */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5">
                  <Bed className="size-4 text-primary" />
                  Hospital Resource & Bed Readiness (Live Simulated Feed)
                </h3>
                <span className="text-[11px] font-mono text-emerald-600 font-bold">Aster Trauma Unit Level-1</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* ICU Beds */}
                <div className="bg-card rounded-3xl p-5 border border-border shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">ICU Beds</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                      3 / 12 Free
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-foreground">3</span>
                    <span className="text-xs text-muted-foreground font-mono">Beds Available</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full w-[25%]" />
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">Bed ICU-03 reserved for emergency ingest</p>
                </div>

                {/* Trauma Bays */}
                <div className="bg-card rounded-3xl p-5 border border-border shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Trauma Bays</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                      2 / 4 Ready
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-foreground">2</span>
                    <span className="text-xs text-muted-foreground font-mono">Bays Primed</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full w-[50%]" />
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">Bay 04 assigned to Green Corridor link</p>
                </div>

                {/* Ventilators */}
                <div className="bg-card rounded-3xl p-5 border border-border shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Ventilators</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-600 border border-blue-500/30">
                      5 / 8 Online
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-foreground">5</span>
                    <span className="text-xs text-muted-foreground font-mono">Units Standby</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full w-[62.5%]" />
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">Hamilton-C6 rapid infusers calibrated</p>
                </div>

                {/* Operation Theatres */}
                <div className="bg-card rounded-3xl p-5 border border-border shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">OT Status</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                      OT-1 Open
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-foreground">2</span>
                    <span className="text-xs text-muted-foreground font-mono">OTs Available</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full w-[50%]" />
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">OT-1 (Trauma Vascular) on standby</p>
                </div>
              </div>
            </div>

            {/* Blood Bank Live Stock */}
            <div className="bg-card rounded-3xl p-6 border border-border shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Droplet className="size-4 text-rose-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                    Blood Bank Reserve Status (Kochi Regional Blood Center)
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-emerald-600 font-bold">Updated Just Now</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center">
                  <span className="text-[10px] font-bold text-rose-600 block">O-Negative</span>
                  <strong className="text-xl font-extrabold text-rose-700 dark:text-rose-400">8 Units</strong>
                  <span className="text-[9px] text-muted-foreground block mt-0.5">Universal Donor</span>
                </div>
                <div className="p-3 rounded-2xl bg-secondary/60 border border-border text-center">
                  <span className="text-[10px] text-muted-foreground block">A-Positive</span>
                  <strong className="text-xl font-bold text-foreground">14 Units</strong>
                  <span className="text-[9px] text-muted-foreground block mt-0.5">Sufficient</span>
                </div>
                <div className="p-3 rounded-2xl bg-secondary/60 border border-border text-center">
                  <span className="text-[10px] text-muted-foreground block">B-Positive</span>
                  <strong className="text-xl font-bold text-foreground">12 Units</strong>
                  <span className="text-[9px] text-muted-foreground block mt-0.5">Sufficient</span>
                </div>
                <div className="p-3 rounded-2xl bg-secondary/60 border border-border text-center">
                  <span className="text-[10px] text-muted-foreground block">AB-Positive</span>
                  <strong className="text-xl font-bold text-foreground">6 Units</strong>
                  <span className="text-[9px] text-muted-foreground block mt-0.5">Reserved</span>
                </div>
                <div className="p-3 rounded-2xl bg-secondary/60 border border-border text-center">
                  <span className="text-[10px] text-muted-foreground block">Plasma (FFP)</span>
                  <strong className="text-xl font-bold text-primary">20 Bags</strong>
                  <span className="text-[9px] text-muted-foreground block mt-0.5">Thawed Ready</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ------------------------------------------------------------------ */
          /* ACTIVE / DISPATCHED / ENROUTE / ARRIVED STATE */
          /* ------------------------------------------------------------------ */
          <div className="space-y-6">
            {/* UNDER 2 MINUTE TRAUMA TEAM STANDBY BANNER */}
            <AnimatePresence>
              {isStandbyUnder2Min && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -8 }}
                  className="rounded-3xl p-5 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 text-white shadow-xl shadow-rose-600/30 border-4 border-white/40 animate-pulse flex flex-col sm:flex-row items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="size-13 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 text-white border border-white/30">
                      <Ambulance className="size-7 animate-bounce" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-white text-rose-700 font-mono font-extrabold text-[10px] uppercase px-2.5 py-0.5 rounded-full">
                          CRITICAL ALERT · ETA &lt; 2 MIN
                        </span>
                        <span className="size-2.5 rounded-full bg-white animate-ping" />
                      </div>
                      <h2 className="text-xl font-black tracking-tight mt-0.5">
                        TRAUMA TEAM STANDBY AT ENTRANCE
                      </h2>
                      <p className="text-xs text-white/90 font-medium mt-0.5">
                        Ambulance is {mission.distanceMeters}m away (~{formatEta(mission.etaSeconds)}). Resuscitation Team Alpha and Trauma Bay 04 gurney positioned.
                      </p>
                    </div>
                  </div>

                  <div className="bg-black/30 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 text-center shrink-0">
                    <span className="text-[10px] uppercase tracking-wider block text-white/80 font-mono">
                      Entrance Countdown
                    </span>
                    <strong className="text-2xl font-black font-mono text-yellow-300">
                      {formatEta(mission.etaSeconds)}
                    </strong>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ARRIVAL SUMMARY CARD */}
            {isArrived && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-3xl p-6 bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-950 dark:text-emerald-100 shadow-lg space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-emerald-500/30 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                      <CheckCircle2 className="size-6" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-foreground">
                        Patient Safely Docked at Aster Medcity Trauma Bay 04
                      </h2>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        Green corridor emergency transit completed successfully with zero signal bottlenecks.
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40">
                    MISSION COMPLETED
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="bg-card/80 p-4 rounded-2xl border border-emerald-500/20">
                    <span className="text-[10px] text-muted-foreground block uppercase font-bold">
                      Total Transit Time
                    </span>
                    <strong className="text-lg font-bold text-foreground">4m 18s</strong>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">vs 19m standard delay</span>
                  </div>

                  <div className="bg-card/80 p-4 rounded-2xl border border-emerald-500/20">
                    <span className="text-[10px] text-muted-foreground block uppercase font-bold text-emerald-600">
                      Time Saved by Corridor
                    </span>
                    <strong className="text-lg font-bold text-emerald-600">14.8 minutes saved</strong>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">77% transit reduction</span>
                  </div>

                  <div className="bg-card/80 p-4 rounded-2xl border border-emerald-500/20">
                    <span className="text-[10px] text-muted-foreground block uppercase font-bold text-primary">
                      Readiness Achieved
                    </span>
                    <strong className="text-lg font-bold text-primary">100% Pre-hospital Primed</strong>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">3m 40s before arrival</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Live Case Banner & Telemetry Overview */}
            <div className="rounded-3xl p-5 bg-card border border-border shadow-md flex flex-col lg:flex-row items-center justify-between gap-5">
              <div className="flex items-center gap-4 w-full lg:w-auto">
                <div
                  className={cn(
                    "size-13 rounded-2xl flex items-center justify-center shrink-0 shadow-md text-white",
                    isArrived ? "bg-emerald-600" : "bg-rose-600 animate-pulse"
                  )}
                >
                  <Ambulance className="size-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border",
                        isArrived
                          ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                          : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40 animate-pulse"
                      )}
                    >
                      {isArrived ? "Ambulance Docked" : "Incoming Emergency"}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">{mission.id}</span>
                  </div>
                  <h3 className="text-base font-bold text-foreground mt-0.5">
                    {mission.origin} <ChevronRight className="inline size-4 text-primary" /> {mission.destination}
                  </h3>
                </div>
              </div>

              {/* Tickers */}
              <div className="grid grid-cols-4 gap-3 w-full lg:w-auto text-xs font-mono">
                <div className="bg-secondary/70 rounded-2xl px-3.5 py-2.5 text-center">
                  <span className="text-[10px] text-muted-foreground block">Live ETA</span>
                  <strong className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {isArrived ? "0s" : formatEta(mission.etaSeconds)}
                  </strong>
                </div>
                <div className="bg-secondary/70 rounded-2xl px-3.5 py-2.5 text-center">
                  <span className="text-[10px] text-muted-foreground block">Distance Left</span>
                  <strong className="text-base font-bold text-foreground">
                    {isArrived ? "0 m" : `${mission.distanceMeters} m`}
                  </strong>
                </div>
                <div className="bg-secondary/70 rounded-2xl px-3.5 py-2.5 text-center">
                  <span className="text-[10px] text-muted-foreground block">Speed</span>
                  <strong className="text-base font-bold text-primary">{mission.speedKmh} km/h</strong>
                </div>
                <div className="bg-secondary/70 rounded-2xl px-3.5 py-2.5 text-center">
                  <span className="text-[10px] text-muted-foreground block">Readiness</span>
                  <strong className="text-base font-bold text-emerald-600">{readinessPercent}%</strong>
                </div>
              </div>
            </div>

            {/* Live Mini Route Progress Bar with Junctions Cleared */}
            <div className="bg-card rounded-3xl p-5 border border-border shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5">
                  <Layers className="size-4 text-primary" />
                  Corridor Route Preemption Stream (5 Junctions)
                </span>
                <span className="text-[11px] font-mono text-primary font-bold">
                  {mission.junctions.filter((j) => j.state === "EMERGENCY_GREEN" || j.phase === "green").length} / {mission.junctions.length || 5} Preempted
                </span>
              </div>

              {/* Progress bar line */}
              <div className="relative pt-3 pb-1">
                <div className="h-2 bg-secondary rounded-full overflow-hidden w-full">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500 via-primary to-rose-500 rounded-full"
                    initial={{ width: "10%" }}
                    animate={{
                      width: isArrived
                        ? "100%"
                        : `${Math.max(15, Math.min(95, 100 - (mission.distanceMeters / 2500) * 100))}%`,
                    }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                {/* Junction nodes */}
                <div className="grid grid-cols-5 gap-2 mt-3">
                  {(mission.junctions.length > 0
                    ? mission.junctions
                    : [
                        { name: "Incident Site", state: "EMERGENCY_GREEN", phase: "green" },
                        { name: "Kaloor", state: "EMERGENCY_GREEN", phase: "green" },
                        { name: "Palarivattom", state: "PREEMPT_REQUESTED", phase: "yellow" },
                        { name: "Edappally", state: "NORMAL", phase: "red" },
                        { name: "Vyttila Hub", state: "NORMAL", phase: "red" },
                      ]
                  ).map((j, idx) => {
                    const isGreen = j.state === "EMERGENCY_GREEN" || j.phase === "green";
                    const isPreemptRequested = j.state === "PREEMPT_REQUESTED" || j.phase === "yellow";
                    return (
                      <div key={`step-j-${idx}`} className="text-center font-mono">
                        <div
                          className={cn(
                            "size-5 mx-auto rounded-full flex items-center justify-center text-[9px] font-bold border transition-all",
                            isGreen
                              ? "bg-emerald-500 text-white border-emerald-400 shadow-xs shadow-emerald-500"
                              : isPreemptRequested
                                ? "bg-amber-500 text-white border-amber-400 animate-pulse"
                                : "bg-secondary text-muted-foreground border-border"
                          )}
                        >
                          {isGreen ? "✓" : idx + 1}
                        </div>
                        <p className="text-[10px] font-semibold text-foreground truncate mt-1">{j.name.split(" ")[0]}</p>
                        <span
                          className={cn(
                            "text-[8.5px] font-bold uppercase block",
                            isGreen ? "text-emerald-600" : isPreemptRequested ? "text-amber-600" : "text-muted-foreground"
                          )}
                        >
                          {isGreen ? "GREEN" : isPreemptRequested ? "PREEMPT" : "QUEUE"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Main 2-Column Clinical & Readiness Workspace */}
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Left Column: Incoming Case Card with Simulated Patient (6 cols) */}
              <div className="lg:col-span-6 space-y-5">
                <div className="bg-card rounded-3xl p-6 border border-border shadow-xs space-y-5">
                  <div className="flex items-center justify-between border-b border-border/70 pb-3">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="size-4 text-rose-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                        Incoming Case Card
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/30 font-bold">
                        {mission.patient.severity.toUpperCase()} PRIORITY
                      </span>
                      <span className="text-[9.5px] font-mono text-amber-600 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        Simulated patient
                      </span>
                    </div>
                  </div>

                  {/* Diagnosis condition */}
                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-1">
                    <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 uppercase font-bold tracking-wider block">
                      Suspected Clinical Condition
                    </span>
                    <p className="text-sm font-bold text-foreground leading-snug">{mission.patient.condition}</p>
                  </div>

                  {/* Attributes Grid */}
                  <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                    <div className="p-3 rounded-2xl bg-secondary/60 border border-border text-center">
                      <span className="text-[10px] text-muted-foreground block">Blood Group</span>
                      <strong className="text-lg font-extrabold text-rose-600">{mission.patient.bloodGroup}</strong>
                    </div>
                    <div className="p-3 rounded-2xl bg-secondary/60 border border-border text-center">
                      <span className="text-[10px] text-muted-foreground block">Age</span>
                      <strong className="text-lg font-bold text-foreground">{mission.patient.age} yrs</strong>
                    </div>
                    <div className="p-3 rounded-2xl bg-secondary/60 border border-border text-center">
                      <span className="text-[10px] text-muted-foreground block">Glasgow Coma</span>
                      <strong className="text-lg font-bold text-foreground">
                        GCS {mission.patient.vitals?.gcs || 13}/15
                      </strong>
                    </div>
                  </div>

                  {/* Live Vitals stream */}
                  <div className="p-4 rounded-2xl bg-secondary/40 border border-border space-y-2.5">
                    <div className="flex justify-between items-center text-[10px] font-mono uppercase text-muted-foreground font-bold">
                      <span>En-Route Paramedic Vitals Telemetry</span>
                      <span className="text-emerald-600 flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" /> LIVE
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                      <div className="bg-card p-2.5 rounded-xl border border-border text-center">
                        <span className="text-[9.5px] text-muted-foreground block">Blood Pressure</span>
                        <strong className="text-foreground">{mission.patient.vitals?.bp || "85/55 mmHg"}</strong>
                      </div>
                      <div className="bg-card p-2.5 rounded-xl border border-border text-center">
                        <span className="text-[9.5px] text-muted-foreground block">Heart Rate</span>
                        <strong className="text-rose-600">{mission.patient.vitals?.heartRate || 118} bpm</strong>
                      </div>
                      <div className="bg-card p-2.5 rounded-xl border border-border text-center">
                        <span className="text-[9.5px] text-muted-foreground block">SpO2 Oxygen</span>
                        <strong className="text-emerald-600">{mission.patient.vitals?.spo2 || 91}%</strong>
                      </div>
                    </div>
                  </div>

                  {/* Assigned Facilities */}
                  <div className="space-y-2 text-xs">
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DoorOpen className="size-4 text-emerald-600" />
                        <div>
                          <p className="font-bold text-foreground">Allocated Trauma Bay 04</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            Direct bay entrance clearance granted
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-600 font-bold uppercase">PRIMED</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Staged Readiness Checklist with Auto-Advance & Manual Overrides (6 cols) */}
              <div className="lg:col-span-6 space-y-5">
                <div className="bg-card rounded-3xl p-6 border border-border shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-border/70 pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-emerald-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                        Staged Resuscitation Readiness Checklist
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-600 font-bold">
                      {completedStagesCount} / {stages.length} Stages Ready
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Checklist auto-advances progressively based on live ETA countdown. Hospital operators can click any stage to confirm or override manually.
                  </p>

                  {/* Checklist Items */}
                  <div className="space-y-2.5">
                    {stages.map((stage) => {
                      const isBloodStage = stage.id === "blood_standby";
                      const displayTitle = isBloodStage
                        ? `4. Blood Group ${mission.patient.bloodGroup} Units on Standby`
                        : stage.title;

                      return (
                        <motion.div
                          key={stage.id}
                          layout
                          className={cn(
                            "p-3.5 rounded-2xl border text-xs flex items-center justify-between transition-all select-none cursor-pointer",
                            stage.completed
                              ? "bg-emerald-500/10 border-emerald-500/35 text-foreground shadow-2xs"
                              : "bg-secondary/40 border-border text-muted-foreground hover:bg-secondary/70"
                          )}
                          onClick={() => handleToggleStage(stage.id)}
                          title="Click to toggle or manually override this stage"
                        >
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className={cn(
                                "size-6 rounded-xl flex items-center justify-center font-bold text-xs transition-all shrink-0",
                                stage.completed
                                  ? "bg-emerald-500 text-white shadow-xs"
                                  : "border border-border bg-card text-muted-foreground"
                              )}
                            >
                              {stage.completed ? <Check className="size-3.5 stroke-[3]" /> : <div className="size-1.5 rounded-full bg-slate-400" />}
                            </button>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4
                                  className={cn(
                                    "font-bold text-xs",
                                    stage.completed ? "text-foreground" : "text-muted-foreground"
                                  )}
                                >
                                  {displayTitle}
                                </h4>
                                {stage.manualOverride && (
                                  <span className="text-[8.5px] font-mono font-semibold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                                    Manual
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{stage.desc}</p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {stage.completed ? (
                              <div className="flex flex-col items-end">
                                <span className="text-[9px] font-mono font-bold text-emerald-600 uppercase">READY</span>
                                <span className="text-[9px] font-mono text-muted-foreground">{stage.timestamp || "Active"}</span>
                              </div>
                            ) : (
                              <span className="text-[9px] font-mono text-slate-400 uppercase">
                                {stage.etaTriggerSec === 9999 ? "DISPATCH" : `< ${Math.floor(stage.etaTriggerSec / 60)}m ETA`}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-muted-foreground border-t border-border">
                    <span>Operator: Dr. V. Menon (Trauma Lead)</span>
                    <span className="text-emerald-600 font-bold">Auto-Sync Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
