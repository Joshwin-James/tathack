import { createFileRoute, Link } from "@tanstack/react-router";
import { useSentinelStore } from "@/lib/store";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  AlertTriangle,
  MapPin,
  User,
  Settings,
  Plus,
  Send,
  Sparkles,
  ShieldCheck,
  CloudRain,
  Phone,
  Compass,
  X,
  UploadCloud,
  CheckCircle,
  CheckCircle2,
  Check,
  Shield,
  ChevronRight,
  Laptop,
  Camera,
  Mic,
  MicOff,
  RefreshCw,
  Layers,
  Radio,
  Globe,
  Loader2,
  Trash2,
  Flame,
  Zap,
  Volume2,
  VolumeX,
  BellRing,
  Car,
  ArrowLeft,
  Ambulance,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CityMap } from "@/components/city-map";
import { apiConfig } from "@/config/api";
import { generateGeminiResponse } from "@/lib/gemini";
import { replyFor, type Incident, type Report } from "@/data/kochi";
import { Button } from "@/components/ui/button";
import { triageReport, type TriageResult } from "@/lib/triage";
import { useMission, sirenAudio } from "@/lib/mission";
import { toast } from "sonner";
import { createAssignmentServerFn, dispatchRealtime } from "@/lib/dispatch";

export const Route = createFileRoute("/citizen")({
  head: () => ({
    meta: [
      { title: "Citizen Portal · Kochi | CityTwin AI" },
      { name: "description", content: "Kochi digital twin citizen portal. Report incidents with AI speech and vision triage, track active civic hazards, and view live city digital twin." },
    ],
  }),
  component: CitizenPortalPage,
});

type Tab = "home" | "report" | "map" | "alerts" | "reports" | "assistant" | "profile" | "settings";

