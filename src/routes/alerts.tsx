import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { GlassCard, SectionHeader, SeverityChip } from "@/components/ui-kit";
import { AgentReasoningStream } from "@/components/agent-reasoning-stream";
import { DecisionTimeline } from "@/components/decision-timeline";
import { ExplainabilityBars } from "@/components/explainability-bars";
import { alerts } from "@/data/kochi";
import { useState } from "react";
import { Siren, ArrowRight, Shield, Ambulance, Flame, Radio, Building2, UserCheck, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";
import { createAssignmentServerFn, dispatchRealtime } from "@/lib/dispatch";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "AI Alerts · Kochi | Project Sentinel" },
      { name: "description", content: "Prioritized AI alerts across Kochi with recommended actions, timelines and dispatch." },
      { property: "og:title", content: "AI Alerts · Kochi" },
      { property: "og:description", content: "Prioritized AI alerts and recommended actions for Kochi." },
    ],
  }),
  component: AlertsPage,
});

interface AssignmentDetails {
  station: string;
  stationLocation: string;
  radioChannel: string;
  policeCount: number;
  policeStation: string;
  policeOfficers: string[];
  ambulanceCount: number;
  ambulanceUnit: string;
  hospital: string;
  paramedics: string[];
  fireCount: number;
  fireUnit: string;
  fireStation: string;
  eta: string;
}

const defaultAssignment: AssignmentDetails = {
  station: "Panangad & Ernakulam Traffic Police Base",
  stationLocation: "SA Road, Kundannoor Jn, Kochi",
  radioChannel: "Ch-4 (156.800 MHz)",
  policeCount: 4,
  policeStation: "Panangad Police Station",
  policeOfficers: ["Inspector Rajesh Kumar (Lead)", "SI Anjali Nair", "Constable V. Manu", "Constable S. Arun"],
  ambulanceCount: 1,
  ambulanceUnit: "ALS Ambulance K-14 (KL-07-CC-4821)",
  hospital: "Medical Trust Hospital, Ernakulam",
  paramedics: ["Dr. Neetha V. (EMT Lead)", "Paramedic Suresh Pillai"],
  fireCount: 1,
  fireUnit: "Rescue Tender F-1",
  fireStation: "Gandhinagar Fire Station",
  eta: "4 mins (Green Corridor Active)",
};

const assignmentDataMap: Record<string, AssignmentDetails> = {
  "A-701": defaultAssignment,
  "A-702": {
    station: "Edappally Traffic Control & Fire Command",
    stationLocation: "NH-66 Bypass, Edappally, Kochi",
    radioChannel: "Ch-2 (154.200 MHz)",
    policeCount: 6,
    policeStation: "Edappally Police Station",
    policeOfficers: ["CI Thomas Joseph (Lead)", "SI Harikrishnan", "Constable K. Bijoy", "Constable P. Deepu", "Constable R. Shammi", "Constable T. Vinod"],
    ambulanceCount: 2,
    ambulanceUnit: "Ambulance A-09 & Trauma Rig A-12",
    hospital: "Aster Medcity & Amrita Hospital",
    paramedics: ["Dr. Arvind Swamy", "Paramedic Jatin Das", "Paramedic Priya R."],
    fireCount: 2,
    fireUnit: "Heavy Crane F-3 & Fire Tender F-5",
    fireStation: "Eloor & Gandhinagar Fire Command",
    eta: "6 mins (Lanes 2-3 Closed)",
  },
  "A-703": {
    station: "Marine Drive Municipal Response Base",
    stationLocation: "Shanmugham Road, Marine Drive, Kochi",
    radioChannel: "Ch-7 (162.400 MHz)",
    policeCount: 3,
    policeStation: "Central Police Station, Ernakulam",
    policeOfficers: ["SI Mathew Varghese (Lead)", "Constable A. Sanooj", "Constable M. Dileep"],
    ambulanceCount: 1,
    ambulanceUnit: "Standby Ambulance M-02",
    hospital: "General Hospital, Ernakulam",
    paramedics: ["Paramedic Gokul K.", "Nurse Sunitha P."],
    fireCount: 1,
    fireUnit: "High-Capacity Dewatering Pump Unit P-4",
    fireStation: "High Court Road Fire Station",
    eta: "8 mins (Pre-positioned Pumps)",
  },
  "A-704": {
    station: "Kochi Metro Operations Command (KMRL)",
    stationLocation: "MG Road Metro Station, Kochi",
    radioChannel: "Ch-9 (168.100 MHz)",
    policeCount: 4,
    policeStation: "Metro Police Station, Kalamassery",
    policeOfficers: ["SI Shaji P. (Lead)", "Constable B. Nikhil", "Metro Guard K. Salim", "Metro Guard R. Varun"],
    ambulanceCount: 1,
    ambulanceUnit: "First Response Med-Cart M-1",
    hospital: "Lisie Hospital, Kaloor",
    paramedics: ["EMT Officer Divya N."],
    fireCount: 0,
    fireUnit: "None Required",
    fireStation: "Kaloor Fire Station (Standby)",
    eta: "2 mins (Station Security Active)",
  },
};

