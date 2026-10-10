import { useEffect, useRef, useState, useCallback } from "react";
import { type Incident } from "@/data/kochi";
import { cn } from "@/lib/utils";
import { useSentinelStore, schematicToLngLat } from "@/lib/store";
import { 
  Video, 
  Navigation, 
  CheckCircle, 
  Zap, 
  Layers, 
  RotateCcw, 
  Plus, 
  Minus, 
  Building2, 
  Activity, 
  ShieldCheck, 
  Info,
  X
} from "lucide-react";
import "leaflet/dist/leaflet.css";

interface Props {
  height?: number | string;
  className?: string;
  pins?: Incident[];
  interactive?: boolean;
  routingMode?: boolean;
  startLocation?: { lng: number; lat: number };
  endLocation?: { lng: number; lat: number };
  activeLayers?: string[];
  vehicleType?: string;
}

export type TileLayerType = "satellite_hd" | "osm" | "dark" | "voyager" | "satellite" | "topo";

const TILE_PROVIDERS: Record<TileLayerType, { name: string; url: string; subdomains?: string; maxZoom?: number; attribution: string }> = {
  satellite_hd: {
    name: "HD Satellite & Buildings",
    url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    maxZoom: 20,
    attribution: "&copy; Google Maps & Satellite Imagery",
  },
  osm: {
    name: "OpenStreetMap (Standard)",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: "abc",
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  },
  dark: {
    name: "Dark Matter 3D",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    subdomains: "abcd",
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors & CARTO",
  },
  voyager: {
    name: "Carto Voyager (Light)",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    subdomains: "abcd",
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors & CARTO",
  },
  satellite: {
    name: "Esri Satellite Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
    attribution: "&copy; Esri, Maxar, Earthstar Geographics",
  },
  topo: {
    name: "OpenTopoMap (Topographic)",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    subdomains: "abc",
    maxZoom: 17,
    attribution: "&copy; OpenTopoMap contributors",
  },
};

const KOCHI_CENTER: [number, number] = [9.9822, 76.3116]; // [lat, lng]

export interface KochiBuilding {
  id: string;
  name: string;
  category: "Shopping & Retail" | "Sports & Stadium" | "Commercial & IT" | "Healthcare" | "Judicial & Govt" | "Transit & Marine" | "Luxury Hotel";
  floors: number;
  heightMeters: number;
  occupancy: string;
  safetyStatus: "Optimal" | "Monitored" | "Caution";
  iconEmoji: string;
  center: [number, number];
  polygon: [number, number][];
  description: string;
}