function CitizenPortalPage() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [showSosModal, setShowSosModal] = useState(false);
  const [currentGps, setCurrentGps] = useState<{ lat: number; lng: number } | null>(null);

  // Shared Emergency Mission Layer
  const { mission, registerCitizenPresence } = useMission();
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [dismissedJunctions, setDismissedJunctions] = useState<string[]>([]);
  const [isDemoAlert, setIsDemoAlert] = useState(false);
  const [passedBanner, setPassedBanner] = useState<{ junction: string; show: boolean }>({
    junction: "",
    show: false,
  });

  const { triggerSOS, incidents } = useSentinelStore();

  // Fetch current GPS location on mount
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentGps({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          console.warn("GPS access denied or unavailable:", err.message);
          // Fallback to Kochi Center
          setCurrentGps({ lat: 9.9822, lng: 76.3116 });
        }
      );
    }
  }, []);

  const handleTriggerSOS = (type: "police" | "ambulance" | "fire" | "disaster") => {
    if (currentGps) {
      triggerSOS(type, currentGps);
      setShowSosModal(false);
      toast.error(`🚨 SOS ALERT SENT: Dispatched nearest ${type.toUpperCase()} unit to your location!`);
    } else {
      toast.warning("GPS location loading... Please try again in a moment.");
    }
  };

  // Toggle citizen emergency alerts (unlocks WebAudio context & requests notification permission)
  const handleToggleAlerts = () => {
    if (!alertsEnabled) {
      sirenAudio.unlock();
      registerCitizenPresence(true);
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
      setAlertsEnabled(true);
      toast.success("🚨 Emergency Alerts Enabled! Audio unlocked for emergency corridor siren.");
    } else {
      registerCitizenPresence(false);
      sirenAudio.stop();
      setAlertsEnabled(false);
      setIsDemoAlert(false);
      toast.info("Emergency corridor alerts disabled.");
    }
  };

  const isApproachingActive =
    (alertsEnabled &&
      mission.status === "enroute" &&
      mission.distanceToNextJunctionM <= 500 &&
      mission.distanceToNextJunctionM > 0 &&
      !dismissedJunctions.includes(mission.nextJunction)) ||
    isDemoAlert;

  // Handle WebAudio Two-Tone Siren & Mobile Vibration Loop
  useEffect(() => {
    let vibInterval: any = null;

    if (isApproachingActive) {
      sirenAudio.start();
      sirenAudio.setMuted(isMuted);

      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([400, 200, 400]);
        vibInterval = setInterval(() => {
          navigator.vibrate([400, 200, 400]);
        }, 2600);
      }
    } else {
      sirenAudio.stop();
      if (vibInterval) clearInterval(vibInterval);
    }

    return () => {
      sirenAudio.stop();
      if (vibInterval) clearInterval(vibInterval);
    };
  }, [isApproachingActive, isMuted]);

  // Handle auto-dismissal when ambulance passes junction
  useEffect(() => {
    if (
      alertsEnabled &&
      mission.status === "enroute" &&
      mission.distanceToNextJunctionM <= 0 &&
      mission.nextJunction &&
      !dismissedJunctions.includes(mission.nextJunction)
    ) {
      setDismissedJunctions((prev) => [...prev, mission.nextJunction]);
      setPassedBanner({ junction: mission.nextJunction, show: true });
      setTimeout(() => {
        setPassedBanner((prev) => ({ ...prev, show: false }));
      }, 5000);
    }
  }, [mission.distanceToNextJunctionM, mission.nextJunction, alertsEnabled, dismissedJunctions]);

  return (
    <div className="min-h-screen bg-[#f9f8f6] text-slate-800 font-sans selection:bg-primary selection:text-primary-foreground flex flex-col">
      {/* Header Bar */}
      <header className="sticky top-0 w-full py-3.5 px-4 md:px-8 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl flex justify-between items-center z-45 shrink-0 shadow-xs">
        <div className="flex items-center gap-6 lg:gap-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/25">
              <span className="font-display font-bold text-sm">C</span>
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900 leading-none">Kochi Citizen</h1>
              <p className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">CityTwin AI Portal</p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-semibold text-slate-500">
            <button 
              onClick={() => setActiveTab("home")} 
              className={cn("px-3 py-1.5 rounded-xl transition-all hover:text-slate-900 cursor-pointer", activeTab === "home" && "bg-slate-100 text-slate-900")}
            >
              Home
            </button>
            <button 
              onClick={() => setActiveTab("report")} 
              className={cn("px-3 py-1.5 rounded-xl transition-all hover:text-slate-900 cursor-pointer flex items-center gap-1.5", activeTab === "report" && "bg-primary text-white shadow-xs")}
            >
              <Sparkles className="size-3.5" />
              AI Report
            </button>
            <button 
              onClick={() => setActiveTab("map")} 
              className={cn("px-3 py-1.5 rounded-xl transition-all hover:text-slate-900 cursor-pointer", activeTab === "map" && "bg-slate-100 text-slate-900")}
            >
              Live Map
            </button>
            <button 
              onClick={() => setActiveTab("alerts")} 
              className={cn("px-3 py-1.5 rounded-xl transition-all hover:text-slate-900 cursor-pointer", activeTab === "alerts" && "bg-slate-100 text-slate-900")}
            >
              Alerts
            </button>
            <button 
              onClick={() => setActiveTab("reports")} 
              className={cn("px-3 py-1.5 rounded-xl transition-all hover:text-slate-900 cursor-pointer", activeTab === "reports" && "bg-slate-100 text-slate-900")}
            >
              My Reports
            </button>
            <button 
              onClick={() => setActiveTab("assistant")} 
              className={cn("px-3 py-1.5 rounded-xl transition-all hover:text-slate-900 cursor-pointer", activeTab === "assistant" && "bg-slate-100 text-slate-900")}
            >
              AI Copilot
            </button>
          </nav>
        </div>

        {/* Header Right Panel */}
        <div className="flex items-center gap-2">
          {/* Emergency Alert Audio Unlock Toggle Button */}
          <button
            onClick={handleToggleAlerts}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer shadow-xs flex items-center gap-1.5",
              alertsEnabled
                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/40"
                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
            )}
            title="Enable audio sirens and urgent emergency corridor alerts"
          >
            <span
              className={cn(
                "size-2 rounded-full",
                alertsEnabled ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              )}
            />
            <span>{alertsEnabled ? "Alerts ON" : "Enable Emergency Alerts"}</span>
          </button>

          {/* Test Alert Demo Button for Judges */}
          <button
            onClick={() => {
              sirenAudio.unlock();
              setIsDemoAlert(true);
            }}
            className="hidden sm:inline-flex px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/30 hover:bg-rose-500/20 transition-all cursor-pointer shadow-2xs items-center gap-1"
            title="Trigger test emergency alert and siren modal"
          >
            <BellRing className="size-3 text-rose-500" />
            <span>Test Alert (Demo)</span>
          </button>

          <Link
            to="/hospital"
            className="hidden lg:flex text-xs items-center gap-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1.5 hover:bg-rose-100 transition-all font-semibold shadow-2xs"
          >
            <Ambulance className="size-3.5 text-rose-600" />
            <span>Hospital ICU</span>
          </Link>

          <Link
            to="/"
            className="text-xs flex items-center gap-1.5 rounded-full bg-slate-900 text-white px-3.5 py-1.5 hover:bg-slate-800 transition-all font-semibold shadow-xs"
          >
            <Laptop className="size-3.5 text-slate-300" />
            <span className="hidden sm:inline">Command Center</span>
          </Link>
        </div>
      </header>

      {/* 500m - 1000m Ambient Warning Banner */}
      {alertsEnabled &&
        mission.status === "enroute" &&
        mission.distanceToNextJunctionM > 500 &&
        mission.distanceToNextJunctionM <= 1000 &&
        !isApproachingActive && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-900 px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <Ambulance className="size-4 text-amber-600 animate-pulse shrink-0" />
              <span>
                <strong>Emergency Vehicle En-Route:</strong> Ambulance {mission.distanceToNextJunctionM}m away, approaching {mission.nextJunction}.
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold bg-amber-500/20 px-2 py-0.5 rounded-full text-amber-700">
              APPROACHING CORRIDOR
            </span>
          </div>
        )}

      {/* Auto-Dismissed Passed Celebration Banner */}
      {passedBanner.show && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-md animate-in slide-in-from-top-2">
          <CheckCircle2 className="size-4" />
          <span>
            Ambulance has safely cleared {passedBanner.junction}. Thank you for giving way! (ആംബുലൻസ് കടന്നുപോയി, വഴി നൽകിയതിന് നന്ദി!)
          </span>
        </div>
      )}

      {/* Main Responsive Container */}
      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-8 py-6 pb-24 md:pb-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {activeTab === "home" && <HomeScreen setActiveTab={setActiveTab} currentGps={currentGps} />}
            {activeTab === "report" && <ReportIncidentScreen currentGps={currentGps} setActiveTab={setActiveTab} />}
            {activeTab === "map" && <LiveMapScreen />}
            {activeTab === "alerts" && <AlertsScreen />}
            {activeTab === "reports" && <MyReportsScreen />}
            {activeTab === "assistant" && <AiAssistantScreen />}
            {activeTab === "profile" && <ProfileScreen />}
            {activeTab === "settings" && <SettingsScreen />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating SOS Button */}
      <button
        onClick={() => setShowSosModal(true)}
        className="fixed bottom-20 md:bottom-6 right-6 z-40 size-13 rounded-full bg-destructive flex items-center justify-center text-white shadow-xl shadow-destructive/35 border-2 border-white/40 cursor-pointer animate-pulse-soft transition-transform hover:scale-105"
        title="Emergency SOS"
      >
        <span className="font-display font-bold text-xs uppercase tracking-wider">SOS</span>
      </button>

      {/* Mobile Bottom Tab Navigation */}
      <nav className="fixed md:hidden bottom-0 inset-x-0 h-16 bg-white border-t border-slate-200 flex justify-around items-center z-50 px-2 shrink-0 shadow-2xl">
        <TabButton tab="home" label="Home" Icon={Home} activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabButton tab="map" label="Map" Icon={MapPin} activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabButton tab="report" label="Report" Icon={Plus} activeTab={activeTab} setActiveTab={setActiveTab} isMiddle />
        <TabButton tab="alerts" label="Alerts" Icon={AlertTriangle} activeTab={activeTab} setActiveTab={setActiveTab} badge={incidents.filter(i => i.severity === 'critical').length} />
        <TabButton tab="reports" label="Reports" Icon={CheckCircle} activeTab={activeTab} setActiveTab={setActiveTab} />
      </nav>

      {/* SOS Modal */}
      {showSosModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-rise">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-destructive flex items-center gap-1.5">
                <AlertTriangle className="size-4 animate-bounce" />
                EMERGENCY SOS DISPATCH
              </h3>
              <button
                onClick={() => setShowSosModal(false)}
                className="size-7 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              CityTwin AI captures your exact GPS coordinates and broadcasts an emergency priority dispatch directly to the Kochi Command Center. Select your service:
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <SosButton label="Police" desc="Crime & safety" color="bg-blue-600/90 hover:bg-blue-600" onClick={() => handleTriggerSOS("police")} />
              <SosButton label="Ambulance" desc="Medical support" color="bg-emerald-600/90 hover:bg-emerald-600" onClick={() => handleTriggerSOS("ambulance")} />
              <SosButton label="Fire Force" desc="Fire & rescue" color="bg-orange-600/90 hover:bg-orange-600" onClick={() => handleTriggerSOS("fire")} />
              <SosButton label="Disaster Ops" desc="Flood & rescue" color="bg-red-600/90 hover:bg-red-600" onClick={() => handleTriggerSOS("disaster")} />
            </div>
          </div>
        </div>
      )}

      {/* Emergency Alert Modal for Approaching Ambulance */}
      <AnimatePresence>
        {isApproachingActive && (
          <CitizenEmergencyAlertModal
            distanceM={
              isDemoAlert && mission.status !== "enroute"
                ? 320
                : mission.distanceToNextJunctionM || 320
            }
            junctionName={
              isDemoAlert && mission.status !== "enroute"
                ? "Palarivattom Junction"
                : mission.nextJunction || "Upcoming Junction"
            }
            etaSeconds={
              isDemoAlert && mission.status !== "enroute"
                ? 14
                : mission.etaSeconds || 14
            }
            isMuted={isMuted}
            onToggleMute={() => {
              const nextMute = !isMuted;
              setIsMuted(nextMute);
              sirenAudio.setMuted(nextMute);
            }}
            onDismiss={() => {
              if (mission.nextJunction) {
                setDismissedJunctions((prev) => [...prev, mission.nextJunction]);
              }
              setIsDemoAlert(false);
              sirenAudio.stop();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ----------------- NAVIGATION SUB-COMPONENTS -----------------

function TabButton({
  tab,
  label,
  Icon,
  activeTab,
  setActiveTab,
  isMiddle = false,
  badge = 0
}: {
  tab: Tab;
  label: string;
  Icon: any;
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  isMiddle?: boolean;
  badge?: number;
}) {
  const active = activeTab === tab;
  return (
    <button
      onClick={() => setActiveTab(tab)}
      className={cn(
        "flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer relative",
        isMiddle ? "bg-primary text-white size-10 rounded-2xl mx-1 max-w-[40px] shadow-lg shadow-primary/25 hover:scale-105" : "text-slate-400 hover:text-slate-700"
      )}
    >
      {!isMiddle ? (
        <>
          <Icon className={cn("size-5", active ? "text-primary" : "text-slate-400")} />
          <span className={cn("text-[9px] mt-0.5 font-medium", active ? "text-primary font-bold" : "text-slate-400")}>{label}</span>
          {badge > 0 && (
            <span className="absolute top-0.5 right-3 bg-destructive text-white text-[8px] font-bold px-1 rounded-full">
              {badge}
            </span>
          )}
        </>
      ) : (
        <Icon className="size-5 text-white" />
      )}
    </button>
  );
}

function SosButton({ label, desc, color, onClick }: { label: string; desc: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-3 rounded-2xl text-left border border-slate-100/10 transition-all text-white flex flex-col justify-between h-20 shadow-sm cursor-pointer",
        color
      )}
    >
      <span className="font-semibold text-xs uppercase tracking-wider">{label}</span>
      <span className="text-[9px] text-white/80">{desc}</span>
    </button>
  );
}

// ============================================
// 1. HOME SCREEN
// ============================================
function HomeScreen({ setActiveTab, currentGps }: { setActiveTab: (t: Tab) => void; currentGps: any }) {
  const { incidents } = useSentinelStore();
  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const activeIncidents = incidents.filter((i) => i.severity !== "resolved");

  return (
    <div className="space-y-5 pb-6">
      {/* Welcome Header */}
      <div className="flex justify-between items-end pt-1 pb-3 border-b border-slate-200/60">
        <div>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{today} · Kochi, Kerala</p>
          <h2 className="text-2xl font-bold font-display tracking-tight text-slate-900">Hello, Resident</h2>
          <p className="text-xs text-slate-500 mt-0.5">Sentinel Digital Twin Citizen Hub is active with AI Triage.</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left Side: Stats and Gauges */}
        <div className="space-y-4 lg:col-span-1">
          {/* Safety Status */}
          <div className="rounded-3xl p-4 bg-emerald-50 flex items-center justify-between border border-emerald-200 text-emerald-800 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-emerald-100 flex items-center justify-center border border-emerald-200 text-emerald-600">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-800">Local Safety Status</h4>
                <p className="text-[9px] text-emerald-600 font-mono mt-0.5">
                  {currentGps ? `${currentGps.lat.toFixed(4)}° N, ${currentGps.lng.toFixed(4)}° E` : "Locating..."}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-200/60 px-3 py-1 text-[9px] font-bold text-emerald-700 uppercase tracking-widest">
              SAFE
            </span>
          </div>

          {/* Weather Widget */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-3xl p-3.5 border border-slate-200/60 flex items-center gap-2.5 shadow-xs">
              <CloudRain className="size-6 text-primary animate-pulse-soft shrink-0" />
              <div className="min-w-0">
                <span className="text-[9px] text-slate-400 block font-medium">Weather</span>
                <p className="text-xs font-bold text-slate-800 truncate">28°C · Rain</p>
              </div>
            </div>
            <div className="bg-white rounded-3xl p-3.5 border border-slate-200/60 flex items-center gap-2.5 shadow-xs">
              <Sparkles className="size-6 text-emerald-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[9px] text-slate-400 block font-medium">Air Quality</span>
                <p className="text-xs font-bold text-emerald-600 truncate">AQI 42 · Good</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <QuickActionCard
                title="AI Voice & Photo Report"
                desc="Malayalam speech triage"
                Icon={Sparkles}
                color="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
                onClick={() => setActiveTab("report")}
              />
              <QuickActionCard
                title="Live Twin Map"
                desc="Real-time 3D city map"
                Icon={Compass}
                color="border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-xs"
                onClick={() => setActiveTab("map")}
              />
            </div>
          </div>

          {/* Support Contacts */}
          <div className="rounded-3xl p-4 bg-red-50 border border-red-200">
            <h4 className="text-xs font-bold text-red-800 uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="size-3.5 animate-pulse-soft" />
              Emergency Support Hotlines
            </h4>
            <div className="mt-2.5 grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-700">
              <a href="tel:112" className="flex items-center gap-1.5 p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-all"><span className="text-red-600 font-mono">112</span> Police Help</a>
              <a href="tel:108" className="flex items-center gap-1.5 p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-all"><span className="text-emerald-600 font-mono">108</span> Ambulance</a>
            </div>
          </div>
        </div>

        {/* Right Side: Map & Feed */}
        <div className="space-y-4 lg:col-span-2">
          {/* Map Preview */}
          <div className="bg-white rounded-3xl border border-slate-200/60 p-4 space-y-2 shadow-xs">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Kochi Safety Twin</h3>
              <span className="text-[10px] text-primary hover:underline cursor-pointer font-semibold" onClick={() => setActiveTab("map")}>Open full screen →</span>
            </div>
            <div className="h-[280px] rounded-2xl overflow-hidden border border-slate-200">
              <CityMap height="100%" activeLayers={["traffic", "cctv", "buildings"]} />
            </div>
          </div>

          {/* Active Incidents */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest font-mono">Nearby Active Incidents</h3>
              <span className="text-[10px] text-slate-500 font-medium">Showing {activeIncidents.length} active</span>
            </div>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {activeIncidents.slice(0, 4).map((i) => (
                <li key={i.id} className="bg-white rounded-2xl p-3.5 border border-slate-200/60 flex items-center justify-between hover:bg-slate-50 transition-colors shadow-xs">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "size-2 rounded-full",
                      i.severity === "critical" ? "bg-destructive animate-pulse-soft" : i.severity === "warning" ? "bg-amber-500" : "bg-primary"
                    )} />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{i.title}</h4>
                      <p className="text-[9.5px] text-slate-500 mt-0.5 font-medium">{i.location} · {i.minutesAgo}m ago</p>
                    </div>
                  </div>
                  <span className="text-[9.5px] font-mono font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                    {i.confidence}%
                  </span>
                </li>
              ))}
              {activeIncidents.length === 0 && (
                <p className="col-span-2 text-xs text-slate-400 text-center py-6">All clear. No active incidents nearby.</p>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({
  title,
  desc,
  Icon,
  color,
  onClick
}: {
  title: string;
  desc: string;
  Icon: any;
  color: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 rounded-2xl border cursor-pointer hover:-translate-y-0.5 transition-transform shadow-xs",
        color
      )}
    >
      <Icon className="size-5 mb-1.5 animate-pulse-soft" />
      <h4 className="text-xs font-bold text-slate-800">{title}</h4>
      <p className="text-[9px] text-slate-400 mt-0.5">{desc}</p>
    </div>
  );
}

// ============================================
// 2. AI-ASSISTED CITIZEN REPORTING SCREEN
// ============================================
function ReportIncidentScreen({
  currentGps,
  setActiveTab
}: {
  currentGps: { lat: number; lng: number } | null;
  setActiveTab: (t: Tab) => void;
}) {
  const { addCitizenReport } = useSentinelStore();

  // Input States
  const [textInput, setTextInput] = useState("");
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);
  const [photoMimeType, setPhotoMimeType] = useState<string | null>(null);
  const [manualLocation, setManualLocation] = useState("");
  const [selectedLat, setSelectedLat] = useState<number>(currentGps?.lat || 9.9822);
  const [selectedLng, setSelectedLng] = useState<number>(currentGps?.lng || 76.3116);

  // Voice Web Speech API State
  const [isListening, setIsListening] = useState(false);
  const [speechLanguage, setSpeechLanguage] = useState<"ml-IN" | "en-IN">("ml-IN");
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  // AI Triage State
  const [isTriaging, setIsTriaging] = useState(false);
  const [triagedData, setTriagedData] = useState<TriageResult | null>(null);
  const [editedFields, setEditedFields] = useState<TriageResult | null>(null);

  // Submitted Ticket Tracking State
  const [submittedTicket, setSubmittedTicket] = useState<{
    id: string;
    title: string;
    department: string;
    status: "received" | "verified" | "assigned" | "resolved";
    timestamp: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync GPS updates
  useEffect(() => {
    if (currentGps) {
      setSelectedLat(currentGps.lat);
      setSelectedLng(currentGps.lng);
    }
  }, [currentGps]);

  // Example Prompt Chips
  const EXAMPLE_CHIPS = [
    { label: "ഇവിടെ വെള്ളം കെട്ടി നിൽക്കുന്നു", desc: "Waterlogging (Malayalam)", text: "ഇവിടെ റോഡിൽ വലിയ വെള്ളക്കെട്ട് ഉണ്ടായിരിക്കുന്നു. വാഹനങ്ങൾക്ക് പോകാൻ സാധിക്കുന്നില്ല." },
    { label: "റോഡിൽ വലിയ കുഴി", desc: "Pothole (Malayalam)", text: "മെയിൻ റോഡിൽ വലിയ കുഴിയുണ്ട്. ഇരുചക്ര വാഹനങ്ങൾ അപകടത്തിൽ പെടാൻ സാധ്യതയുണ്ട്." },
    { label: "street light work cheyyunnilla", desc: "Streetlight (Manglish)", text: "Street light work cheyyunnilla. Night time full dark aanu, please fix it soon." },
    { label: "Current poyi line potti", desc: "Power Outage (Manglish)", text: "Current poyi, electric post nte wire potti kidakkunnu. Very dangerous." },
    { label: "Kundannoor traffic accident", desc: "Accident (English)", text: "Major car accident near Kundannoor flyover. Traffic is heavily blocked, need urgent ambulance and police." },
  ];

  // 1. Web Speech API Voice Recognition (ml-IN with fallback)
  const startListening = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Web Speech API is not supported in this browser. Please type your message.");
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechLanguage;

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript("");
        toast.info(`Listening in ${speechLanguage === "ml-IN" ? "Malayalam (ml-IN)" : "English (en-IN)"}... Speak now.`);
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) {
          setInterimTranscript(interim);
        }

        if (final) {
          setTextInput((prev) => (prev ? `${prev} ${final}` : final));
          setInterimTranscript("");
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "language-not-supported" && speechLanguage === "ml-IN") {
          toast.warning("Malayalam voice model unavailable on this browser. Falling back to English.");
          setSpeechLanguage("en-IN");
        } else if (event.error !== "no-speech") {
          toast.error(`Voice input error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      console.error("Speech recognition start failed:", e);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // 2. Photo Upload & Camera capture handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo size exceeds 5MB. Please choose a smaller photo.");
      return;
    }

    setPhotoFileName(file.name);
    setPhotoMimeType(file.type || "image/jpeg");

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPhotoBase64(result);
      toast.success(`Photo attached: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhotoBase64(null);
    setPhotoFileName(null);
    setPhotoMimeType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 3. AI Triage Execution
  const handleRunTriage = async () => {
    const reportText = (textInput || interimTranscript).trim();
    if (!reportText && !photoBase64) {
      toast.warning("Please speak, type incident details, or upload a photo to triage.");
      return;
    }

    setIsTriaging(true);
    toast.info("Running Multimodal AI Triage on server with Gemini...");

    try {
      const result = await triageReport({
        data: {
          transcript: reportText,
          photoBase64: photoBase64,
          photoMimeType: photoMimeType,
          locationHint: manualLocation || "Kochi Urban Area",
          latitude: selectedLat,
          longitude: selectedLng,
        },
      });

      setTriagedData(result);
      setEditedFields(result);
      toast.success("AI Triage complete! Review and verify details below.");
    } catch (err: any) {
      console.error("Triage error:", err);
      toast.error("Triage completed with fallback classifier.");
    } finally {
      setIsTriaging(false);
    }
  };

  // 4. Submit Incident to Command Center
  const handleFinalSubmit = () => {
    if (!editedFields) return;

    const ticketId = `KC-${Math.floor(1000 + Math.random() * 9000)}`;
    const locationString = manualLocation.trim() || editedFields.location_hint || `${selectedLat.toFixed(4)}° N, ${selectedLng.toFixed(4)}° E`;

    // Map severity to store severity format
    const storeSeverity: Incident["severity"] =
      editedFields.severity === "critical"
        ? "critical"
        : editedFields.severity === "high" || editedFields.severity === "medium"
          ? "warning"
          : "info";

    // Priority mapping
    const storePriority: "high" | "medium" | "low" =
      editedFields.severity === "critical"
        ? "high"
        : editedFields.severity === "high"
          ? "high"
          : editedFields.severity === "medium"
            ? "medium"
            : "low";

    // Save through existing Supabase-backed store
    addCitizenReport({
      title: `${getCategoryLabel(editedFields.category)}: ${editedFields.summary_en.slice(0, 45)}...`,
      citizen: "Citizen (AI Triage)",
      location: locationString,
      priority: storePriority,
      department: editedFields.department,
      latitude: selectedLat,
      longitude: selectedLng,
      severity: storeSeverity,
      description: `[${editedFields.language.toUpperCase()}] ${textInput}\nEN: ${editedFields.summary_en}\nML: ${editedFields.summary_ml}`,
      recommendation: editedFields.suggested_action,
    });

    // Synchronize into Unified Dispatch Engine
    createAssignmentServerFn({
      data: {
        title: `${getCategoryLabel(editedFields.category)}: ${editedFields.summary_en.slice(0, 45)}`,
        description: `[Citizen Grievance #${ticketId}]\n${editedFields.summary_en}\nLocation: ${locationString}\nAction: ${editedFields.suggested_action}`,
        category: 'municipal',
        assignment_type:
          editedFields.category === 'pothole'
            ? 'pothole_repair'
            : editedFields.category === 'waterlogging'
              ? 'waterlogging_investigation'
              : 'drainage_inspection',
        priority: storePriority === 'high' ? 'high' : 'normal',
        location_name: locationString,
        latitude: selectedLat,
        longitude: selectedLng,
        department_id: editedFields.department,
        requires_approval: true,
        source: 'citizen_triage',
        metadata: { citizen_ticket_id: ticketId },
      },
    })
      .then((created: any) => {
        dispatchRealtime.broadcast('assignment.created', created.id);
      })
      .catch((e) => console.warn('Citizen dispatch sync error:', e));

    setSubmittedTicket({
      id: ticketId,
      title: editedFields.summary_en,
      department: editedFields.department,
      status: "received",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });

    toast.success(`Ticket ${ticketId} dispatched and synchronized with Kochi Command Center!`);

    // Simulate real-time verification progression for citizen
    setTimeout(() => {
      setSubmittedTicket((prev) => (prev ? { ...prev, status: "verified" } : null));
    }, 2500);

    setTimeout(() => {
      setSubmittedTicket((prev) => (prev ? { ...prev, status: "assigned" } : null));
    }, 5500);
  };

  const handleResetForm = () => {
    setTextInput("");
    setPhotoBase64(null);
    setPhotoFileName(null);
    setPhotoMimeType(null);
    setTriagedData(null);
    setEditedFields(null);
    setSubmittedTicket(null);
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case "pothole": return "Road Pothole (കുഴി)";
      case "waterlogging": return "Waterlogging (വെള്ളക്കെട്ട്)";
      case "garbage": return "Waste Dumping (മാലിന്യം)";
      case "streetlight": return "Streetlight Outage (സ്ട്രീറ്റ് ലൈറ്റ്)";
      case "power_outage": return "Power Line / KSEB Fault (വൈദ്യുതി)";
      case "accident": return "Vehicle Accident (അപകടം)";
      default: return "Civic Hazard (മറ്റ് പ്രശ്നം)";
    }
  };

  // -------------------------------------------------------------
  // VIEW A: SUBMITTED SUCCESS & 4-STEP LIVE TRACKER
  // -------------------------------------------------------------
  if (submittedTicket) {
    const statusIndex =
      submittedTicket.status === "received"
        ? 0
        : submittedTicket.status === "verified"
          ? 1
          : submittedTicket.status === "assigned"
            ? 2
            : 3;

    const trackerSteps = [
      { key: "received", label: "Received", desc: "Logged in Sentinel GIS" },
      { key: "verified", label: "AI Verified", desc: "Vision & Geo Validated" },
      { key: "assigned", label: "Assigned", desc: `${submittedTicket.department} Dispatched` },
      { key: "resolved", label: "Resolved", desc: "Field Team Completed" },
    ];

    return (
      <div className="max-w-2xl mx-auto space-y-6 pt-4 pb-12">
        {/* Ticket Header Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-md text-center space-y-4 relative overflow-hidden">
          <div className="size-16 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="size-9 animate-bounce" />
          </div>

          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 font-mono text-xs font-bold text-slate-700 border border-slate-200">
              Ticket ID: {submittedTicket.id}
            </span>
            <h2 className="text-xl font-bold font-display text-slate-900 mt-2">
              Citizen Report Live Synced!
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Your report has been triaged by Gemini AI, assigned to <strong>{submittedTicket.department}</strong>, and broadcasted to the Kochi Smart City Command Center.
            </p>
          </div>

          {/* 4-Step Status Stepper */}
          <div className="pt-6 pb-2 px-2 sm:px-6">
            <div className="flex justify-between items-center relative">
              {/* Background Line */}
              <div className="absolute left-6 right-6 h-1 bg-slate-100 -translate-y-1/2 top-4 -z-10 rounded-full" />
              {/* Progress Line */}
              <div
                className="absolute left-6 h-1 bg-gradient-to-r from-primary to-emerald-500 -translate-y-1/2 top-4 -z-10 transition-all duration-700 rounded-full"
                style={{ width: `${(statusIndex / 3) * 88}%` }}
              />

              {trackerSteps.map((step, idx) => {
                const isDone = idx <= statusIndex;
                const isCurrent = idx === statusIndex;

                return (
                  <div key={step.key} className="flex flex-col items-center max-w-[80px]">
                    <div
                      className={cn(
                        "size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs",
                        isCurrent
                          ? "bg-primary text-white scale-110 ring-4 ring-primary/20 animate-pulse-soft"
                          : isDone
                            ? "bg-emerald-600 text-white"
                            : "bg-white border-2 border-slate-200 text-slate-400"
                      )}
                    >
                      {isDone ? <Check className="size-4 stroke-[3]" /> : idx + 1}
                    </div>
                    <span className={cn(
                      "text-[10px] mt-2 font-bold text-center leading-tight",
                      isCurrent ? "text-primary" : isDone ? "text-slate-800" : "text-slate-400"
                    )}>
                      {step.label}
                    </span>
                    <span className="text-[8.5px] text-slate-400 text-center hidden sm:block mt-0.5">
                      {step.desc}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Incident Summary Box */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 text-left space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Incident Summary</span>
              <span className="text-slate-400 font-mono text-[10px]">{submittedTicket.timestamp}</span>
            </div>
            <p className="font-semibold text-slate-800">{submittedTicket.title}</p>
            <div className="flex items-center gap-2 pt-1">
              <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold text-[10px] border border-blue-200">
                Dept: {submittedTicket.department}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200">
                Command Center Synced
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={() => setActiveTab("reports")}
              variant="outline"
              className="flex-1 rounded-2xl h-11 text-xs font-bold text-slate-700 border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              View in My Reports
            </Button>
            <Button
              onClick={handleResetForm}
              className="flex-1 rounded-2xl h-11 text-xs font-bold bg-primary text-white hover:brightness-110 cursor-pointer shadow-md shadow-primary/20"
            >
              Report Another Issue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW B: MAIN REPORTING & AI TRIAGE FORM
  // -------------------------------------------------------------
  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200/70 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary animate-ping" />
            <h3 className="text-base font-display font-bold text-slate-900 tracking-tight uppercase">
              AI-Assisted Citizen Reporting
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Voice or text report in Malayalam, Manglish, or English with optional camera photo upload.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[10px] font-bold text-emerald-700">
            <Globe className="size-3" />
            Malayalam / Manglish / English
          </span>
        </div>
      </div>

      {/* Suggested Example Chips */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
          <Sparkles className="size-3 text-primary" />
          Click an example prompt chip to try:
        </label>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setTextInput(chip.text);
                toast.info(`Loaded: "${chip.label}"`);
              }}
              className="text-left text-xs bg-white border border-slate-200/90 rounded-2xl px-3.5 py-2 hover:border-primary/40 hover:bg-primary/5 transition-all shadow-2xs cursor-pointer group"
            >
              <div className="font-semibold text-slate-800 group-hover:text-primary transition-colors text-[11.5px]">
                {chip.label}
              </div>
              <div className="text-[9.5px] text-slate-400">{chip.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Col: Voice + Text Input + Photo (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            
            {/* Voice Recording Control Bar */}
            <div className="rounded-2xl p-3.5 bg-slate-50 border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  className={cn(
                    "size-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-md",
                    isListening
                      ? "bg-rose-500 text-white animate-pulse ring-4 ring-rose-200 scale-105"
                      : "bg-primary text-white hover:brightness-110"
                  )}
                  title={isListening ? "Stop voice recording" : "Start speaking"}
                >
                  {isListening ? <MicOff className="size-6" /> : <Mic className="size-6" />}
                </button>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    {isListening ? (
                      <span className="text-rose-600 flex items-center gap-1 animate-pulse">
                        <Radio className="size-3.5" /> Recording Live...
                      </span>
                    ) : (
                      <span>Voice Reporting (Web Speech)</span>
                    )}
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    {isListening ? "Speak in Malayalam or English..." : "Tap mic to speak your grievance."}
                  </p>
                </div>
              </div>

              {/* Language Selector for Speech */}
              <div className="flex items-center gap-1.5 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setSpeechLanguage("ml-IN")}
                  className={cn(
                    "px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer",
                    speechLanguage === "ml-IN"
                      ? "bg-primary text-white border-primary shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  മലയാളം (ml-IN)
                </button>
                <button
                  type="button"
                  onClick={() => setSpeechLanguage("en-IN")}
                  className={cn(
                    "px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer",
                    speechLanguage === "en-IN"
                      ? "bg-primary text-white border-primary shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  English (en-IN)
                </button>
              </div>
            </div>

            {/* Interim Transcript Live Display */}
            {interimTranscript && (
              <div className="rounded-2xl p-3 bg-amber-50 border border-amber-200/70 text-xs text-amber-900 flex items-center gap-2 animate-pulse">
                <Volume2 className="size-4 text-amber-600 shrink-0" />
                <span className="italic font-medium">"{interimTranscript}..."</span>
              </div>
            )}

            {/* Multiline Text Box */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                  Incident Description (Malayalam / Manglish / English)
                </label>
                {textInput && (
                  <button
                    type="button"
                    onClick={() => setTextInput("")}
                    className="text-[10px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                  >
                    Clear text
                  </button>
                )}
              </div>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="സംസാരിക്കുക അല്ലെങ്കിൽ ഇവിടെ ടൈപ്പ് ചെയ്യുക (e.g. 'Edappally ജംഗ്ഷനിൽ റോഡിൽ വലിയ കുഴിയുണ്ട്' or 'Drainage overflow near Marine Drive')..."
                className="w-full rounded-2xl border border-slate-200/90 bg-white p-3.5 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 min-h-[110px] text-slate-800 placeholder-slate-400 leading-relaxed shadow-2xs"
              />
            </div>

            {/* Media & Camera Upload */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                Attach Photo / Mobile Camera (Optional)
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
                id="photo-upload-input"
              />

              {!photoBase64 ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-3 hover:bg-slate-100 transition-all cursor-pointer text-xs font-semibold text-slate-600 shadow-2xs"
                  >
                    <Camera className="size-4 text-primary" />
                    <span>Take Photo / Camera</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-3 hover:bg-slate-100 transition-all cursor-pointer text-xs font-semibold text-slate-600 shadow-2xs"
                  >
                    <UploadCloud className="size-4 text-slate-500" />
                    <span>Upload Image File</span>
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={photoBase64}
                      alt="Incident snapshot"
                      className="size-12 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{photoFileName || "incident_photo.jpg"}</p>
                      <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="size-3" /> Ready for Gemini Vision Triage
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="size-8 rounded-xl bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 flex items-center justify-center cursor-pointer shrink-0"
                    title="Remove Photo"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}
            </div>

            {/* AI Triage Trigger Button */}
            <div className="pt-2">
              <Button
                type="button"
                onClick={handleRunTriage}
                disabled={isTriaging || (!textInput.trim() && !photoBase64)}
                className="w-full bg-gradient-to-r from-primary via-indigo-600 to-primary bg-size-200 text-white py-3 rounded-2xl font-bold text-xs hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-primary/25 h-11"
              >
                {isTriaging ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Gemini AI Triaging Malayalam & Vision...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="size-4" />
                    {triagedData ? "Re-run AI Triage" : "Run AI Triage (Gemini Multimodal)"}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Right Col: Location & Digital Twin Map (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="size-4 text-primary" />
                Incident Location & GPS Verification
              </h4>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Auto-captured via GPS API. You can also specify landmark or area.
              </p>
            </div>

            {/* Location Landmark Text Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Landmark / Street Name (Optional)
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <MapPin className="size-3.5 text-primary shrink-0" />
                <input
                  type="text"
                  value={manualLocation}
                  onChange={(e) => setManualLocation(e.target.value)}
                  placeholder="e.g. Near Palarivattom Metro Pillar 482"
                  className="w-full bg-transparent outline-none text-slate-700 placeholder-slate-400 text-xs"
                />
              </div>
            </div>

            {/* GPS Coordinates Preview */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
              <div>
                <span className="text-slate-400 block">Latitude</span>
                <span className="text-slate-800 font-bold">{selectedLat.toFixed(6)}° N</span>
              </div>
              <div>
                <span className="text-slate-400 block">Longitude</span>
                <span className="text-slate-800 font-bold">{selectedLng.toFixed(6)}° E</span>
              </div>
            </div>

            {/* Mini Map View */}
            <div className="h-[220px] rounded-2xl overflow-hidden border border-slate-200 relative">
              <CityMap height="100%" activeLayers={["buildings", "cctv"]} />
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          AI TRIAGE CONFIRMATION CARD (Shows up when triaged)
          ------------------------------------------------------------- */}
      {editedFields && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-primary/30 shadow-xl space-y-6"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="size-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Sparkles className="size-4" />
                </span>
                <h3 className="text-base font-bold font-display text-slate-900">
                  AI Triage Results & Verification Card
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                The AI automatically categorized your report. Review or edit the auto-filled fields below before submitting.
              </p>
            </div>

            {/* Confidence & Language Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1">
                <CheckCircle className="size-3.5" />
                {Math.round(editedFields.confidence * 100)}% Confidence
              </span>
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold uppercase font-mono">
                Lang: {editedFields.language}
              </span>
              {editedFields.photo_matches_text && (
                <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold flex items-center gap-1">
                  <Check className="size-3.5" />
                  Photo Match
                </span>
              )}
            </div>
          </div>

          {/* Editable Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Category */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                Incident Category
              </label>
              <select
                value={editedFields.category}
                onChange={(e) => setEditedFields({ ...editedFields, category: e.target.value as any })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-primary cursor-pointer"
              >
                <option value="pothole">Road Pothole (കുഴി / PWD)</option>
                <option value="waterlogging">Waterlogging (വെള്ളക്കെട്ട് / Corp)</option>
                <option value="garbage">Garbage / Waste (മാലിന്യം)</option>
                <option value="streetlight">Streetlight Outage (സ്ട്രീറ്റ് ലൈറ്റ്)</option>
                <option value="power_outage">Power Outage / Wire Spark (KSEB)</option>
                <option value="accident">Traffic Accident (പോലീസ്)</option>
                <option value="other">Other Civic Hazard</option>
              </select>
            </div>

            {/* Severity */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                Severity Level
              </label>
              <select
                value={editedFields.severity}
                onChange={(e) => setEditedFields({ ...editedFields, severity: e.target.value as any })}
                className={cn(
                  "w-full rounded-xl border p-2.5 text-xs font-bold outline-none cursor-pointer",
                  editedFields.severity === "critical"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : editedFields.severity === "high"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-slate-50 text-slate-800 border-slate-200"
                )}
              >
                <option value="low">Low Severity</option>
                <option value="medium">Medium Severity</option>
                <option value="high">High Severity</option>
                <option value="critical">Critical (Emergency Priority)</option>
              </select>
            </div>

            {/* Assigned Department */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                Assigned Department
              </label>
              <select
                value={editedFields.department}
                onChange={(e) => setEditedFields({ ...editedFields, department: e.target.value as any })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-primary cursor-pointer"
              >
                <option value="PWD">PWD (Public Works Department)</option>
                <option value="Kochi Corporation">Kochi Municipal Corporation</option>
                <option value="KSEB">KSEB (Electricity Board)</option>
                <option value="KWA">KWA (Kerala Water Authority)</option>
                <option value="Police">Kochi Traffic & City Police</option>
                <option value="Fire">Fire & Rescue Services</option>
              </select>
            </div>
          </div>

          {/* Bilingual Translations & Summaries */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* English Summary */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                English Summary (Auto-Translated)
              </label>
              <textarea
                value={editedFields.summary_en}
                onChange={(e) => setEditedFields({ ...editedFields, summary_en: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 outline-none focus:border-primary min-h-[60px]"
              />
            </div>

            {/* Malayalam Summary */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                Malayalam Summary (മലയാളം ചുരുക്കം)
              </label>
              <textarea
                value={editedFields.summary_ml}
                onChange={(e) => setEditedFields({ ...editedFields, summary_ml: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 outline-none focus:border-primary min-h-[60px]"
              />
            </div>
          </div>

          {/* Suggested Action Box */}
          <div className="bg-primary/5 rounded-2xl p-4 border border-primary/20 space-y-1 text-xs">
            <span className="font-bold text-primary uppercase text-[10px] tracking-wider block">
              Suggested Municipal Action:
            </span>
            <input
              type="text"
              value={editedFields.suggested_action}
              onChange={(e) => setEditedFields({ ...editedFields, suggested_action: e.target.value })}
              className="w-full bg-white rounded-xl border border-primary/20 p-2 text-xs text-slate-800 outline-none focus:border-primary"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleFinalSubmit}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-2xl font-bold text-xs shadow-lg shadow-emerald-600/20 cursor-pointer h-12"
            >
              <CheckCircle2 className="size-4 mr-1.5" />
              Submit Report to Kochi Command Center
            </Button>
            <Button
              onClick={handleResetForm}
              variant="outline"
              className="sm:w-36 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl text-xs font-semibold cursor-pointer h-12"
            >
              Cancel
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ============================================
// 3. LIVE MAP SCREEN
// ============================================
function LiveMapScreen() {
  const layers = [
    { key: "buildings", label: "3D Buildings" },
    { key: "traffic", label: "Traffic Flow" },
    { key: "cctv", label: "Vision AI CCTV" },
    { key: "transit", label: "Metro Transit" },
  ];
  const [active, setActive] = useState<string[]>(["buildings", "traffic", "cctv"]);
  const toggle = (k: string) =>
    setActive((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));

  return (
    <div className="h-full flex flex-col space-y-3 pb-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h3 className="text-sm font-bold tracking-tight uppercase text-slate-700">Live Digital Twin Map</h3>
        <div className="flex gap-1 flex-wrap">
          {layers.map((l) => (
            <button
              key={l.key}
              onClick={() => toggle(l.key)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[9px] font-bold transition-all cursor-pointer",
                active.includes(l.key)
                  ? "border-primary bg-primary text-white shadow-sm shadow-primary/20"
                  : "border-slate-200 bg-white text-slate-500 hover:text-slate-800"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-[500px] md:min-h-[560px] rounded-3xl overflow-hidden border border-slate-200 relative">
        <CityMap height="100%" activeLayers={active} />
      </div>
    </div>
  );
}

// ============================================
// 4. ALERTS SCREEN
// ============================================
function AlertsScreen() {
  const { incidents } = useSentinelStore();
  const activeAlerts = incidents.filter((i) => i.severity !== "resolved");

  return (
    <div className="space-y-4 pb-4">
      <h3 className="text-sm font-bold tracking-tight uppercase text-slate-700">Public Alerts</h3>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {activeAlerts.map((alt) => (
          <div
            key={alt.id}
            className={cn(
              "rounded-2xl p-4 border flex flex-col justify-between space-y-3 hover:bg-slate-50 transition-colors shadow-xs bg-white",
              alt.severity === "critical" ? "border-red-200/60" : "border-slate-200"
            )}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[8px] font-bold uppercase text-white",
                  alt.severity === "critical" ? "bg-destructive animate-pulse-soft" : "bg-amber-500"
                )}>
                  {alt.severity}
                </span>
                <span className="text-[9px] text-slate-400 font-mono">{alt.minutesAgo}m ago</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">{alt.title}</h4>
                <p className="text-[10.5px] text-slate-500 mt-0.5 font-medium">{alt.location}</p>
              </div>
            </div>
            <div className="text-[9.5px] text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <strong>Traffic Advisory:</strong> Prioritized routing active. Follow signals override rules.
            </div>
          </div>
        ))}

        {activeAlerts.length === 0 && (
          <p className="col-span-full text-xs text-slate-500 text-center py-12">All clear. No active alerts reported for Kochi.</p>
        )}
      </div>
    </div>
  );
}

// ============================================
// 5. MY REPORTS (TIMELINE & TRACKER)
// ============================================
function MyReportsScreen() {
  const { citizenReports } = useSentinelStore();

  const getStatusIndex = (status: string) => {
    switch (status) {
      case "received": return 0;
      case "verifying": return 0;
      case "verified": return 1;
      case "assigned": return 2;
      case "resolved": return 3;
      default: return 1;
    }
  };

  const steps = [
    { label: "Received", sub: "Ticket Logged" },
    { label: "AI Verified", sub: "Vision Validated" },
    { label: "Assigned", sub: "Dept Dispatched" },
    { label: "Resolved", sub: "Issue Closed" },
  ];

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200/60 pb-3">
        <div>
          <h3 className="text-base font-display font-bold text-slate-800 tracking-tight uppercase">My Submitted Reports</h3>
          <p className="text-xs text-slate-500">Track real-time resolution progress, AI verification, and field team response across Kochi.</p>
        </div>
        <span className="self-start sm:self-center rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-mono font-bold text-primary">
          {citizenReports.length} Active Tickets
        </span>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {citizenReports.map((rep) => {
          const activeIndex = getStatusIndex(rep.status);
          
          return (
            <div
              key={rep.id}
              className="group relative bg-white/95 rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between space-y-5"
            >
              {/* Top Bar: Title, ID & Status Badge */}
              <div className="space-y-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600 border border-slate-200">
                        {rep.id}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 font-medium">
                        {rep.minutesAgo}m ago
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">
                      {rep.title}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      <MapPin className="size-3.5 text-slate-400 shrink-0" />
                      {rep.location}
                    </p>
                  </div>

                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider border shrink-0 shadow-2xs",
                    rep.status === "resolved" 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                      : rep.status === "assigned"
                        ? "bg-blue-50 border-blue-200 text-blue-700"
                        : "bg-cyan-50 border-cyan-200 text-cyan-700"
                  )}>
                    {rep.status === "resolved" && <CheckCircle2 className="size-3 text-emerald-600" />}
                    {rep.status === "assigned" && <Shield className="size-3 text-blue-600" />}
                    {rep.status !== "resolved" && rep.status !== "assigned" && <Sparkles className="size-3 text-cyan-600" />}
                    {rep.status}
                  </span>
                </div>

                {/* Stepper Progress Bar */}
                <div className="pt-2 pb-1 px-1">
                  <div className="flex justify-between items-center relative">
                    {/* Background Track Line */}
                    <div className="absolute left-3 right-3 h-1 bg-slate-100 -translate-y-1/2 top-3 -z-10 rounded-full" />
                    {/* Active Gradient Connector Line */}
                    <div 
                      className="absolute left-3 h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500 -translate-y-1/2 top-3 -z-10 transition-all duration-700 rounded-full" 
                      style={{ width: `${(activeIndex / 3) * 92}%` }}
                    />

                    {steps.map((step, idx) => {
                      const isDone = idx <= activeIndex;
                      const isCurrent = idx === activeIndex;
                      return (
                        <div key={step.label} className="flex flex-col items-center">
                          <div className={cn(
                            "size-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all shadow-xs",
                            isCurrent
                              ? "bg-primary text-white scale-110 ring-4 ring-primary/20 shadow-md animate-pulse-soft"
                              : isDone
                                ? "bg-primary text-white"
                                : "bg-white border-2 border-slate-200 text-slate-400"
                          )}>
                            {isDone ? <Check className="size-3.5 stroke-[3]" /> : idx + 1}
                          </div>
                          <span className={cn(
                            "text-[9.5px] mt-1.5 font-semibold text-center leading-tight",
                            isCurrent ? "text-primary font-bold" : isDone ? "text-slate-700" : "text-slate-400"
                          )}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer Info */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 text-xs">
                    Department: <strong className="text-slate-800 font-semibold">{rep.department}</strong>
                  </span>
                  <span className={cn(
                    "rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                    rep.priority === "high" ? "bg-rose-100 text-rose-700" : rep.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                  )}>
                    {rep.priority} priority
                  </span>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    toast.info(`Tracking Report ${rep.id}`, {
                      description: `Assigned to ${rep.department} field unit. Resolution ETA: 25 min.`,
                    });
                  }}
                  className="h-8 gap-1 text-[11px] font-semibold text-primary border-primary/30 hover:bg-primary/5 cursor-pointer rounded-xl"
                >
                  Track <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// 6. AI ASSISTANT SCREEN
// ============================================
function AiAssistantScreen() {
  const [messages, setMessages] = useState<any[]>([
    { id: "greet", role: "assistant", text: "Hello! I'm CityTwin AI, your Kochi City assistant. How can I help you navigate safety or report hazards today?" },
  ]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const prompts = ["Is this road safe?", "Nearest hospital", "Report emergency", "Flood status"];

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    const userMsg = { id: Math.random().toString(), role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    if (apiConfig.gemini.isConfigured) {
      try {
        const reply = await generateGeminiResponse(text);
        setMessages((m) => [...m, { id: Math.random().toString(), role: "assistant", text: reply }]);
      } catch (err: any) {
        console.error("Gemini citizen assistant error:", err);
        setMessages((m) => [
          ...m,
          {
            id: Math.random().toString(),
            role: "assistant",
            text: replyFor(text),
          },
        ]);
      }
    } else {
      setTimeout(() => {
        setMessages((m) => [...m, { id: Math.random().toString(), role: "assistant", text: replyFor(text) }]);
      }, 500);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="max-w-2xl mx-auto h-[560px] flex flex-col justify-between pb-4 bg-white border border-slate-200/60 rounded-3xl p-4 shadow-xs">
      <h3 className="text-sm font-bold tracking-tight uppercase text-slate-400 font-mono">CityTwin AI Assistant</h3>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 py-4 pr-1">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex gap-2 text-xs", m.role === "user" && "flex-row-reverse")}>
            <div className={cn(
              "p-3 rounded-2xl max-w-[80%] leading-relaxed shadow-2xs",
              m.role === "user" ? "bg-primary text-white rounded-tr-sm" : "bg-slate-50 border border-slate-200 text-slate-700 rounded-tl-sm"
            )}>
              <FormattedMarkdown text={m.text} />
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 shrink-0">
        {prompts.map((p) => (
          <button
            key={p}
            onClick={() => handleSend(p)}
            className="text-[10px] border border-slate-200 bg-white text-slate-600 px-3.5 py-1.5 rounded-full whitespace-nowrap hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs font-semibold"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shrink-0 shadow-2xs">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
          placeholder="Ask CityTwin AI..."
          className="flex-1 bg-transparent px-2 text-xs outline-none text-slate-700 placeholder-slate-400"
        />
        <button
          onClick={() => handleSend(input)}
          className="size-8 rounded-xl bg-primary flex items-center justify-center text-white cursor-pointer hover:brightness-110"
        >
          <Send className="size-3.5 text-white" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// 7. PROFILE SCREEN
// ============================================
function ProfileScreen() {
  return (
    <div className="max-w-md mx-auto space-y-4 pb-4">
      <h3 className="text-sm font-bold tracking-tight uppercase text-slate-400 font-mono">My Profile</h3>

      <div className="bg-white rounded-3xl p-4 border border-slate-200/60 text-center space-y-2 shadow-xs">
        <div className="size-16 rounded-full bg-slate-100 border border-slate-200 mx-auto flex items-center justify-center text-slate-600 text-lg font-bold">
          RS
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-800">Rahul Sharma</h4>
          <p className="text-[10px] text-slate-500 font-mono">+91 98456 22104</p>
        </div>
      </div>

      <div className="space-y-2.5">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Emergency Contacts</h4>
        <div className="bg-white rounded-2xl p-3 border border-slate-200/60 text-xs flex justify-between items-center shadow-xs">
          <div>
            <p className="font-semibold text-slate-700">Sita Sharma (Spouse)</p>
            <p className="text-[9px] text-slate-500 font-mono">+91 94567 11203</p>
          </div>
          <a href="tel:9456711203" className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center hover:bg-emerald-500/20"><Phone className="size-3.5" /></a>
        </div>
      </div>

      <div className="space-y-2.5">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Saved Locations</h4>
        <div className="bg-white rounded-2xl p-3 border border-slate-200/60 text-xs space-y-2 shadow-xs text-slate-700">
          <div className="flex justify-between items-center">
            <span>🏠 Home: MG Road, Ernakulam</span>
            <span className="text-[9px] text-primary hover:underline cursor-pointer">Edit</span>
          </div>
          <div className="flex justify-between items-center border-t border-slate-100 pt-2">
            <span>🏢 Work: Kakkanad Infopark</span>
            <span className="text-[9px] text-primary hover:underline cursor-pointer">Edit</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 8. SETTINGS SCREEN
// ============================================
function SettingsScreen() {
  const { mapboxToken, setMapboxToken } = useSentinelStore();
  const [tokenInput, setTokenInput] = useState(mapboxToken);

  const handleSaveToken = () => {
    setMapboxToken(tokenInput);
    toast.success("Mapbox Access Token saved successfully!");
  };

  return (
    <div className="max-w-md mx-auto space-y-4 pb-4">
      <h3 className="text-sm font-bold tracking-tight uppercase text-slate-400 font-mono">Settings</h3>

      <div className="space-y-3">
        {/* API Integration Status dashboard */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/60 space-y-3 shadow-xs">
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Sparkles className="size-4 text-primary" />
            API Connection Dashboard
          </h4>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Sentinel interfaces with multiple external telemetry and AI networks. Review your secret key statuses below:
          </p>

          <div className="space-y-2 text-[10.5px]">
            {/* Leaflet & OSM */}
            <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200/50">
              <div>
                <span className="font-semibold block text-slate-700 font-mono">Leaflet & OpenStreetMap</span>
                <span className="text-[9px] text-slate-400">Interactive raster tiles & OSRM routing engine</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[8.5px] font-bold uppercase bg-emerald-100 text-emerald-700">
                Leaflet Active
              </span>
            </div>

            {/* Gemini */}
            <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200/50">
              <div>
                <span className="font-semibold block text-slate-700 font-mono">Gemini AI Engine</span>
                <span className="text-[9px] text-slate-400 font-medium">Server triage & assistant responses</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[8.5px] font-bold uppercase bg-emerald-100 text-emerald-700">
                Gemini Ready
              </span>
            </div>

            {/* OpenWeather */}
            <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200/50">
              <div>
                <span className="font-semibold block text-slate-700 font-mono">OpenWeather Telemetry</span>
                <span className="text-[9px] text-slate-400">Real-time local environmental sensors</span>
              </div>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[8.5px] font-bold uppercase",
                apiConfig.openWeather.isConfigured ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              )}>
                {apiConfig.openWeather.isConfigured ? "Weather Key Loaded" : "Simulation Mode"}
              </span>
            </div>
          </div>
        </div>

        {/* Mapbox Token config */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/60 space-y-3 shadow-xs">
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Compass className="size-4 text-primary" />
            Quick Mapbox Token Override
          </h4>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Enter a temporary token here to override environment settings. Saves in browser local storage.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="pk.eyJ1I..."
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10.5px] outline-none focus:border-primary text-slate-700 shadow-2xs"
            />
            <button
              onClick={handleSaveToken}
              className="bg-primary text-white px-4 rounded-xl text-xs font-semibold hover:brightness-110 cursor-pointer"
            >
              Save
            </button>
          </div>
        </div>

        <div className="text-center text-[9px] text-slate-400 font-medium">
          CityTwin AI Citizen app · v1.4.0 (Kochi Metro Ops)
        </div>
      </div>
    </div>
  );
}

function FormattedMarkdown({ text }: { text: string }) {
  const parseBold = (s: string) =>
    s
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="italic opacity-90">$1</em>');

  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <div key={i} className="flex gap-1.5 pl-1">
              <span className="text-slate-400">•</span>
              <span dangerouslySetInnerHTML={{ __html: parseBold(line.replace(/^[-•]\s*/, "")) }} />
            </div>
          );
        }
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i} dangerouslySetInnerHTML={{ __html: parseBold(line) }} />;
      })}
    </div>
  );
}

// ============================================
// 9. EMERGENCY CORRIDOR CITIZEN ALERT MODAL
// ============================================

function AnimatedYieldingRoadDiagram() {
  return (
    <div className="relative w-full h-36 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 p-2 select-none shadow-inner">
      {/* Road markings */}
      <div className="absolute inset-0 flex flex-col justify-between py-3 px-4">
        {/* Left shoulder line */}
        <div className="border-b-2 border-emerald-400/70 border-dashed w-full" />
        {/* Lane center divider */}
        <div className="border-b-2 border-amber-400/80 border-dashed w-full" />
        {/* Right road edge */}
        <div className="border-b-2 border-slate-700 w-full" />
      </div>

      {/* Road Labels */}
      <div className="absolute top-1 left-3 text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
        <span>← Road Shoulder (Safe Pull-Over)</span>
      </div>
      <div className="absolute bottom-1 right-3 text-[9px] font-mono text-rose-400 font-bold uppercase tracking-wider flex items-center gap-1">
        <span>Corridor Fast Lane →</span>
      </div>

      {/* Yielding Citizen Car Moving Left */}
      <motion.div
        className="absolute top-6 flex items-center gap-1.5 bg-slate-800 border-2 border-emerald-400 text-white rounded-xl px-2.5 py-1.5 shadow-lg z-10"
        initial={{ left: "48%", y: 22 }}
        animate={{
          left: ["48%", "10%", "10%"],
          y: [22, 0, 0],
        }}
        transition={{
          repeat: Infinity,
          duration: 3.2,
          times: [0, 0.45, 1],
          ease: "easeInOut",
        }}
      >
        <Car className="size-4 text-emerald-400" />
        <span className="text-[10px] font-bold text-emerald-300">Your Vehicle</span>
        <span className="size-2 rounded-full bg-amber-400 animate-ping" title="Left Indicator" />
      </motion.div>

      {/* Fast Approaching Ambulance */}
      <motion.div
        className="absolute bottom-6 flex items-center gap-1.5 bg-rose-600 border-2 border-white text-white rounded-xl px-2.5 py-1.5 shadow-xl z-20"
        initial={{ right: "-25%" }}
        animate={{
          right: ["-25%", "40%", "115%"],
        }}
        transition={{
          repeat: Infinity,
          duration: 3.2,
          times: [0, 0.45, 1],
          ease: "easeInOut",
        }}
      >
        <Ambulance className="size-4 text-white animate-bounce" />
        <span className="text-[10px] font-bold text-white uppercase tracking-wider">Ambulance</span>
        <span className="size-2 rounded-full bg-cyan-300 animate-ping" />
      </motion.div>
    </div>
  );
}

function CitizenEmergencyAlertModal({
  distanceM,
  junctionName,
  etaSeconds,
  isMuted,
  onToggleMute,
  onDismiss,
}: {
  distanceM: number;
  junctionName: string;
  etaSeconds: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
    >
      {/* Flashing border container */}
      <motion.div
        initial={{ scale: 0.95, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 12 }}
        className="relative w-full max-w-lg rounded-3xl bg-slate-900 border-4 border-rose-500 shadow-2xl shadow-rose-600/40 p-6 text-white space-y-5 overflow-hidden ring-8 ring-rose-500/20"
      >
        {/* Animated Beacon Flare in Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-600/50 animate-bounce">
              <Ambulance className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/30">
                  Emergency Preemption
                </span>
                <span className="size-2 rounded-full bg-rose-500 animate-ping" />
              </div>
              <h2 className="text-base font-extrabold tracking-tight text-white mt-0.5">
                AMBULANCE APPROACHING
              </h2>
            </div>
          </div>

          <button
            onClick={onToggleMute}
            className="size-9 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer hover:bg-slate-700 transition-colors"
            title={isMuted ? "Unmute Siren" : "Mute Siren"}
          >
            {isMuted ? (
              <VolumeX className="size-4 text-rose-400" />
            ) : (
              <Volume2 className="size-4 text-emerald-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* Live Distance & ETA Countdown Ticker */}
        <div className="grid grid-cols-2 gap-3 bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700/80 text-center font-mono">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
              Distance to Junction
            </span>
            <span className="text-2xl font-black text-rose-400">
              {distanceM} <span className="text-xs font-semibold text-slate-400">m</span>
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
              Approaching In
            </span>
            <span className="text-2xl font-black text-emerald-400">
              ~{etaSeconds} <span className="text-xs font-semibold text-slate-400">sec</span>
            </span>
          </div>
        </div>

        {/* Dual Language Warning Text */}
        <div className="space-y-2 bg-rose-950/40 border border-rose-500/30 rounded-2xl p-4">
          <p className="text-xs font-bold text-rose-200 leading-snug">
            Ambulance is <span className="text-white underline decoration-rose-400">{distanceM} m</span> away from{" "}
            <span className="text-white font-extrabold">{junctionName}</span>. Please move{" "}
            <strong className="text-white uppercase tracking-wide">LEFT</strong> and give way.
          </p>
          <p className="text-xs font-bold text-amber-300 leading-snug">
            ആംബുലൻസ് അടുത്തെത്തുന്നു. ദയവായി ഇടതുവശത്തേക്ക് മാറി വഴി നൽകുക.
          </p>
        </div>

        {/* Animated Yielding Road Diagram */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase font-bold text-slate-400">
            <span>Safety Maneuver Guide</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <ArrowLeft className="size-3" /> Pull Over Left
            </span>
          </div>
          <AnimatedYieldingRoadDiagram />
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Button
            onClick={onDismiss}
            className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 cursor-pointer flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="size-4" />
            <span>I Have Pulled Over to the Left (Acknowledge)</span>
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

