// Deterministic mock data for Project Sentinel — Kochi Urban Digital Twin

export type Severity = "critical" | "warning" | "info" | "resolved";

export interface Incident {
  id: string;
  title: string;
  location: string;
  severity: Severity;
  minutesAgo: number;
  confidence: number;
  department: string;
  x: number; // map coord 0-100
  y: number;
  category: "accident" | "flood" | "congestion" | "fire" | "crowd" | "pothole" | "waterlogging" | "garbage" | "streetlight" | "power_outage" | "other";
  lng?: number;
  lat?: number;
}

export const incidents: Incident[] = [
  { id: "I-2841", title: "Multi-vehicle collision", location: "Kundannoor Junction", severity: "critical", minutesAgo: 4, confidence: 97, department: "Traffic + Ambulance", x: 52, y: 74, category: "accident" },
  { id: "I-2839", title: "Waterlogging detected", location: "Marine Drive", severity: "warning", minutesAgo: 12, confidence: 88, department: "Municipal + Traffic", x: 34, y: 46, category: "flood" },
  { id: "I-2837", title: "Heavy congestion", location: "Vytilla Hub", severity: "warning", minutesAgo: 18, confidence: 92, department: "Traffic Police", x: 46, y: 66, category: "congestion" },
  { id: "I-2830", title: "Container truck overturned", location: "NH-66, Edappally", severity: "critical", minutesAgo: 31, confidence: 99, department: "Fire + Traffic + Police", x: 36, y: 30, category: "accident" },
  { id: "I-2825", title: "Metro crowd surge", location: "MG Road Metro", severity: "info", minutesAgo: 44, confidence: 81, department: "Kochi Metro", x: 40, y: 52, category: "crowd" },
  { id: "I-2812", title: "Signal outage", location: "Palarivattom Flyover", severity: "resolved", minutesAgo: 92, confidence: 95, department: "Traffic Police", x: 42, y: 40, category: "congestion" },
];

export interface AiDecision {
  id: string;
  time: string;
  agent: string;
  action: string;
  outcome: "auto" | "assisted" | "advised";
}

export const recentDecisions: AiDecision[] = [
  { id: "D-9412", time: "2m", agent: "Traffic Agent", action: "Rerouted 1,240 vehicles via NH-66 bypass", outcome: "auto" },
  { id: "D-9411", time: "8m", agent: "Emergency Agent", action: "Dispatched Ambulance K-14 to Kundannoor", outcome: "auto" },
  { id: "D-9410", time: "14m", agent: "Weather Agent", action: "Raised flood watch for Marine Drive corridor", outcome: "advised" },
  { id: "D-9409", time: "22m", agent: "Transit Agent", action: "Added 4 buses on Vytilla ↔ Kakkanad", outcome: "assisted" },
];

export interface CctvFeed {
  id: string;
  location: string;
  detection: string;
  confidence: number;
  vehicleCount: number;
  status: "normal" | "alert" | "critical";
  videoUrl: string;
  lng?: number;
  lat?: number;
}

export const cctvFeeds: CctvFeed[] = [
  { id: "CAM-14", location: "Vytilla Hub", detection: "Heavy Flow", confidence: 92, vehicleCount: 148, status: "alert", videoUrl: "/cctv/cam1.mp4", lng: 76.3216, lat: 9.9678 },
  { id: "CAM-22", location: "MG Road North", detection: "Normal Flow", confidence: 98, vehicleCount: 62, status: "normal", videoUrl: "/cctv/cam2.mp4", lng: 76.2825, lat: 9.9712 },
  { id: "CAM-09", location: "Kundannoor Junction", detection: "Accident Risk", confidence: 97, vehicleCount: 41, status: "critical", videoUrl: "/cctv/cam3.mp4", lng: 76.3150, lat: 9.9450 },
  { id: "CAM-18", location: "Edappally NH-66", detection: "Slow Traffic", confidence: 96, vehicleCount: 210, status: "critical", videoUrl: "/cctv/cam4.mp4", lng: 76.3080, lat: 10.0240 },
  { id: "CAM-07", location: "Kakkanad Bypass", detection: "Moderate Flow", confidence: 99, vehicleCount: 55, status: "normal", videoUrl: "/cctv/cam5.mp4", lng: 76.3500, lat: 10.0100 },
  { id: "CAM-11", location: "Palarivattom Flyover", detection: "Active Monitoring", confidence: 94, vehicleCount: 88, status: "normal", videoUrl: "/cctv/cam6.mp4", lng: 76.3050, lat: 10.0050 },
];

