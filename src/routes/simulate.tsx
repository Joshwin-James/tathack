import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { GlassCard, SectionHeader } from "@/components/ui-kit";
import { AgentReasoningStream } from "@/components/agent-reasoning-stream";
import { simulationResult, simulationScenarios } from "@/data/kochi";
import { Play, Sparkles, Calendar, Users, CloudRain, Shield, Bus, MapPin, Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/simulate")({
  head: () => ({
    meta: [
      { title: "Event Simulation · Kochi | Project Sentinel" },
      { name: "description", content: "Simulate what-if scenarios across Kochi: accidents, rain, floods, road closures, festivals." },
      { property: "og:title", content: "Event Simulation · Kochi" },
      { property: "og:description", content: "What-if scenario simulator for Kochi." },
    ],
  }),
  component: SimulatePage,
});

function SimulatePage() {
  const [activeTab, setActiveTab] = useState<"event" | "whatif">("event");

  // Planned Event Simulation state
  const [evtName, setEvtName] = useState("ISL Football Match · Jawaharlal Nehru Stadium");
  const [evtAttendance, setEvtAttendance] = useState(28000);
  const [evtDateTime, setEvtDateTime] = useState("Sat 18 Jul, 7:00 PM");
  const [evtWeather, setEvtWeather] = useState("Clear");
  const [simRunning, setSimRunning] = useState(false);
  const [simCompleted, setSimCompleted] = useState(false);
  const [geminiSimReport, setGeminiSimReport] = useState<string | null>(null);

  // What-If Scenario simulation state (original)
  const [selectedScenario, setSelectedScenario] = useState("truck");
  const [whatifRunning, setWhatifRunning] = useState(false);
  const [whatifRan, setWhatifRan] = useState(false);

  const handleSelectPreset = (name: string) => {
    setEvtName(name);
    setGeminiSimReport(null);
    if (name.includes("Metro Rush")) {
      setEvtAttendance(8500);
      setEvtWeather("Clear");
    } else if (name.includes("Monsoon")) {
      setEvtAttendance(45000);
      setEvtWeather("Heavy rain");
    } else if (name.includes("Vytilla Mobility")) {
      setEvtAttendance(35000);
      setEvtWeather("Light rain");
    } else if (name.includes("Lulu Mall")) {
      setEvtAttendance(50000);
    } else if (name.includes("Concert")) {
      setEvtAttendance(18000);
    } else if (name.includes("Marathon")) {
      setEvtAttendance(12000);
    } else {
      setEvtAttendance(28000);
    }
  };

  const runEventSimulation = () => {
    setSimRunning(true);
    setSimCompleted(false);
    setTimeout(() => {
      setSimRunning(false);
      setSimCompleted(true);
      toast.success("Event impact simulation completed!", {
        description: `Mobility impact & dispatch plan calculated for ${evtName}.`,
      });
    }, 1200);
  };

  const runWhatifSimulation = () => {
    setWhatifRunning(true);
    setWhatifRan(false);
    setTimeout(() => {
      setWhatifRunning(false);
      setWhatifRan(true);
      toast.success("What-If scenario simulation completed!");
    }, 5200);
  };

  // Calculations for Event Simulator
  const weatherModifier = evtWeather === "Light rain" ? 12 : evtWeather === "Heavy rain" ? 25 : 0;
  const congestionIncrease = Math.min(95, Math.round(evtAttendance / 650) + weatherModifier);
  const extraBuses = Math.round(evtAttendance / 2200);
  const policeOfficers = Math.round(evtAttendance / 3500);
  const metroFrequency = evtAttendance > 25000 ? "+2 trains/hr" : "+1 train/hr";

  const barChartData: [string, number][] = [
    ["Before", 34],
    ["+1 hr", Math.min(99, 34 + Math.round(congestionIncrease * 0.45))],
    ["Event Start", Math.min(99, 34 + congestionIncrease)],
    ["Peak +1 hr", Math.min(99, 34 + Math.round(congestionIncrease * 1.15))],
    ["Wind-down", Math.min(99, 34 + Math.round(congestionIncrease * 0.3))],
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">Predict · 04.b</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Event Simulation</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Evaluate event mobility impacts or run dynamic multi-agent what-if disaster models.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">

            {/* Tabs Control */}
            <div className="flex bg-secondary/80 border border-border/40 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab("event")}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  activeTab === "event" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Planned Event
              </button>
              <button
                onClick={() => setActiveTab("whatif")}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  activeTab === "whatif" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                What-If Agent
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: PLANNED EVENT SIMULATION */}
        {activeTab === "event" && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Simulation controls panel */}
            <GlassCard className="lg:col-span-1 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <h3 className="font-display text-sm font-semibold tracking-tight">Simulation Settings</h3>
                <Sparkles className="size-4 text-primary animate-pulse" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Planned Event</label>
                <select
                  value={evtName}
                  onChange={(e) => handleSelectPreset(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-secondary/80 px-3 py-2.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition-colors font-semibold truncate cursor-pointer"
                >
                  <option value="Metro Rush Surge · Edappally (500+ passengers)">Metro Rush Surge · Edappally (500+ pax)</option>
                  <option value="ISL Football Match · Jawaharlal Nehru Stadium">ISL Football Match · JLN Stadium (28k pax)</option>
                  <option value="Heavy Monsoon Cloudburst · Ernakulam City">Heavy Monsoon Cloudburst · Ernakulam</option>
                  <option value="Vytilla Mobility Hub Peak Rush Hour">Vytilla Mobility Hub Peak Rush (35k pax)</option>
                  <option value="Concert · Marine Drive Grounds">Concert · Marine Drive Grounds (18k pax)</option>
                  <option value="Lulu Mall Anniversary Sale · Edappally">Lulu Mall Sale · Edappally (50k pax)</option>
                  <option value="Cochin Carnival Parade · Fort Kochi">Cochin Carnival · Fort Kochi (42k pax)</option>
                  <option value="Marathon · MG Road stretch">Marathon · MG Road stretch (12k pax)</option>
                </select>
              </div>

              {/* Expected Attendance */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expected Attendance</label>
                  <span className="font-mono text-xs text-primary font-semibold">{evtAttendance.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="5000"
                  max="45000"
                  step="1000"
                  value={evtAttendance}
                  onChange={(e) => setEvtAttendance(Number(e.target.value))}
                  className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Date & Time */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date & Time</label>
                <div className="relative">
                  <input
                    type="text"
                    value={evtDateTime}
                    onChange={(e) => setEvtDateTime(e.target.value)}
                    className="w-full rounded-xl border border-border/45 bg-secondary/75 px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-primary transition-colors"
                  />
                  <Calendar className="absolute right-3.5 top-3 size-3.5 text-muted-foreground" />
                </div>
              </div>

              {/* Weather Forecast */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Weather Forecast</label>
                <div className="relative">
                  <select
                    value={evtWeather}
                    onChange={(e) => setEvtWeather(e.target.value)}
                    className="w-full rounded-xl border border-border/45 bg-secondary/75 px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-primary transition-colors"
                  >
                    <option value="Clear">☀️ Clear / Sunny</option>
                    <option value="Light rain">🌦️ Light rain / Showers</option>
                    <option value="Heavy rain">⛈️ Heavy rain / Monsoon</option>
                  </select>
                </div>
              </div>

              {/* Run Button */}
              <Button
                onClick={runEventSimulation}
                className="w-full gap-2 mt-2 py-5 rounded-xl text-xs font-semibold shadow-md shadow-primary/15 hover:-translate-y-0.5 transition-transform"
                disabled={simRunning}
              >
                {simRunning ? (
                  <>
                    <Sparkles className="size-4 animate-spin" /> Simulating impact...
                  </>
                ) : (
                  <>
                    <Play className="size-4 fill-current" /> Run Simulation
                  </>
                )}
              </Button>
            </GlassCard>

            {/* Results Display */}
            <div className="lg:col-span-2 space-y-4">
              {!simCompleted && !simRunning && (
                <div className="h-full rounded-3xl border border-dashed border-border/60 bg-card/45 flex flex-col items-center justify-center text-center p-8 min-h-[350px]">
                  <div className="size-14 rounded-2xl bg-secondary/80 border border-border/40 flex items-center justify-center text-muted-foreground mb-4">
                    <Calendar className="size-6" />
                  </div>
                  <h3 className="font-display text-base font-bold text-foreground">Configure and run a simulation</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
                    Set the event details on the left, then run the simulation to see predicted congestion and the recommended response plan.
                  </p>
                </div>
              )}

              {simRunning && (
                <div className="h-full rounded-3xl border border-border/40 bg-card/60 flex flex-col items-center justify-center text-center p-8 min-h-[350px]">
                  <div className="size-12 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                  <p className="text-xs font-mono text-muted-foreground animate-pulse">
                    Sentinel Engine: Analyzing transit load & crowd vectors...
                  </p>
                </div>
              )}

              {simCompleted && !simRunning && (
                <div className="space-y-4 animate-rise">
                  {/* KPI Grid */}
                  <div className="grid grid-2 sm:grid-cols-4 gap-4">
                    <KPIComponent
                      label="Congestion increase"
                      value={`+${congestionIncrease}%`}
                      color="text-destructive font-bold"
                    />
                    <KPIComponent
                      label="Extra buses suggested"
                      value={extraBuses.toString()}
                      color="text-primary font-bold"
                    />
                    <KPIComponent
                      label="Police deployment"
                      value={`${policeOfficers} officers`}
                      color="text-foreground"
                    />
                    <KPIComponent
                      label="Metro frequency"
                      value={metroFrequency}
                      color="text-success font-bold"
                    />
                  </div>

                  {/* Chart Card */}
                  <GlassCard className="p-5">
                    <SectionHeader title={`Predicted congestion curve — ${evtName}`} />
                    <SimulatedBarChart data={barChartData} />
                  </GlassCard>

                  {/* Affected Corridors Card */}
                  <GlassCard className="p-5 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-border/40">
                      <h3 className="font-display text-sm font-semibold tracking-tight">Affected Corridors</h3>
                      <span className="text-[10px] text-muted-foreground font-mono">predicted congestion</span>
                    </div>

                    <div className="space-y-1.5">
                      <CorridorRow
                        name={evtName.includes("Stadium") ? "Jawaharlal Nehru Stadium - Kaloor stretch" : evtName.includes("Grounds") ? "Marine Drive walkway - High Court road" : evtName.includes("Lulu") ? "Edappally Junction - NH Bypass" : "MG Road Metro stretch"}
                        val={`+${congestionIncrease}%`}
                        badgeClass="bg-destructive/15 text-destructive"
                      />
                      <CorridorRow
                        name="Palarivattom flyover approach"
                        val={`+${Math.round(congestionIncrease * 0.72)}%`}
                        badgeClass="bg-warn/15 text-warn"
                      />
                      <CorridorRow
                        name="Vytilla hub merge"
                        val={`+${Math.round(congestionIncrease * 0.48)}%`}
                        badgeClass="bg-warn/15 text-warn"
                      />
                    </div>

                    <div className="pt-2">
                      <Button
                        onClick={() => toast.success(`Response plan dispatched to Kochi Metro, KSRTC, and Traffic Police Command.`)}
                        className="w-full gap-2 rounded-xl text-xs py-5"
                      >
                        <Send className="size-3.5" /> Send Response Plan
                      </Button>
                    </div>
                  </GlassCard>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ORIGINAL WHAT-IF AGENT SIMULATION */}
        {activeTab === "whatif" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <GlassCard className="lg:col-span-1">
              <SectionHeader title="Scenario" />
              <div className="grid grid-cols-2 gap-2">
                {simulationScenarios.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedScenario(s.id)}
                    className={cn(
                      "rounded-2xl border p-3 text-left text-xs transition-colors",
                      selectedScenario === s.id ? "border-primary bg-accent" : "border-border bg-card hover:bg-secondary",
                    )}
                  >
                    <p className="font-medium">{s.label}</p>
                    <p className="text-[10px] text-muted-foreground">{s.where}</p>
                  </button>
                ))}
              </div>

              <Button onClick={runWhatifSimulation} className="mt-4 w-full gap-2" disabled={whatifRunning}>
                {whatifRunning ? (
                  <>
                    <Sparkles className="size-4 animate-pulse-soft" /> Simulating…
                  </>
                ) : (
                  <>
                    <Play className="size-4" /> Run simulation
                  </>
                )}
              </Button>
            </GlassCard>

            <GlassCard className="lg:col-span-2">
              <SectionHeader title="Multi-agent reasoning" hint={whatifRunning || whatifRan ? simulationResult.scenario : "Choose a scenario and run"} />
              {(whatifRunning || whatifRan) && <AgentReasoningStream scenarioId="flood" key={whatifRunning ? "r" : "d"} />}
              {!whatifRunning && !whatifRan && (
                <div className="h-full rounded-3xl border border-dashed border-border p-6 flex flex-col items-center justify-center text-center text-sm text-muted-foreground min-h-[250px]">
                  <MessageSquare className="size-6 text-muted-foreground mb-2" />
                  <span>Idle — Sentinel is standing by. Choose a scenario and run.</span>
                </div>
              )}
            </GlassCard>

            {whatifRan && !whatifRunning && (
              <div className="col-span-full grid gap-4 md:grid-cols-2 lg:grid-cols-3 animate-rise">
                <ImpactCard title="Traffic impact" main={simulationResult.traffic.impact} note={simulationResult.traffic.note} tone="text-warn" />
                <ImpactCard title="Emergency delay" main={simulationResult.emergency.impact} note={simulationResult.emergency.note} tone="text-destructive" />
                <ImpactCard title="Metro impact" main={simulationResult.metro.impact} note={simulationResult.metro.note} tone="text-primary" />
                <ImpactCard title="Police requirement" main={simulationResult.police.impact} note={simulationResult.police.note} tone="text-foreground" />
                <ImpactCard title="Road closures" main={simulationResult.closure.impact} note={simulationResult.closure.note} tone="text-foreground" />
                <ImpactCard title="Est. clearance" main={simulationResult.clearance} note="With Sentinel's plan" tone="text-success" />
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

// KPI Component helper
function KPIComponent({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <GlassCard className="p-4 flex flex-col justify-between">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground leading-tight">{label}</p>
      <p className={cn("mt-2 font-mono text-lg font-bold tracking-tight", color)}>{value}</p>
    </GlassCard>
  );
}

// Corridor list row helper
function CorridorRow({ name, val, badgeClass }: { name: string; val: string; badgeClass: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
      <div className="flex items-center gap-2.5">
        <MapPin className="size-3.5 text-muted-foreground" />
        <span className="text-xs text-foreground/90 font-medium">{name}</span>
      </div>
      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-mono font-bold leading-none uppercase", badgeClass)}>
        {val}
      </span>
    </div>
  );
}

// Simulated Bar Chart component helper
function SimulatedBarChart({ data }: { data: [string, number][] }) {
  const max = Math.max(...data.map(d => d[1]), 100);
  return (
    <div className="flex items-end justify-between gap-4 h-[150px] pt-4 px-2 select-none">
      {data.map(([label, value], i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
          <span className="font-mono text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
            {value}%
          </span>
          <div 
            style={{ height: `${Math.max(6, (value / max) * 90)}px` }}
            className="w-full bg-gradient-to-t from-primary/60 to-primary rounded-t-lg transition-all duration-700 ease-out shadow-lg shadow-primary/10 group-hover:from-primary group-hover:to-cyan-400"
          />
          <span className="text-[10px] text-muted-foreground text-center font-medium truncate w-full">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ImpactCard component helper (original)
function ImpactCard({ title, main, note, tone }: { title: string; main: string; note: string; tone: string }) {
  return (
    <GlassCard>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
      <p className={cn("mt-2 font-display text-3xl font-semibold", tone)}>{main}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </GlassCard>
  );
}