export const KOCHI_BUILDINGS: KochiBuilding[] = [
  {
    id: "bldg-lulu",
    name: "Lulu International Shopping Mall",
    category: "Shopping & Retail",
    floors: 5,
    heightMeters: 32,
    occupancy: "4,820 visitors (68% capacity)",
    safetyStatus: "Optimal",
    iconEmoji: "🛍️",
    center: [10.0286, 76.3086],
    polygon: [
      [10.0270, 76.3065],
      [10.0305, 76.3065],
      [10.0305, 76.3105],
      [10.0270, 76.3105],
    ],
    description: "One of India's largest retail shopping destinations with multi-level parking and automated fire suppression sensors.",
  },
  {
    id: "bldg-stadium",
    name: "Jawaharlal Nehru International Stadium",
    category: "Sports & Stadium",
    floors: 6,
    heightMeters: 38,
    occupancy: "Off-peak · 340 staff & visitors",
    safetyStatus: "Optimal",
    iconEmoji: "🏟️",
    center: [10.0003, 76.3005],
    polygon: [
      [9.9980, 76.2990],
      [10.0010, 76.2975],
      [10.0028, 76.3005],
      [10.0002, 76.3035],
    ],
    description: "60,000-seater multipurpose international stadium with direct Kochi Metro corridor connectivity.",
  },
  {
    id: "bldg-marine-towers",
    name: "Marine Drive Skyline & Bay Pride Towers",
    category: "Commercial & IT",
    floors: 24,
    heightMeters: 78,
    occupancy: "1,250 residents & commercial units",
    safetyStatus: "Optimal",
    iconEmoji: "🏙️",
    center: [9.9835, 76.2742],
    polygon: [
      [9.9818, 76.2728],
      [9.9855, 76.2735],
      [9.9850, 76.2760],
      [9.9815, 76.2752],
    ],
    description: "Iconic waterfront skyline towers along the Vembanad backwaters with active coastal weather telemetry.",
  },
  {
    id: "bldg-high-court",
    name: "High Court of Kerala Headquarters",
    category: "Judicial & Govt",
    floors: 9,
    heightMeters: 45,
    occupancy: "2,100 judicial officers & advocates",
    safetyStatus: "Optimal",
    iconEmoji: "⚖️",
    center: [9.9867, 76.2765],
    polygon: [
      [9.9855, 76.2748],
      [9.9885, 76.2755],
      [9.9880, 76.2785],
      [9.9850, 76.2778],
    ],
    description: "State apex judicial center featuring intelligent access controls and emergency response dispatch links.",
  },
  {
    id: "bldg-infopark",
    name: "Infopark Phase 1 — Jyothirmaya & TCS Campus",
    category: "Commercial & IT",
    floors: 14,
    heightMeters: 58,
    occupancy: "8,400 tech workforce",
    safetyStatus: "Optimal",
    iconEmoji: "💻",
    center: [10.0108, 76.3658],
    polygon: [
      [10.0075, 76.3620],
      [10.0135, 76.3625],
      [10.0130, 76.3695],
      [10.0070, 76.3690],
    ],
    description: "Major IT software park housing Fortune 500 tech companies with intelligent smart grid energy management.",
  },
  {
    id: "bldg-smartcity",
    name: "SmartCity Kochi — Pavilion & Towers",
    category: "Commercial & IT",
    floors: 16,
    heightMeters: 66,
    occupancy: "4,600 professionals",
    safetyStatus: "Optimal",
    iconEmoji: "🌐",
    center: [10.0025, 76.3625],
    polygon: [
      [10.0005, 76.3595],
      [10.0050, 76.3600],
      [10.0045, 76.3660],
      [10.0000, 76.3655],
    ],
    description: "Special Economic Zone (SEZ) for international knowledge enterprises with eco-friendly infrastructure.",
  },
  {
    id: "bldg-med-trust",
    name: "Ernakulam Medical Trust Hospital",
    category: "Healthcare",
    floors: 11,
    heightMeters: 46,
    occupancy: "650 bed capacity · ICU active",
    safetyStatus: "Optimal",
    iconEmoji: "🏥",
    center: [9.9620, 76.2942],
    polygon: [
      [9.9602, 76.2925],
      [9.9640, 76.2930],
      [9.9635, 76.2960],
      [9.9598, 76.2955],
    ],
    description: "Designated Level-1 emergency trauma center directly connected to Sentinel Green Corridor prioritization.",
  },
  {
    id: "bldg-aster",
    name: "Aster Medcity Quaternary Hospital Campus",
    category: "Healthcare",
    floors: 8,
    heightMeters: 40,
    occupancy: "720 bed capacity · Trauma bay ready",
    safetyStatus: "Optimal",
    iconEmoji: "🏥",
    center: [10.0392, 76.2735],
    polygon: [
      [10.0368, 76.2700],
      [10.0415, 76.2708],
      [10.0410, 76.2770],
      [10.0365, 76.2762],
    ],
    description: "Integrated super-specialty healthcare facility with rooftop medical helipad and emergency fleet docking.",
  },
  {
    id: "bldg-amrita",
    name: "Amrita Institute of Medical Sciences (AIMS)",
    category: "Healthcare",
    floors: 12,
    heightMeters: 52,
    occupancy: "1,350 patients & 2,800 medical staff",
    safetyStatus: "Optimal",
    iconEmoji: "🏥",
    center: [10.0330, 76.2928],
    polygon: [
      [10.0305, 76.2895],
      [10.0355, 76.2905],
      [10.0350, 76.2960],
      [10.0300, 76.2950],
    ],
    description: "Massive healthcare city with multi-specialty research wings and high-volume emergency patient triage.",
  },
  {
    id: "bldg-vytilla-hub",
    name: "Vytilla Mobility Hub & Metro Terminal",
    category: "Transit & Marine",
    floors: 4,
    heightMeters: 24,
    occupancy: "12,400 commuters/hr",
    safetyStatus: "Monitored",
    iconEmoji: "🚌",
    center: [9.9672, 76.3220],
    polygon: [
      [9.9648, 76.3185],
      [9.9698, 76.3195],
      [9.9690, 76.3255],
      [9.9642, 76.3245],
    ],
    description: "India's premier multimodal transit center linking inter-state buses, Kochi Metro, and Water Metro ferries.",
  },
  {
    id: "bldg-shipyard",
    name: "Cochin Shipyard Heavy Engineering & Drydock",
    category: "Transit & Marine",
    floors: 8,
    heightMeters: 44,
    occupancy: "3,100 maritime engineers",
    safetyStatus: "Optimal",
    iconEmoji: "🚢",
    center: [9.9527, 76.2920],
    polygon: [
      [9.9495, 76.2875],
      [9.9560, 76.2890],
      [9.9550, 76.2965],
      [9.9485, 76.2950],
    ],
    description: "Largest shipbuilding and maritime maintenance facility in India with heavy industrial infrastructure.",
  },
  {
    id: "bldg-grand-hyatt",
    name: "Grand Hyatt & Lulu Bolgatty Convention Centre",
    category: "Luxury Hotel",
    floors: 10,
    heightMeters: 42,
    occupancy: "1,800 guests",
    safetyStatus: "Optimal",
    iconEmoji: "🏨",
    center: [9.9897, 76.2645],
    polygon: [
      [9.9875, 76.2610],
      [9.9922, 76.2618],
      [9.9915, 76.2680],
      [9.9870, 76.2670],
    ],
    description: "Waterfront international convention and luxury hospitality center on scenic Bolgatty Island.",
  },
  {
    id: "bldg-crowne-plaza",
    name: "Crowne Plaza & Le Meridien Towers",
    category: "Luxury Hotel",
    floors: 18,
    heightMeters: 64,
    occupancy: "940 guests & event attendees",
    safetyStatus: "Optimal",
    iconEmoji: "🏨",
    center: [9.9358, 76.3120],
    polygon: [
      [9.9325, 76.3085],
      [9.9390, 76.3095],
      [9.9385, 76.3150],
      [9.9320, 76.3140],
    ],
    description: "High-rise business luxury hotel towers located near Kundannoor Junction along NH-66.",
  },
  {
    id: "bldg-centre-square",
    name: "Centre Square Mall & Multiplex",
    category: "Shopping & Retail",
    floors: 8,
    heightMeters: 36,
    occupancy: "2,300 visitors",
    safetyStatus: "Optimal",
    iconEmoji: "🛍️",
    center: [9.9750, 76.2825],
    polygon: [
      [9.9730, 76.2805],
      [9.9770, 76.2810],
      [9.9765, 76.2845],
      [9.9725, 76.2840],
    ],
    description: "Central downtown shopping mall on MG Road with rooftop entertainment and cinema screens.",
  },
];