export interface AlertItem {
  id: string;
  title: string;
  location: string;
  severity: Severity;
  confidence: number;
  priority: "P0" | "P1" | "P2" | "P3";
  recommendation: string;
  department: string;
  minutesAgo: number;
}

export const alerts: AlertItem[] = [
  { id: "A-701", title: "Accident: Kundannoor", location: "Kundannoor Jn.", severity: "critical", confidence: 97, priority: "P0", recommendation: "Dispatch Ambulance K-14 · Green corridor via SA Rd", department: "Emergency + Traffic", minutesAgo: 4 },
  { id: "A-702", title: "Container overturned", location: "NH-66 Edappally", severity: "critical", confidence: 99, priority: "P0", recommendation: "Close lanes 2-3 · Deploy Fire unit F-3", department: "Fire + Traffic", minutesAgo: 31 },
  { id: "A-703", title: "Flood risk rising", location: "Marine Drive", severity: "warning", confidence: 88, priority: "P1", recommendation: "Pre-position pumps · Alert citizens", department: "Municipal", minutesAgo: 12 },
  { id: "A-704", title: "Metro crowd surge", location: "MG Road Metro", severity: "info", confidence: 81, priority: "P2", recommendation: "Add 2 trains · Notify KMRL Ops", department: "Kochi Metro", minutesAgo: 44 },
];

export interface Report {
  id: string;
  title: string;
  citizen: string;
  location: string;
  status: "verifying" | "verified" | "assigned" | "resolved";
  priority: "high" | "medium" | "low";
  department: string;
  minutesAgo: number;
}

export const citizenReports: Report[] = [
  { id: "R-3341", title: "Large pothole near school", citizen: "Anitha S.", location: "Palarivattom", status: "assigned", priority: "medium", department: "PWD", minutesAgo: 18 },
  { id: "R-3340", title: "Street light not working", citizen: "Rahul M.", location: "Kaloor", status: "verified", priority: "low", department: "KSEB", minutesAgo: 34 },
  { id: "R-3338", title: "Water logging on road", citizen: "Fathima K.", location: "Marine Drive", status: "verified", priority: "high", department: "Municipal", minutesAgo: 41 },
  { id: "R-3335", title: "Illegal dumping", citizen: "Anonymous", location: "Kakkanad", status: "resolved", priority: "low", department: "Sanitation", minutesAgo: 190 },
];

export const explainability = [
  { label: "Office rush intensity", value: 48 },
  { label: "Active road work", value: 31 },
  { label: "Rainfall delay", value: 13 },
  { label: "Recent accident", value: 8 },
];

export const systemStatus = [
  { label: "Traffic Network", status: "live" as const },
  { label: "Weather", status: "live" as const },
  { label: "Vision AI", status: "live" as const },
  { label: "GPS", status: "live" as const },
  { label: "AI Monitoring", status: "live" as const },
];

export const dailyBrief = [
  { icon: "critical", label: "2 critical incidents active", href: "/alerts" },
  { icon: "predict", label: "5 congestion hotspots predicted for peak hours", href: "/map" },
  { icon: "predict", label: "Safe Mobility Corridor active · MG Road & Vytilla", href: "/map" },
  { icon: "peak", label: "Peak traffic expected at 6:15 PM", href: "/transit" },
];

export interface AgentMessage {
  agent: "Traffic Agent" | "Weather Agent" | "Emergency Agent" | "Police Agent" | "Master AI";
  text: string;
  ms: number; // delay before appearing
}

export const agentTranscripts: Record<string, AgentMessage[]> = {
  default: [
    { agent: "Traffic Agent", text: "Analysing congestion at Kundannoor. Density 142 vph, +48% above baseline.", ms: 300 },
    { agent: "Weather Agent", text: "Rainfall intensity 8mm/hr, expected to drop below 4mm/hr in 20 min.", ms: 1400 },
    { agent: "Emergency Agent", text: "Nearest ambulance K-14, ETA 4m via SA Road green corridor.", ms: 2400 },
    { agent: "Police Agent", text: "Deploying 3 officers from Vytilla station to clear lanes 2-3.", ms: 3400 },
    { agent: "Master AI", text: "Green corridor active. Rerouting 1,240 vehicles. Estimated clearance 14 min.", ms: 4500 },
  ],
  flood: [
    { agent: "Weather Agent", text: "Rainfall 12mm/hr sustained; catchment saturation 84% at Marine Drive.", ms: 300 },
    { agent: "Traffic Agent", text: "Downstream junctions Kaloor, MG Road at risk in 20-35 min.", ms: 1400 },
    { agent: "Emergency Agent", text: "Standing by 2 rescue units at Marine Drive walkway.", ms: 2400 },
    { agent: "Police Agent", text: "Pre-positioning barricades for lane closures.", ms: 3400 },
    { agent: "Master AI", text: "Recommend closing Marine Drive north lane 6:30 PM. Alternate: Banerji Rd.", ms: 4500 },
  ],
};