function AlertsPage() {
  const [selectedId, setSelectedId] = useState(alerts[0].id);
  const selected = alerts.find((a) => a.id === selectedId)!;

  // Assign Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [isAssigned, setIsAssigned] = useState(false);

  const assignInfo = assignmentDataMap[selected.id] || defaultAssignment;

  const handleConfirmAssignment = () => {
    setIsAssigned(true);
    toast.success(`Units Assigned to ${selected.title}`, {
      description: `${assignInfo.policeCount} Police Officers, ${assignInfo.ambulanceCount} Ambulance & ${assignInfo.fireCount} Fire Unit dispatched from ${assignInfo.policeStation}.`,
    });
    setAssignModalOpen(false);

    // Persist to Unified Dispatch Engine
    createAssignmentServerFn({
      data: {
        title: `Dispatch for ${selected.title}`,
        description: `Operational dispatch confirmed for ${selected.title} at ${selected.location}. Station: ${assignInfo.policeStation}. Personnel: ${assignInfo.policeOfficers.join(', ')}. Medical: ${assignInfo.ambulanceUnit}.`,
        category: selected.department.toLowerCase().includes('ambulance') || selected.department.toLowerCase().includes('emergency') ? 'medical' : selected.department.toLowerCase().includes('fire') ? 'fire' : 'police',
        assignment_type: selected.department.toLowerCase().includes('ambulance') ? 'ambulance_dispatch' : 'accident_scene_security',
        priority: selected.severity === 'critical' ? 'critical' : selected.severity === 'warning' ? 'high' : 'normal',
        incident_id: selected.id,
        location_name: selected.location,
        department_id: selected.department,
        assigned_unit_name: assignInfo.ambulanceUnit || assignInfo.policeStation,
        requires_approval: false,
        target_response_sec: 480,
        source: 'human',
      },
    })
      .then((created: any) => {
        dispatchRealtime.broadcast('assignment.created', created.id);
      })
      .catch((e) => console.warn('Dispatch save note:', e));
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Respond · 03</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">AI Alerts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {alerts.filter((a) => a.severity === "critical").length} critical · {alerts.length} total · sorted by priority
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          <GlassCard className="lg:col-span-2">
            <SectionHeader title="Alert queue" />
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => {
                      setSelectedId(a.id);
                      setIsAssigned(false);
                    }}
                    className={`w-full rounded-2xl border p-3 text-left transition-colors cursor-pointer ${a.id === selectedId ? "border-primary bg-accent" : "border-border hover:bg-secondary/60"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-bold">
                          {a.priority}
                        </span>
                        <p className="text-sm font-medium">{a.title}</p>
                      </div>
                      <SeverityChip severity={a.severity} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.location} · {a.confidence}% · {a.minutesAgo}m ago
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </GlassCard>

          <div className="space-y-4 lg:col-span-3">
            <GlassCard>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-bold">
                      {selected.priority}
                    </span>
                    <SeverityChip severity={selected.severity} />
                    <span className="text-[11px] text-muted-foreground">
                      {selected.confidence}% confidence
                    </span>
                    {isAssigned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-medium text-success">
                        <CheckCircle2 className="size-3" />
                        Assigned
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 font-display text-xl font-semibold">{selected.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {selected.location} · {selected.department}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAssignModalOpen(true)}
                    className="gap-1.5 cursor-pointer"
                  >
                    <UserCheck className="size-3.5" />
                    Assign Units
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 cursor-pointer bg-primary text-primary-foreground"
                    onClick={() => {
                      handleConfirmAssignment();
                    }}
                  >
                    <Siren className="size-3.5" />
                    Dispatch
                  </Button>
                  <Link
                    to="/dispatch"
                    className="inline-flex items-center gap-1 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                  >
                    <span>Unified Dispatch Board →</span>
                  </Link>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-accent p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-accent-foreground">
                  Recommended action
                </p>
                <p className="mt-1 text-sm text-foreground">{selected.recommendation}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-primary">
                  Explain reasoning <ArrowRight className="size-3" />
                </div>
              </div>
            </GlassCard>

            <GlassCard>
              <SectionHeader title="Multi-agent reasoning" />
              <AgentReasoningStream scenarioId={selected.severity === "warning" && selected.title.toLowerCase().includes("flood") ? "flood" : "default"} />
            </GlassCard>

            <GlassCard>
              <SectionHeader title="AI decision timeline" />
              <DecisionTimeline activeStep={selected.severity === "resolved" ? 8 : 5} />
            </GlassCard>

            <GlassCard>
              <ExplainabilityBars title={`Why · ${selected.title}`} />
            </GlassCard>
          </div>
        </div>
      </div>

      {/* ASSIGN UNITS & PERSONNEL DIALOG MODAL */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="max-w-xl rounded-2xl border-border bg-card p-6 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs font-bold">{selected.priority}</span>
              <SeverityChip severity={selected.severity} />
            </div>
            <DialogTitle className="text-xl font-display font-semibold mt-1">
              Unit & Personnel Assignment
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Review and confirm the allocated personnel, stations, and vehicles for {selected.title} ({selected.location}).
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-4 text-sm">
            {/* Command Base & Station */}
            <div className="rounded-xl border border-border bg-secondary/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                <span className="flex items-center gap-1.5">
                  <Building2 className="size-4 text-primary" />
                  {assignInfo.station}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground font-mono">
                  <Radio className="size-3 text-emerald-500 animate-pulse" />
                  {assignInfo.radioChannel}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{assignInfo.stationLocation}</p>
              <div className="flex items-center gap-2 text-xs text-success pt-1">
                <Clock className="size-3.5" />
                <span>Estimated Response Time: <b>{assignInfo.eta}</b></span>
              </div>
            </div>

            {/* 1. Police Deployment */}
            <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold text-foreground text-xs uppercase tracking-wider">
                  <Shield className="size-4 text-blue-500" />
                  Police Patrol Force ({assignInfo.policeCount} Officers)
                </span>
                <span className="text-xs text-muted-foreground font-medium">{assignInfo.policeStation}</span>
              </div>
              <ul className="grid grid-cols-2 gap-1.5 pt-1 text-xs">
                {assignInfo.policeOfficers.map((off, idx) => (
                  <li key={idx} className="flex items-center gap-2 rounded-lg bg-secondary/60 px-2.5 py-1 text-foreground">
                    <span className="size-1.5 rounded-full bg-blue-500"></span>
                    <span>{off}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 2. Ambulance & Hospital */}
            <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold text-foreground text-xs uppercase tracking-wider">
                  <Ambulance className="size-4 text-emerald-500" />
                  Medical Response ({assignInfo.ambulanceCount} Unit)
                </span>
                <span className="text-xs text-emerald-500 font-medium">{assignInfo.hospital}</span>
              </div>
              <p className="text-xs text-foreground font-medium">Vehicle: {assignInfo.ambulanceUnit}</p>
              <div className="flex flex-wrap gap-2 text-xs pt-1">
                {assignInfo.paramedics.map((p, idx) => (
                  <span key={idx} className="rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 text-xs font-medium">
                    🩺 {p}
                  </span>
                ))}
              </div>
            </div>

            {/* 3. Fire & Rescue (if applicable) */}
            {assignInfo.fireCount > 0 && (
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-semibold text-foreground text-xs uppercase tracking-wider">
                    <Flame className="size-4 text-rose-500" />
                    Fire & Rescue Unit ({assignInfo.fireCount} Tender)
                  </span>
                  <span className="text-xs text-muted-foreground">{assignInfo.fireStation}</span>
                </div>
                <p className="text-xs text-foreground font-medium">Deployment: {assignInfo.fireUnit}</p>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" size="sm" onClick={() => setAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirmAssignment} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
              <CheckCircle2 className="size-4" />
              Confirm & Dispatch Assignment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