export function CityMap({
  height = 480,
  className,
  pins,
  interactive = true,
  routingMode = false,
  startLocation,
  endLocation,
  activeLayers = ["buildings", "traffic", "cctv", "transit", "emergency"],
  vehicleType = "amb",
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const animRef = useRef<any>(null);
  const leafletInstanceRef = useRef<any>(null);

  const { incidents, resolveIncident, greenCorridorActive } = useSentinelStore();

  // Dynamic light/dark theme tracking
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  // Selected Tile Provider (Default to satellite_hd for maximum building visibility or osm)
  const [tileStyle, setTileStyle] = useState<TileLayerType>("satellite_hd");
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Selected marker / building details for popups
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedCctv, setSelectedCctv] = useState<any | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<KochiBuilding | null>(null);
  const [showAiExplanation, setShowAiExplanation] = useState(false);

  // Routing metrics
  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: number;
    durationMin: number;
    timeSavedMin: number;
    geometry: [number, number][];
  } | null>(null);

  // Use either custom pins or the store incidents
  const displayPins = pins || incidents;

  // Track theme changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains("dark");
      setIsDarkMode(isDark);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isCancelled = false;

    import("leaflet").then((leafletModule) => {
      if (isCancelled || !mapContainerRef.current) return;
      const L = leafletModule.default ?? leafletModule;
      leafletInstanceRef.current = L;

      // Clean up previous map instance if any
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: KOCHI_CENTER,
        zoom: 13,
        zoomControl: false, // We render custom modern zoom buttons
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        attributionControl: false,
      });

      mapRef.current = map;

      // Add Tile Layer
      const config = TILE_PROVIDERS[tileStyle];
      const tileLayer = L.tileLayer(config.url, {
        maxZoom: config.maxZoom || 19,
        subdomains: config.subdomains || "abc",
        attribution: config.attribution,
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      // Create Layer Groups
      const layerGroup = L.layerGroup().addTo(map);
      const routeLayer = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;
      routeLayerRef.current = routeLayer;

      // Invalidate size on mount to ensure tiles load seamlessly
      const invalidate = () => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      };
      invalidate();
      setTimeout(invalidate, 150);
      setTimeout(invalidate, 500);
    });

    return () => {
      isCancelled = true;
      if (animRef.current) {
        clearInterval(animRef.current);
        animRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Switch Tile Layer on style change
  useEffect(() => {
    if (!mapRef.current || !leafletInstanceRef.current) return;
    const L = leafletInstanceRef.current;
    const config = TILE_PROVIDERS[tileStyle];

    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    const newTileLayer = L.tileLayer(config.url, {
      maxZoom: config.maxZoom || 19,
      subdomains: config.subdomains || "abc",
      attribution: config.attribution,
    }).addTo(mapRef.current);

    tileLayerRef.current = newTileLayer;

    // Bring feature layers above new base tile layer
    if (layerGroupRef.current && mapRef.current.hasLayer(layerGroupRef.current)) {
      layerGroupRef.current.bringToFront();
    }
    if (routeLayerRef.current && mapRef.current.hasLayer(routeLayerRef.current)) {
      routeLayerRef.current.bringToFront();
    }
  }, [tileStyle]);

  // Update Overlays, 3D Buildings, Incident Pins, CCTV, and Metro
  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current || !leafletInstanceRef.current) return;
    const L = leafletInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    // 1. 3D Architectural Buildings & Landmark Polygons
    if (activeLayers.includes("buildings")) {
      KOCHI_BUILDINGS.forEach((bldg) => {
        // Draw 3D Shaded Extruded Polygon Footprint
        const polygon = L.polygon(bldg.polygon, {
          color: isDarkMode ? "#38bdf8" : "#2563eb",
          weight: 2,
          fillColor: isDarkMode ? "#0284c7" : "#3b82f6",
          fillOpacity: isDarkMode ? 0.45 : 0.35,
          dashArray: "3, 3",
          className: "leaflet-3d-building-polygon cursor-pointer transition-all hover:fill-opacity-70",
        }).addTo(layerGroup);

        polygon.on("click", () => {
          setSelectedBuilding(bldg);
          setSelectedIncident(null);
          setSelectedCctv(null);
          mapRef.current?.flyTo(bldg.center, 15, { duration: 0.8 });
        });

        // Building 3D Pin / Label Marker
        const bldgHtml = `
          <div class="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-card/95 border border-border shadow-lg backdrop-blur-md cursor-pointer transition-transform hover:scale-105 select-none whitespace-nowrap">
            <span class="text-xs">${bldg.iconEmoji}</span>
            <div class="flex flex-col text-left">
              <span class="text-[10px] font-bold text-foreground leading-tight">${bldg.name}</span>
              <span class="text-[8.5px] font-mono text-primary">${bldg.floors} Floors · ${bldg.heightMeters}m</span>
            </div>
          </div>
        `;

        const bldgIcon = L.divIcon({
          html: bldgHtml,
          className: "custom-building-icon",
          iconSize: [160, 32],
          iconAnchor: [80, 16],
        });

        const bldgMarker = L.marker(bldg.center, { icon: bldgIcon }).addTo(layerGroup);
        bldgMarker.on("click", () => {
          setSelectedBuilding(bldg);
          setSelectedIncident(null);
          setSelectedCctv(null);
          mapRef.current?.flyTo(bldg.center, 15, { duration: 0.8 });
        });
      });
    }

    // 2. Traffic Congestion Flow Lines
    if (activeLayers.includes("traffic")) {
      const trafficCorridors = [
        { name: "Vytilla - Kundannoor Bypass", coords: [[9.9678, 76.3218], [9.952, 76.318], [9.9366, 76.3116]], color: "#ef4444", status: "Severe Congestion (12 km/h)" },
        { name: "Edappally - Palarivattom NH-66", coords: [[10.0250, 76.3090], [10.015, 76.305], [10.0076, 76.3120]], color: "#f97316", status: "Moderate Queue (22 km/h)" },
        { name: "MG Road - Ravipuram", coords: [[9.9722, 76.2828], [9.965, 76.289], [9.958, 76.294]], color: "#22c55e", status: "Fluid Transit (38 km/h)" },
      ];

      trafficCorridors.forEach((corr) => {
        L.polyline(corr.coords as [number, number][], {
          color: corr.color,
          weight: 5,
          opacity: 0.8,
        }).addTo(layerGroup);
      });
    }

    // 3. Transit Line & Metro Stations (Kochi Metro)
    if (activeLayers.includes("transit")) {
      const metroStations = [
        { name: "Aluva Station", coord: [10.080, 76.350] as [number, number] },
        { name: "Edappally Station", coord: [10.024, 76.316] as [number, number] },
        { name: "Palarivattom Station", coord: [10.003, 76.299] as [number, number] },
        { name: "MG Road Station", coord: [9.972, 76.282] as [number, number] },
        { name: "Vytilla Hub Station", coord: [9.967, 76.321] as [number, number] },
        { name: "Tripunithura Terminal", coord: [9.955, 76.345] as [number, number] },
      ];

      const metroCoords = metroStations.map((s) => s.coord);

      L.polyline(metroCoords, {
        color: "#a855f7",
        weight: 4,
        opacity: 0.85,
        dashArray: "6, 6",
      }).addTo(layerGroup);

      metroStations.forEach((st) => {
        const icon = L.divIcon({
          html: `<div class="grid size-5 place-items-center rounded-full bg-purple-600 text-white border-2 border-white shadow-md text-[9px] font-bold">M</div>`,
          className: "custom-metro-icon",
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        L.marker(st.coord, { icon }).addTo(layerGroup);
      });
    }

    // 4. Incident Markers with Severity Badges
    displayPins.forEach((p) => {
      const lng = p.lng ?? schematicToLngLat(p.x, p.y)[0];
      const lat = p.lat ?? schematicToLngLat(p.x, p.y)[1];

      const colorClass =
        p.severity === "critical"
          ? "bg-red-500 shadow-red-500/50 ring-red-400"
          : p.severity === "warning"
            ? "bg-amber-500 shadow-amber-500/50 ring-amber-400"
            : p.severity === "resolved"
              ? "bg-emerald-500 shadow-emerald-500/50 ring-emerald-400"
              : "bg-blue-500 shadow-blue-500/50 ring-blue-400";

      const html = `
        <div class="relative flex items-center justify-center cursor-pointer group">
          <span class="relative flex h-5 w-5">
            <span class="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${p.severity === 'critical' ? 'bg-red-400' : 'hidden'}"></span>
            <span class="relative inline-flex rounded-full h-5 w-5 border-2 border-white dark:border-black ${colorClass} shadow-lg ring-2"></span>
          </span>
        </div>
      `;

      const icon = L.divIcon({
        html,
        className: "custom-incident-icon",
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(layerGroup);

      marker.on("click", () => {
        setSelectedIncident(p);
        setSelectedCctv(null);
        setSelectedBuilding(null);
        setShowAiExplanation(false);
        mapRef.current?.flyTo([lat, lng], 14, { duration: 0.8 });
      });
    });

    // 5. CCTV Cameras
    if (activeLayers.includes("cctv")) {
      const cctvFeeds = [
        { id: "CAM-14", location: "Vytilla Junction", lng: 76.3218, lat: 9.9678, status: "alert", vehicles: "142 veh/min", anomaly: "Queue spillback" },
        { id: "CAM-22", location: "MG Road", lng: 76.2828, lat: 9.9722, status: "normal", vehicles: "88 veh/min", anomaly: "Clear flow" },
        { id: "CAM-09", location: "Kundannoor", lng: 76.3116, lat: 9.9366, status: "critical", vehicles: "164 veh/min", anomaly: "Disabled heavy truck" },
        { id: "CAM-18", location: "Edappally NH-66", lng: 76.3090, lat: 10.0250, status: "critical", vehicles: "180 veh/min", anomaly: "High density bottleneck" },
        { id: "CAM-07", location: "Kakkanad", lng: 76.3533, lat: 10.0159, status: "normal", vehicles: "95 veh/min", anomaly: "Optimal" },
      ];

      cctvFeeds.forEach((cam) => {
        const bgClass =
          cam.status === "critical"
            ? "bg-rose-600 text-white"
            : cam.status === "alert"
              ? "bg-amber-500 text-white"
              : "bg-primary text-white";

        const html = `
          <div class="grid size-7 place-items-center rounded-xl border border-white dark:border-black ${bgClass} shadow-lg cursor-pointer transition-transform hover:scale-110">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
          </div>
        `;

        const icon = L.divIcon({
          html,
          className: "custom-cctv-icon",
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([cam.lat, cam.lng], { icon }).addTo(layerGroup);

        marker.on("click", () => {
          setSelectedCctv(cam);
          setSelectedIncident(null);
          setSelectedBuilding(null);
          mapRef.current?.flyTo([cam.lat, cam.lng], 14, { duration: 0.8 });
        });
      });
    }
  }, [displayPins, activeLayers, isDarkMode]);

  // Handle Routing & Vehicle Movement
  useEffect(() => {
    if (!mapRef.current || !routeLayerRef.current || !leafletInstanceRef.current) return;
    const L = leafletInstanceRef.current;
    const routeLayer = routeLayerRef.current;

    if (animRef.current) {
      clearInterval(animRef.current);
      animRef.current = null;
    }

    routeLayer.clearLayers();

    if (!routingMode || !startLocation || !endLocation) {
      setRouteInfo(null);
      return;
    }

    const fetchRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${startLocation.lng},${startLocation.lat};${endLocation.lng},${endLocation.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coords = route.geometry.coordinates as [number, number][];
          const latLngs: [number, number][] = coords.map(([lng, lat]) => [lat, lng]);

          const distanceKm = +(route.distance / 1000).toFixed(1);
          const baseDuration = Math.round(route.duration / 60);
          const durationMin = greenCorridorActive ? Math.round(baseDuration * 0.7) : baseDuration;
          const timeSavedMin = greenCorridorActive ? Math.round(baseDuration * 0.3) : 0;

          setRouteInfo({
            distanceKm,
            durationMin,
            timeSavedMin,
            geometry: coords,
          });

          // 1. Draw Route Polyline
          const polyline = L.polyline(latLngs, {
            color: greenCorridorActive ? "#10b981" : "#3b82f6",
            weight: 6,
            opacity: 0.85,
          }).addTo(routeLayer);

          // 2. Start Pin
          const startHtml = `<div class="grid size-6 place-items-center rounded-full bg-emerald-500 text-white font-bold text-[10px] shadow-md border-2 border-white dark:border-black">A</div>`;
          const startIcon = L.divIcon({ html: startHtml, className: "custom-pin-start", iconSize: [24, 24], iconAnchor: [12, 12] });
          L.marker(latLngs[0], { icon: startIcon }).addTo(routeLayer);

          // 3. End Pin
          const endHtml = `<div class="grid size-6 place-items-center rounded-full bg-rose-500 text-white font-bold text-[10px] shadow-md border-2 border-white dark:border-black">B</div>`;
          const endIcon = L.divIcon({ html: endHtml, className: "custom-pin-end", iconSize: [24, 24], iconAnchor: [12, 12] });
          L.marker(latLngs[latLngs.length - 1], { icon: endIcon }).addTo(routeLayer);

          // 4. Vehicle Marker
          const vehicleEmoji = vehicleType === "pol" ? "🚓" : vehicleType === "fire" ? "🚒" : "🚑";
          const badgeBg = vehicleType === "pol" ? "bg-blue-600" : vehicleType === "fire" ? "bg-red-600" : "bg-emerald-500";

          const vehicleHtml = `
            <div class="relative flex items-center justify-center">
              <div class="flex items-center justify-center size-8 rounded-full ${badgeBg} text-white shadow-xl border-2 border-white dark:border-black text-sm animate-pulse-soft">
                ${vehicleEmoji}
              </div>
            </div>
          `;

          const vehicleIcon = L.divIcon({
            html: vehicleHtml,
            className: "custom-vehicle-anim-icon",
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });

          const vehicleMarker = L.marker(latLngs[0], { icon: vehicleIcon }).addTo(routeLayer);

          // Fit bounds
          mapRef.current?.fitBounds(polyline.getBounds(), { padding: [40, 40] });

          // 5. Animate moving vehicle along route
          let stepIndex = 0;
          const totalSteps = latLngs.length;

          if (totalSteps > 1) {
            const speed = greenCorridorActive ? 250 : 450;
            animRef.current = setInterval(() => {
              stepIndex = (stepIndex + 1) % totalSteps;
              const nextPos = latLngs[stepIndex];
              vehicleMarker.setLatLng(nextPos);
            }, speed);
          }
        }
      } catch (err) {
        console.error("OSRM Route fetching error:", err);
      }
    };

    fetchRoute();

    return () => {
      if (animRef.current) {
        clearInterval(animRef.current);
        animRef.current = null;
      }
    };
  }, [routingMode, startLocation, endLocation, greenCorridorActive, vehicleType]);

  const handleRecenter = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.flyTo(KOCHI_CENTER, 13, { duration: 1 });
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut();
  }, []);

  const heightStyle = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm w-full select-none", className)}
      style={{ height: heightStyle }}
    >
      {/* The Leaflet Map Container */}
      <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} className="z-0 w-full h-full" />

      {/* Modern Leaflet UI Controls (Top Right: Style Switcher) */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
        {/* Layer / Base Style Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            title="Switch Map Style"
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card/90 px-3 py-2 text-xs font-semibold text-foreground shadow-md backdrop-blur-md hover:bg-secondary transition-all cursor-pointer"
          >
            <Layers className="size-3.5 text-primary" />
            <span className="hidden sm:inline">{TILE_PROVIDERS[tileStyle].name}</span>
          </button>

          {showLayerMenu && (
            <div className="absolute right-0 mt-1 w-52 rounded-2xl border border-border bg-card/95 p-1.5 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95">
              <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Map & Satellite Style
              </p>
              {(Object.keys(TILE_PROVIDERS) as TileLayerType[]).map((styleKey) => (
                <button
                  key={styleKey}
                  onClick={() => {
                    setTileStyle(styleKey);
                    setShowLayerMenu(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer",
                    tileStyle === styleKey
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-foreground hover:bg-secondary"
                  )}
                >
                  <span>{TILE_PROVIDERS[styleKey].name}</span>
                  {tileStyle === styleKey && <CheckCircle className="size-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Zoom & Recenter Controls (Bottom Right - Hidden on Mobile) */}
      <div className="absolute bottom-10 right-3 z-20 hidden sm:flex flex-col rounded-xl border border-border bg-card/90 shadow-md backdrop-blur-md overflow-hidden divide-y divide-border w-8">
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="size-8 flex items-center justify-center text-foreground hover:bg-secondary transition-colors cursor-pointer"
        >
          <Plus className="size-3.5" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="size-8 flex items-center justify-center text-foreground hover:bg-secondary transition-colors cursor-pointer"
        >
          <Minus className="size-3.5" />
        </button>
        <button
          onClick={handleRecenter}
          title="Recenter to Kochi"
          className="size-8 flex items-center justify-center text-foreground hover:bg-secondary transition-colors cursor-pointer"
        >
          <RotateCcw className="size-3.5 text-primary" />
        </button>
      </div>

      {/* 3D Buildings & Map Attribution Badge (Bottom Right) */}
      <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/85 px-2.5 py-1 text-[9.5px] font-medium text-muted-foreground shadow-xs backdrop-blur-sm">
        <Building2 className="size-3 text-primary" />
        <span>3D Urban Buildings Active · {TILE_PROVIDERS[tileStyle].name}</span>
      </div>

      {/* Selected 3D Building Popup Panel */}
      {selectedBuilding && (
        <div className="absolute bottom-4 left-4 right-4 z-20 max-w-md rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 lg:left-4 lg:right-auto">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="text-2xl">{selectedBuilding.iconEmoji}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-sm">{selectedBuilding.name}</span>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold text-primary uppercase">
                    {selectedBuilding.category}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {selectedBuilding.description}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedBuilding(null)}
              className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-3.5 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-secondary/70 p-2 border border-border/40">
              <span className="text-[9px] text-muted-foreground block uppercase font-mono">Floors / Height</span>
              <span className="font-bold text-foreground">{selectedBuilding.floors} Floors ({selectedBuilding.heightMeters}m)</span>
            </div>
            <div className="rounded-xl bg-secondary/70 p-2 border border-border/40">
              <span className="text-[9px] text-muted-foreground block uppercase font-mono">Live Occupancy</span>
              <span className="font-bold text-foreground text-[10.5px] truncate block">{selectedBuilding.occupancy}</span>
            </div>
            <div className="rounded-xl bg-secondary/70 p-2 border border-border/40">
              <span className="text-[9px] text-muted-foreground block uppercase font-mono">Safety Status</span>
              <span className="font-bold text-emerald-600 flex items-center justify-center gap-1">
                <ShieldCheck className="size-3" />
                {selectedBuilding.safetyStatus}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Selected Incident Popup Panel */}
      {selectedIncident && (
        <div className="absolute bottom-4 left-4 right-4 z-20 max-w-md rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 lg:left-4 lg:right-auto">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-sm">{selectedIncident.title}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                    selectedIncident.severity === "critical"
                      ? "bg-destructive/20 text-destructive"
                      : selectedIncident.severity === "warning"
                        ? "bg-warn/20 text-warn"
                        : "bg-success/20 text-success"
                  )}
                >
                  {selectedIncident.severity}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedIncident.location} · {selectedIncident.department} · {selectedIncident.minutesAgo}m ago
              </p>
            </div>
            <button
              onClick={() => setSelectedIncident(null)}
              className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => {
                resolveIncident(selectedIncident.id);
                setSelectedIncident(null);
              }}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-success px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:opacity-90 cursor-pointer"
            >
              <CheckCircle className="size-3.5" />
              Resolve Incident
            </button>
            <button
              onClick={() => setShowAiExplanation(!showAiExplanation)}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent cursor-pointer"
            >
              <Zap className="size-3.5 text-primary" />
              {showAiExplanation ? "Hide AI Logic" : "AI Explain"}
            </button>
          </div>

          {showAiExplanation && (
            <div className="mt-3 rounded-xl bg-secondary/80 p-3 text-xs text-muted-foreground animate-in fade-in">
              <p className="font-semibold text-foreground">AI Dispatch Logic:</p>
              <p className="mt-1">
                Anomaly detected via sensor telemetry. Rerouted nearest municipal unit and prioritized signal phase clearing along Kochi arterial corridors.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Selected CCTV Popup Panel */}
      {selectedCctv && (
        <div className="absolute bottom-4 left-4 right-4 z-20 max-w-md rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 lg:left-4 lg:right-auto">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Video className="size-4 text-primary" />
                <span className="font-semibold text-foreground text-sm">{selectedCctv.id} · {selectedCctv.location}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Vision AI Stream · Active Object Detection</p>
              <div className="mt-2 flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
                <span className="rounded-md bg-secondary px-2 py-0.5">{selectedCctv.vehicles}</span>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-warn">{selectedCctv.anomaly}</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedCctv(null)}
              className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Routing Info Overlay Badge */}
      {routingMode && routeInfo && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-3 rounded-2xl border border-border bg-card/90 px-4 py-2.5 shadow-lg backdrop-blur-md">
          <Navigation className="size-4 text-primary animate-pulse" />
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <span>{routeInfo.distanceKm} km</span>
              <span>•</span>
              <span className="text-success">{routeInfo.durationMin} mins</span>
              {routeInfo.timeSavedMin > 0 && (
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success font-medium">
                  -{routeInfo.timeSavedMin}m Green Corridor
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