export const decisionSteps = [
  "Incident Reported",
  "Vision Analysis",
  "Traffic Prediction",
  "Weather Analysis",
  "Police Assignment",
  "Emergency Dispatch",
  "Citizen Notification",
  "Resolved",
] as const;

export interface Notification {
  id: string;
  kind: "critical" | "warning" | "resolved" | "system";
  title: string;
  body: string;
  minutesAgo: number;
  read: boolean;
}

export const notifications: Notification[] = [
  { id: "N-1", kind: "critical", title: "Accident at Kundannoor", body: "Ambulance dispatched. Green corridor active.", minutesAgo: 4, read: false },
  { id: "N-2", kind: "critical", title: "Container truck NH-66", body: "Lanes 2-3 closed. Fire unit F-3 en route.", minutesAgo: 31, read: false },
  { id: "N-3", kind: "warning", title: "Flood watch: Marine Drive", body: "Rainfall 12mm/hr sustained.", minutesAgo: 12, read: false },
  { id: "N-4", kind: "resolved", title: "Signal outage cleared", body: "Palarivattom flyover restored.", minutesAgo: 92, read: true },
  { id: "N-5", kind: "system", title: "Vision AI model updated", body: "CCTV inference latency improved 22%.", minutesAgo: 180, read: true },
];

export const suggestedPrompts = [
  "Explain congestion at Vytilla",
  "Predict flood at Kundannoor",
  "Show all accidents",
  "Nearest ambulance",
  "Generate morning report",
  "Run city simulation",
];

export const cannedReplies: Record<string, string> = {
  default:
    "I'm Sentinel — your Kochi city AI. Ask about traffic, flood risk, incidents, or run a simulation.",
  "Explain congestion at Vytilla":
    "**Vytilla Hub congestion** is running 48% above baseline right now.\n\n- **Office rush**: 48%\n- **Road work near Vytilla flyover**: 31%\n- **Light rain slowdown**: 13%\n- **Recent minor accident**: 8%\n\nI've rerouted 1,240 vehicles via NH-66 bypass. Expected clearance in 14 min.",
  "Predict flood at Kundannoor":
    "Flood probability at **Kundannoor** in the next 3 hours: **low (18%)**.\nUpstream catchment at 62% saturation. Rainfall forecast peaks at 6mm/hr around 7:30 PM.\n\nI'm keeping pumps on standby and monitoring the culvert at SA Road.",
  "Show all accidents":
    "**Active accidents (2)**\n\n1. Kundannoor Jn. — multi-vehicle collision · 97% confidence · Ambulance K-14 en route.\n2. NH-66 Edappally — container truck overturned · 99% confidence · Fire unit F-3 dispatched.",
  "Nearest ambulance":
    "Nearest available ambulance to your current view: **K-14**, 1.8 km away, ETA 4 min via green corridor on SA Road.",
  "Generate morning report":
    "**Kochi morning brief · 8:00 AM**\n\n- City health score: **87/100**\n- Traffic: heavy at Vytilla, Edappally\n- Weather: light showers till 10 AM\n- 3 active incidents, 1 warning\n- Recommendation: stagger metro frequency +2 trains between 8:30–9:30 AM.",
  "Run city simulation":
    "Opening the simulator. Try: *'What happens if a container truck overturns at Kundannoor during heavy rain?'*",
};

