import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { GlassCard, SectionHeader } from "@/components/ui-kit";
import { useSentinelStore } from "@/lib/store";
import { Ambulance, Shield, Flame, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { CityMap } from "@/components/city-map";

export const Route = createFileRoute("/routing")({
  head: () => ({
    meta: [
      { title: "Emergency Routing · Kochi | Project Sentinel" },
      { name: "description", content: "AI-optimized emergency routing for ambulance, police and fire units across Kochi." },
      { property: "og:title", content: "Emergency Routing · Kochi" },
      { property: "og:description", content: "Fastest routes, green corridors and signal priority for Kochi's emergency fleet." },
    ],
  }),
  component: RoutingPage,
});

export const kochiLocations = [
  { name: "Ernakulam Medical Trust (EMT)", lng: 76.2941, lat: 9.9622 },
  { name: "Aster Medcity", lng: 76.2736, lat: 10.0267 },
  { name: "Amrita Hospital", lng: 76.2925, lat: 10.0332 },
  { name: "Vyttila Junction", lng: 76.3218, lat: 9.9678 },
  { name: "Kundannoor Junction", lng: 76.3116, lat: 9.9366 },
  { name: "Edappally", lng: 76.3090, lat: 10.0250 },
  { name: "Kakkanad", lng: 76.3533, lat: 10.0159 },
  { name: "Marine Drive", lng: 76.2735, lat: 9.9800 },
  { name: "MG Road", lng: 76.2828, lat: 9.9722 },
  { name: "Palarivattom", lng: 76.3120, lat: 10.0076 }
];

const vehicles = [
  { id: "amb", label: "Ambulance", Icon: Ambulance },
  { id: "pol", label: "Police", Icon: Shield },
  { id: "fire", label: "Fire", Icon: Flame },
];

function RoutingPage() {
  const [vehicle, setVehicle] = useState("amb");
  const { greenCorridorActive, setGreenCorridorActive } = useSentinelStore();

  // Set default route locations based on selected vehicle
  const [startName, setStartName] = useState("Ernakulam Medical Trust (EMT)");
  const [endName, setEndName] = useState("Kundannoor Junction");

  useEffect(() => {
    if (vehicle === "amb") {
      setStartName("Ernakulam Medical Trust (EMT)");
      setEndName("Kundannoor Junction");
    } else if (vehicle === "pol") {
      setStartName("Vyttila Junction");
      setEndName("Edappally");
    } else {
      setStartName("Palarivattom");
      setEndName("Kakkanad");
    }
  }, [vehicle]);

  const startLoc = kochiLocations.find((l) => l.name === startName) || kochiLocations[0];
  const endLoc = kochiLocations.find((l) => l.name === endName) || kochiLocations[1];

  // Simulated metrics when OSRM geometry is calculating or as immediate visual fallback
  const [liveMetrics, setLiveMetrics] = useState({ distance: "0 km", eta: "0 min", saved: "0 min" });

  useEffect(() => {
    const fetchLiveMetrics = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${startLoc.lng},${startLoc.lat};${endLoc.lng},${endLoc.lat}?overview=false`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const dist = (route.distance / 1000).toFixed(1);
          const baseDuration = Math.round(route.duration / 60);
          const finalDuration = greenCorridorActive ? Math.round(baseDuration * 0.7) : baseDuration;
          const savedDuration = greenCorridorActive ? Math.round(baseDuration * 0.3) : 0;
          
          setLiveMetrics({
            distance: `${dist} km`,
            eta: `${finalDuration} min`,
            saved: `${savedDuration} min`,
          });
        }
      } catch {
        // Fallback calculations in case of network issues
        setLiveMetrics({
          distance: "4.8 km",
          eta: greenCorridorActive ? "7 min" : "10 min",
          saved: greenCorridorActive ? "3 min" : "0 min",
        });
      }
    };
    fetchLiveMetrics();
  }, [startLoc, endLoc, greenCorridorActive]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Respond · 03.b</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Emergency Routing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fastest routes with green corridor and signal priority. Sentinel optimizes across live traffic.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <GlassCard className="lg:col-span-1">
            <SectionHeader title="Vehicle" />
            <div className="grid grid-cols-3 gap-2">
              {vehicles.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVehicle(v.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border p-3 transition-colors cursor-pointer",
                    vehicle === v.id ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card hover:bg-secondary",
                  )}
                >
                  <v.Icon className="size-5" />
                  <span className="text-xs font-medium">{v.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Origin (From)</label>
                <select
                  value={startName}
                  onChange={(e) => setStartName(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-border bg-background p-3 text-xs outline-none focus:border-primary"
                >
                  {kochiLocations.map((l) => (
                    <option key={l.name} value={l.name}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Destination (To)</label>
                <select
                  value={endName}
                  onChange={(e) => setEndName(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-border bg-background p-3 text-xs outline-none focus:border-primary"
                >
                  {kochiLocations.map((l) => (
                    <option key={l.name} value={l.name}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div 
                onClick={() => setGreenCorridorActive(!greenCorridorActive)}
                className={cn(
                  "rounded-2xl border p-4 cursor-pointer transition-all",
                  greenCorridorActive 
                    ? "border-success/30 bg-success/10 text-success" 
                    : "border-border bg-card text-muted-foreground hover:bg-secondary"
                )}
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                  <Zap className="size-3.5" />
                  Green Corridor: {greenCorridorActive ? "Active" : "Inactive"}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed">
                  Traffic signals are held along the path. Saves ~30% route duration time. Click to toggle.
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="lg:col-span-2 !p-0 overflow-hidden flex flex-col justify-between">
            <div className="relative flex-1 min-h-[400px]">
              <CityMap
                height="100%"
                routingMode={true}
                startLocation={startLoc}
                endLocation={endLoc}
                vehicleType={vehicle}
              />
            </div>
            <div className="grid grid-cols-3 divide-x divide-border border-t border-border bg-card">
              <Stat label="ETA" value={liveMetrics.eta} />
              <Stat label="Time saved" value={liveMetrics.saved} tone="text-success" />
              <Stat label="Distance" value={liveMetrics.distance} tone="text-primary" />
            </div>
          </GlassCard>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="p-4 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-lg font-bold ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}