export function replyFor(prompt: string): string {
  const trimmed = prompt.trim();
  if (cannedReplies[trimmed]) return cannedReplies[trimmed];
  const lower = trimmed.toLowerCase();
  if (lower.includes("vytilla")) return cannedReplies["Explain congestion at Vytilla"];
  if (lower.includes("flood") || lower.includes("kundannoor")) return cannedReplies["Predict flood at Kundannoor"];
  if (lower.includes("accident")) return cannedReplies["Show all accidents"];
  if (lower.includes("ambulance")) return cannedReplies["Nearest ambulance"];
  if (lower.includes("report") || lower.includes("morning")) return cannedReplies["Generate morning report"];
  if (lower.includes("simulate") || lower.includes("simulation")) return cannedReplies["Run city simulation"];
  if (/^(hi|hello|hey|greetings|hola|namaste)/i.test(lower)) {
    return "Hello! I am **CityTwin AI**, your intelligent digital twin assistant for Kochi city. How can I assist you with traffic monitoring, flood predictions, signal controls, or emergency dispatching today?";
  }
  return `I'm **CityTwin AI**, actively monitoring urban operations across Kochi (Vytilla, Kundannoor, Marine Drive, Edappally). Ask me about traffic congestion, flood warnings, signal optimization, or emergency rerouting!`;
}

export const floodAreas = [
  { area: "Marine Drive", risk: 78, water: "0.42 m", trend: "rising" },
  { area: "Vytilla", risk: 41, water: "0.18 m", trend: "steady" },
  { area: "Kundannoor", risk: 22, water: "0.09 m", trend: "steady" },
  { area: "Kakkanad", risk: 12, water: "0.04 m", trend: "falling" },
  { area: "Edappally", risk: 34, water: "0.15 m", trend: "rising" },
];

export const rainfallHourly = [2, 3, 4, 6, 8, 10, 12, 11, 9, 6, 4, 3];

export const transitLines = [
  { line: "Aluva ↔ Petta (Blue)", frequency: "4 min", load: 82, extra: "+2 trains" },
  { line: "Kakkanad extension (Pink)", frequency: "8 min", load: 61, extra: "on schedule" },
];

export const busDemand = [
  { corridor: "Vytilla ↔ Kakkanad", demand: 88, recommend: "+4 buses" },
  { corridor: "Aluva ↔ MG Road", demand: 72, recommend: "+2 buses" },
  { corridor: "Edappally ↔ Marine Dr", demand: 58, recommend: "on schedule" },
  { corridor: "Kaloor ↔ Kakkanad", demand: 44, recommend: "on schedule" },
];

export const simulationScenarios = [
  { id: "accident", label: "Accident", where: "Kundannoor Jn." },
  { id: "rain", label: "Heavy Rain", where: "Ernakulam" },
  { id: "flood", label: "Flood", where: "Marine Drive" },
  { id: "closure", label: "Road Closure", where: "NH-66" },
  { id: "festival", label: "Festival", where: "MG Road" },
  { id: "truck", label: "Container Truck Accident", where: "Kundannoor + Rain" },
];

export const simulationResult = {
  scenario: "Container truck accident at Kundannoor during heavy rain",
  traffic: { impact: "+142%", note: "Backup 4.2 km on NH-66 southbound" },
  emergency: { impact: "+9 min", note: "Ambulance ETA delayed by ponding" },
  metro: { impact: "+22%", note: "Ridership spike on Blue line" },
  police: { impact: "12 officers", note: "Deploy from Vytilla + Aluva stations" },
  closure: { impact: "3 roads", note: "SA Rd, NH-66 lane 2-3, Kundannoor south" },
  clearance: "~46 min",
};

export interface ReplayEvent {
  time: string; // HH:MM
  label: string;
  actualLatencyMin: number;
  aiLatencyMin: number;
}

export const replayTimeline: ReplayEvent[] = [
  { time: "08:12", label: "Congestion begins Vytilla", actualLatencyMin: 22, aiLatencyMin: 6 },
  { time: "08:41", label: "Accident: SA Road", actualLatencyMin: 14, aiLatencyMin: 4 },
  { time: "09:03", label: "Metro surge MG Road", actualLatencyMin: 18, aiLatencyMin: 5 },
  { time: "09:28", label: "Flood watch Marine Dr", actualLatencyMin: 26, aiLatencyMin: 7 },
  { time: "10:12", label: "Signal outage Palarivattom", actualLatencyMin: 12, aiLatencyMin: 3 },
];

export const routingPresets = [
  { vehicle: "Ambulance K-14", from: "Ernakulam Medical Trust", to: "Kundannoor Jn.", eta: "4m", saved: "9m", green: true },
  { vehicle: "Police Van P-08", from: "Vytilla Station", to: "NH-66 Edappally", eta: "7m", saved: "5m", green: true },
  { vehicle: "Fire Unit F-3", from: "Kaloor Fire Stn.", to: "NH-66 Edappally", eta: "9m", saved: "6m", green: true },
];
