import { useEffect, useRef, useState, useCallback } from "react";
import { useSentinelStore, schematicToLngLat } from "@/lib/store";
import { type Incident } from "@/data/kochi";
import { cn } from "@/lib/utils";
import {
  Layers,
  Sun,
  Moon,
  Compass,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  CloudRain,
  Ambulance,
  AlertTriangle,
  Building2,
  Video,
  Navigation,
  CheckCircle2,
  Shield,
  Activity,
  X,
  Maximize2
} from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";

const OPENFREEMAP_LIBERTY_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const CARTO_DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const CARTO_VOYAGER_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

const KOCHI_CENTER: [number, number] = [76.2673, 9.9312]; // [lng, lat]

export interface CityMap3DProps {
  rainfallMm?: number;
  onRainfallChange?: (val: number) => void;
  activeScenario?: "none" | "monsoon" | "ambulance" | "rush_hour" | "bridge_blocked";
  activeLayers?: {
    incidents: boolean;
    flood: boolean;
    route: boolean;
    cctv: boolean;
    metro: boolean;
    buildings: boolean;
  };
  onLayerToggle?: (layer: string) => void;
}

// Kochi flood-prone polygon definitions (GeoJSON coordinates)
const FLOOD_ZONES = [
  {
    id: "flood-edappally",
    name: "Edappally Canal & Underpass",
    coords: [
      [76.304, 10.021],
      [76.316, 10.021],
      [76.318, 10.032],
      [76.303, 10.031],
      [76.304, 10.021],
    ],
    baseHeight: 18,
    sensitivity: 0.22,
  },
  {
    id: "flood-kaloor",
    name: "Kaloor Stadium Basin",
    coords: [
      [76.294, 9.995],
      [76.307, 9.995],
      [76.308, 10.007],
      [76.294, 10.006],
      [76.294, 9.995],
    ],
    baseHeight: 14,
    sensitivity: 0.18,
  },
  {
    id: "flood-marine-drive",
    name: "Marine Drive Waterfront Corridor",
    coords: [
      [76.269, 9.977],
      [76.279, 9.977],
      [76.280, 9.990],
      [76.269, 9.989],
      [76.269, 9.977],
    ],
    baseHeight: 22,
    sensitivity: 0.25,
  },
  {
    id: "flood-vyttila",
    name: "Vyttila Hub Lowland Catchment",
    coords: [
      [76.314, 9.961],
      [76.329, 9.961],
      [76.330, 9.973],
      [76.314, 9.972],
      [76.314, 9.961],
    ],
    baseHeight: 16,
    sensitivity: 0.20,
  },
];

// Kochi 3D Landmark Buildings
const LANDMARK_BUILDINGS = [
  {
    id: "lulu-mall",
    name: "Lulu International Shopping Mall",
    category: "Shopping & Retail",
    height: 38,
    coords: [
      [76.3065, 10.0270],
      [76.3105, 10.0270],
      [76.3105, 10.0305],
      [76.3065, 10.0305],
      [76.3065, 10.0270],
    ],
    center: [76.3085, 10.0286],
  },
  {
    id: "jn-stadium",
    name: "Jawaharlal Nehru International Stadium",
    category: "Sports & Arena",
    height: 44,
    coords: [
      [76.2980, 9.9980],
      [76.3035, 10.0002],
      [76.3005, 10.0028],
      [76.2975, 10.0010],
      [76.2980, 9.9980],
    ],
    center: [76.3005, 10.0003],
  },
  {
    id: "high-court",
    name: "High Court of Kerala Headquarters",
    category: "Judicial Center",
    height: 48,
    coords: [
      [76.2748, 9.9855],
      [76.2785, 9.9880],
      [76.2778, 9.9850],
      [76.2755, 9.9885],
      [76.2748, 9.9855],
    ],
    center: [76.2765, 9.9867],
  },
  {
    id: "marine-towers",
    name: "Marine Drive Bay Pride Skyline",
    category: "Commercial & Waterfront",
    height: 72,
    coords: [
      [76.2728, 9.9818],
      [76.2760, 9.9850],
      [76.2752, 9.9815],
      [76.2735, 9.9855],
      [76.2728, 9.9818],
    ],
    center: [76.2742, 9.9835],
  },
  {
    id: "infopark-jyothirmaya",
    name: "Infopark Jyothirmaya IT Tower",
    category: "IT Park & Tech SEZ",
    height: 64,
    coords: [
      [76.3620, 10.0075],
      [76.3695, 10.0130],
      [76.3690, 10.0070],
      [76.3625, 10.0135],
      [76.3620, 10.0075],
    ],
    center: [76.3658, 10.0108],
  },
  {
    id: "medical-trust",
    name: "Ernakulam Medical Trust Hospital",
    category: "Emergency Trauma Center",
    height: 50,
    coords: [
      [76.2925, 9.9602],
      [76.2960, 9.9635],
      [76.2955, 9.9598],
      [76.2930, 9.9640],
      [76.2925, 9.9602],
    ],
    center: [76.2942, 9.9620],
  },
  {
    id: "vytilla-hub",
    name: "Vyttila Multimodal Mobility Hub",
    category: "Transit Terminal",
    height: 32,
    coords: [
      [76.3185, 9.9648],
      [76.3255, 9.9690],
      [76.3245, 9.9642],
      [76.3195, 9.9698],
      [76.3185, 9.9648],
    ],
    center: [76.3220, 9.9672],
  },
];

// CCTV Camera locations
const CCTV_CAMERAS = [
  { id: "CAM-14", name: "Vytilla Junction Camera", coords: [76.3218, 9.9678], status: "alert", queue: "148 veh/min" },
  { id: "CAM-22", name: "MG Road Central Camera", coords: [76.2828, 9.9722], status: "normal", queue: "62 veh/min" },
  { id: "CAM-09", name: "Kundannoor Flyover Camera", coords: [76.3116, 9.9366], status: "critical", queue: "Accident detected" },
  { id: "CAM-18", name: "Edappally NH-66 Camera", coords: [76.3090, 10.0250], status: "critical", queue: "Bottleneck queue" },
  { id: "CAM-07", name: "Kakkanad Collectorate Camera", coords: [76.3533, 10.0159], status: "normal", queue: "Fluid transit" },
];

// Metro Stations
const METRO_STATIONS = [
  { name: "Aluva Terminal", coords: [76.350, 10.080] },
  { name: "Edappally Station", coords: [76.316, 10.024] },
  { name: "Palarivattom Station", coords: [76.299, 10.003] },
  { name: "MG Road Station", coords: [76.282, 9.972] },
  { name: "Vytilla Hub Station", coords: [76.321, 9.967] },
  { name: "Tripunithura Terminal", coords: [76.345, 9.955] },
];

// Helper: Generate hexagonal polygon footprint for 3D incident columns
function createHexagonPolygon(lng: number, lat: number, radius = 0.0006): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 * Math.PI) / 180;
    const dx = radius * Math.cos(angle);
    const dy = radius * Math.sin(angle) * 0.82;
    points.push([lng + dx, lat + dy]);
  }
  points.push(points[0]);
  return points;
}

export function CityMap3D({
  rainfallMm = 25,
  activeScenario = "none",
  activeLayers = {
    incidents: true,
    flood: true,
    route: true,
    cctv: true,
    metro: true,
    buildings: true,
  },
}: CityMap3DProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const maplibreInstanceRef = useRef<any>(null);
  const animFrameRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);

  const { incidents } = useSentinelStore();

  const [isNightMode, setIsNightMode] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<any | null>(null);
  const [selectedCctv, setSelectedCctv] = useState<any | null>(null);

  // Auto-tour animation state
  const [isTouring, setIsTouring] = useState(false);

  // 1. Initialize MapLibre GL instance (Client-only)
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isCancelled = false;

    import("maplibre-gl").then((maplibreModule) => {
      if (isCancelled || !mapContainerRef.current) return;
      const maplibregl = (maplibreModule as any).default || maplibreModule;
      maplibreInstanceRef.current = maplibregl;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const styleUrl = isNightMode ? CARTO_DARK_STYLE : OPENFREEMAP_LIBERTY_STYLE;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: styleUrl,
        center: KOCHI_CENTER,
        zoom: 13.8,
        pitch: 60,
        bearing: -20,
        antialias: true,
      });

      mapRef.current = map;

      // Add navigation controls (top-right)
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

      map.on("load", () => {
        if (isCancelled) return;
        initMapLayers(map, maplibregl);
      });
    });

    return () => {
      isCancelled = true;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isNightMode]);

  // 2. Initialize and Register All 3D Vector Layers
  const initMapLayers = (map: any, maplibregl: any) => {
    // A. 3D OpenMapTiles Building Extrusions (if present in vector style)
    try {
      if (!map.getLayer("3d-buildings-osm")) {
        map.addLayer({
          id: "3d-buildings-osm",
          source: "openmaptiles",
          "source-layer": "building",
          type: "fill-extrusion",
          minzoom: 13,
          paint: {
            "fill-extrusion-color": isNightMode ? "#1e293b" : "#cbd5e1",
            "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 16],
            "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
            "fill-extrusion-opacity": isNightMode ? 0.6 : 0.5,
          },
        });
      }
    } catch {
      // Vector source layer may vary across tile providers; custom landmark footprints below provide 100% reliability
    }

    // B. Custom 3D Landmark Extruded Buildings (Lulu, Stadium, High Court, Marine Drive)
    const landmarkGeojson = {
      type: "FeatureCollection",
      features: LANDMARK_BUILDINGS.map((b) => ({
        type: "Feature",
        properties: {
          id: b.id,
          name: b.name,
          category: b.category,
          height: b.height,
        },
        geometry: {
          type: "Polygon",
          coordinates: [b.coords],
        },
      })),
    };

    if (!map.getSource("landmark-buildings-src")) {
      map.addSource("landmark-buildings-src", {
        type: "geojson",
        data: landmarkGeojson,
      });

      map.addLayer({
        id: "landmark-buildings-layer",
        type: "fill-extrusion",
        source: "landmark-buildings-src",
        paint: {
          "fill-extrusion-color": isNightMode ? "#38bdf8" : "#2563eb",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.8,
        },
      });

      map.on("click", "landmark-buildings-layer", (e: any) => {
        const feature = e.features?.[0];
        if (feature) {
          const matched = LANDMARK_BUILDINGS.find((b) => b.id === feature.properties.id);
          if (matched) {
            setSelectedBuilding(matched);
            setSelectedIncident(null);
            setSelectedCctv(null);
          }
        }
      });
    }

    // C. 3D Flood Polygons Layer
    updateFloodSourceAndLayer(map, rainfallMm);

    // D. 3D Incident Columns Layer
    updateIncidentColumns(map);

    // E. Emergency Routes (OSRM Normal + Sentinel AI Green Detour)
    updateEmergencyRoutes(map);

    // F. CCTV & Metro Line
    updateCctvAndMetro(map, maplibregl);
  };

  // Helper: Update 3D Flood Layer dynamically based on rainfall
  const updateFloodSourceAndLayer = useCallback((map: any, rainMm: number) => {
    if (!map || !map.isStyleLoaded()) return;

    const floodFactor = Math.min(1.0, rainMm / 150);
    const floodOpacity = Math.max(0.2, Math.min(0.85, 0.25 + floodFactor * 0.55));

    const floodGeojson = {
      type: "FeatureCollection",
      features: FLOOD_ZONES.map((fz) => {
        const height = Math.max(2, fz.baseHeight * (0.2 + floodFactor * 1.4));
        return {
          type: "Feature",
          properties: {
            id: fz.id,
            name: fz.name,
            height: height,
            rainLevel: rainMm,
          },
          geometry: {
            type: "Polygon",
            coordinates: [fz.coords],
          },
        };
      }),
    };

    if (map.getSource("flood-zones-src")) {
      map.getSource("flood-zones-src").setData(floodGeojson);
      if (map.getLayer("flood-zones-layer")) {
        map.setPaintProperty("flood-zones-layer", "fill-extrusion-opacity", floodOpacity);
        map.setLayoutProperty("flood-zones-layer", "visibility", activeLayers.flood ? "visible" : "none");
      }
    } else {
      map.addSource("flood-zones-src", {
        type: "geojson",
        data: floodGeojson,
      });

      map.addLayer({
        id: "flood-zones-layer",
        type: "fill-extrusion",
        source: "flood-zones-src",
        paint: {
          "fill-extrusion-color": "#06b6d4",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": floodOpacity,
        },
      });
    }
  }, [activeLayers.flood]);

  // Helper: Update 3D Incident Extrusion Columns from Store
  const updateIncidentColumns = useCallback((map: any) => {
    if (!map || !map.isStyleLoaded()) return;

    const incidentFeatures = incidents.map((inc) => {
      const lng = inc.lng ?? schematicToLngLat(inc.x, inc.y)[0];
      const lat = inc.lat ?? schematicToLngLat(inc.x, inc.y)[1];

      const height =
        inc.severity === "critical"
          ? 150
          : inc.severity === "warning"
            ? 95
            : inc.severity === "info"
              ? 55
              : 30;

      const color =
        inc.severity === "critical"
          ? "#ef4444"
          : inc.severity === "warning"
            ? "#f59e0b"
            : inc.severity === "info"
              ? "#3b82f6"
              : "#10b981";

      return {
        type: "Feature",
        properties: {
          id: inc.id,
          title: inc.title,
          location: inc.location,
          severity: inc.severity,
          department: inc.department,
          confidence: inc.confidence,
          minutesAgo: inc.minutesAgo,
          height: height,
          color: color,
        },
        geometry: {
          type: "Polygon",
          coordinates: [createHexagonPolygon(lng, lat)],
        },
      };
    });

    const geojson = {
      type: "FeatureCollection",
      features: incidentFeatures,
    };

    if (map.getSource("incident-columns-src")) {
      map.getSource("incident-columns-src").setData(geojson);
      if (map.getLayer("incident-columns-layer")) {
        map.setLayoutProperty("incident-columns-layer", "visibility", activeLayers.incidents ? "visible" : "none");
      }
    } else {
      map.addSource("incident-columns-src", {
        type: "geojson",
        data: geojson,
      });

      map.addLayer({
        id: "incident-columns-layer",
        type: "fill-extrusion",
        source: "incident-columns-src",
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.9,
        },
      });

      map.on("click", "incident-columns-layer", (e: any) => {
        const feature = e.features?.[0];
        if (feature) {
          const matched = incidents.find((i) => i.id === feature.properties.id);
          if (matched) {
            setSelectedIncident(matched);
            setSelectedBuilding(null);
            setSelectedCctv(null);
          }
        }
      });
    }
  }, [incidents, activeLayers.incidents]);

  // Helper: Emergency Routes & Flood Avoidance comparison
  const updateEmergencyRoutes = useCallback((map: any) => {
    if (!map || !map.isStyleLoaded()) return;

    // Normal Route (Direct through Edappally & Kaloor)
    const normalRouteCoords = [
      [76.3180, 10.0450], // Kalamassery Medical base
      [76.3090, 10.0250], // Edappally Underpass (Waterlogged hotspot)
      [76.3005, 10.0003], // Kaloor Jn
      [76.2828, 9.9722],  // MG Road
      [76.2942, 9.9620],  // Medical Trust Hospital
    ];

    // Safe Sentinel AI Detour Route (via Container Road & NH Bypass)
    const safeRouteCoords = [
      [76.3180, 10.0450], // Kalamassery Medical base
      [76.3350, 10.0380], // Seaport-Airport Rd Bypass
      [76.3533, 10.0159], // Kakkanad Link
      [76.3218, 9.9678],  // Vytilla Flyover Overpass
      [76.2942, 9.9620],  // Medical Trust Hospital
    ];

    const isFloodHazardActive = rainfallMm > 60 || activeScenario === "monsoon" || activeScenario === "bridge_blocked";

    const routesGeojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            id: "normal-route",
            status: isFloodHazardActive ? "blocked" : "active",
          },
          geometry: {
            type: "LineString",
            coordinates: normalRouteCoords,
          },
        },
        {
          type: "Feature",
          properties: {
            id: "safe-route",
            status: "safe",
          },
          geometry: {
            type: "LineString",
            coordinates: safeRouteCoords,
          },
        },
      ],
    };

    if (map.getSource("emergency-routes-src")) {
      map.getSource("emergency-routes-src").setData(routesGeojson);
    } else {
      map.addSource("emergency-routes-src", {
        type: "geojson",
        data: routesGeojson,
      });

      // Normal Route Layer
      map.addLayer({
        id: "normal-route-layer",
        type: "line",
        source: "emergency-routes-src",
        filter: ["==", "id", "normal-route"],
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": isFloodHazardActive ? "#ef4444" : "#3b82f6",
          "line-width": 5,
          "line-dasharray": isFloodHazardActive ? [2, 2] : [1, 0],
          "line-opacity": 0.85,
        },
      });

      // Safe Route Layer (Glowing Green)
      map.addLayer({
        id: "safe-route-layer",
        type: "line",
        source: "emergency-routes-src",
        filter: ["==", "id", "safe-route"],
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#10b981",
          "line-width": 6,
          "line-opacity": 0.95,
        },
      });
    }

    if (map.getLayer("normal-route-layer")) {
      map.setPaintProperty("normal-route-layer", "line-color", isFloodHazardActive ? "#ef4444" : "#3b82f6");
      map.setPaintProperty("normal-route-layer", "line-dasharray", isFloodHazardActive ? [2, 2] : [1, 0]);
      map.setLayoutProperty("normal-route-layer", "visibility", activeLayers.route ? "visible" : "none");
    }
    if (map.getLayer("safe-route-layer")) {
      map.setLayoutProperty("safe-route-layer", "visibility", activeLayers.route ? "visible" : "none");
    }
  }, [rainfallMm, activeScenario, activeLayers.route]);

  // Helper: CCTV & Metro Line
  const updateCctvAndMetro = (map: any, maplibregl: any) => {
    // Clear old HTML markers
    markerRefs.current.forEach((m) => m.remove());
    markerRefs.current = [];

    // Metro Line Polyline
    const metroCoords = METRO_STATIONS.map((s) => s.coords);
    const metroGeojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "Kochi Metro Line" },
          geometry: {
            type: "LineString",
            coordinates: metroCoords,
          },
        },
      ],
    };

    if (!map.getSource("metro-line-src")) {
      map.addSource("metro-line-src", {
        type: "geojson",
        data: metroGeojson,
      });

      map.addLayer({
        id: "metro-line-layer",
        type: "line",
        source: "metro-line-src",
        paint: {
          "line-color": "#a855f7",
          "line-width": 4,
          "line-dasharray": [3, 2],
          "line-opacity": 0.9,
        },
      });
    }

    // Metro Station Markers
    if (activeLayers.metro) {
      METRO_STATIONS.forEach((st) => {
        const el = document.createElement("div");
        el.className = "size-5 rounded-full bg-purple-600 border-2 border-white text-white font-bold text-[8.5px] flex items-center justify-center shadow-md cursor-pointer hover:scale-125 transition-transform";
        el.innerText = "M";
        el.title = st.name;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(st.coords as [number, number])
          .addTo(map);

        markerRefs.current.push(marker);
      });
    }

    // CCTV Camera Markers
    if (activeLayers.cctv) {
      CCTV_CAMERAS.forEach((cam) => {
        const el = document.createElement("div");
        const bg = cam.status === "critical" ? "bg-rose-600" : cam.status === "alert" ? "bg-amber-500" : "bg-primary";
        el.className = `size-7 rounded-xl ${bg} text-white border-2 border-white flex items-center justify-center shadow-lg cursor-pointer hover:scale-125 transition-transform`;
        el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>`;

        el.onclick = () => {
          setSelectedCctv(cam);
          setSelectedIncident(null);
          setSelectedBuilding(null);
        };

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(cam.coords as [number, number])
          .addTo(map);

        markerRefs.current.push(marker);
      });
    }
  };

  // Re-sync dynamic state when props change
  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      updateFloodSourceAndLayer(mapRef.current, rainfallMm);
      updateIncidentColumns(mapRef.current);
      updateEmergencyRoutes(mapRef.current);
    }
  }, [rainfallMm, incidents, activeScenario, updateFloodSourceAndLayer, updateIncidentColumns, updateEmergencyRoutes]);

  // Camera Actions: Fly to Incident
  const handleFlyToIncident = () => {
    if (!mapRef.current) return;
    const critical = incidents.find((i) => i.severity === "critical") || incidents[0];
    if (critical) {
      const lng = critical.lng ?? schematicToLngLat(critical.x, critical.y)[0];
      const lat = critical.lat ?? schematicToLngLat(critical.x, critical.y)[1];
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 16,
        pitch: 65,
        bearing: 40,
        duration: 2000,
      });
      setSelectedIncident(critical);
    }
  };

  // Camera Actions: Auto 360 Tour
  const toggleAutoTour = () => {
    if (!mapRef.current) return;

    if (isTouring) {
      setIsTouring(false);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    } else {
      setIsTouring(true);
      const rotateCamera = () => {
        if (!mapRef.current) return;
        const currentBearing = mapRef.current.getBearing();
        mapRef.current.setBearing(currentBearing + 0.25);
        animFrameRef.current = requestAnimationFrame(rotateCamera);
      };
      rotateCamera();
    }
  };

  return (
    <div className="relative w-full h-full min-h-[540px] rounded-3xl overflow-hidden border border-border shadow-lg bg-slate-900">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Top Map Floating Control Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 flex-wrap bg-background/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-border shadow-md">
        <button
          type="button"
          onClick={() => setIsNightMode(!isNightMode)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 transition-colors text-foreground cursor-pointer"
          title="Toggle Day / Night Mode"
        >
          {isNightMode ? <Sun className="size-3.5 text-amber-400" /> : <Moon className="size-3.5 text-indigo-400" />}
          <span>{isNightMode ? "Day Style" : "Night Style"}</span>
        </button>

        <div className="h-4 w-[1px] bg-border mx-1" />

        <button
          type="button"
          onClick={handleFlyToIncident}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
          title="Fly Camera to Critical Incident"
        >
          <Navigation className="size-3.5" />
          <span>Fly to Incident</span>
        </button>

        <button
          type="button"
          onClick={toggleAutoTour}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer",
            isTouring ? "bg-rose-500 text-white animate-pulse" : "bg-secondary hover:bg-secondary/80 text-foreground"
          )}
          title="360° Panoramic Camera Rotation"
        >
          <Compass className={cn("size-3.5", isTouring && "animate-spin")} />
          <span>{isTouring ? "Stop Tour" : "360° Auto Tour"}</span>
        </button>

        <div className="h-4 w-[1px] bg-border mx-1" />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn()}
            className="size-7 rounded-xl flex items-center justify-center bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer font-bold text-xs"
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut()}
            className="size-7 rounded-xl flex items-center justify-center bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer font-bold text-xs"
            title="Zoom Out"
          >
            -
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.easeTo({ pitch: 60, bearing: -20, zoom: 13.8 })}
            className="size-7 rounded-xl flex items-center justify-center bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer"
            title="Reset 3D Pitch & Bearing"
          >
            <RotateCcw className="size-3 text-primary" />
          </button>
        </div>
      </div>

      {/* Flood & Route Advisory Comparison Floating Banner */}
      {rainfallMm > 60 && activeLayers.route && (
        <div className="absolute bottom-4 left-4 z-20 max-w-sm bg-background/95 backdrop-blur-md rounded-2xl p-4 border border-rose-200/60 shadow-xl space-y-2 animate-rise">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-rose-600">
              <AlertTriangle className="size-4 animate-bounce" />
              Emergency Green Corridor Rerouted
            </span>
            <span className="text-[10px] font-mono font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
              Flooding Alert
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Fastest route compromised. <strong className="text-foreground">Edappally Underpass submerged (0.8m)</strong>. Sentinel AI active safe corridor dispatched via Seaport-Airport bypass.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] font-mono">
            <div className="bg-emerald-50 text-emerald-800 p-2 rounded-xl border border-emerald-200">
              <span className="block font-semibold">🟢 Sentinel Safe ETA</span>
              <span className="text-xs font-bold">18 min (14.2 km)</span>
            </div>
            <div className="bg-rose-50 text-rose-800 p-2 rounded-xl border border-rose-200 line-through opacity-80">
              <span className="block font-semibold">🔴 Direct Route</span>
              <span className="text-xs font-bold">44 min (Blocked)</span>
            </div>
          </div>
        </div>
      )}

      {/* Incident Click Popup Card */}
      {selectedIncident && (
        <div className="absolute top-16 right-4 z-30 w-72 bg-card rounded-2xl p-4 border border-border shadow-2xl space-y-3 animate-rise">
          <div className="flex justify-between items-start">
            <div>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase text-white",
                selectedIncident.severity === "critical" ? "bg-rose-600 animate-pulse-soft" : "bg-amber-500"
              )}>
                {selectedIncident.severity}
              </span>
              <h4 className="text-sm font-bold text-foreground mt-1">{selectedIncident.title}</h4>
            </div>
            <button
              onClick={() => setSelectedIncident(null)}
              className="size-6 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{selectedIncident.location}</p>
          <div className="bg-secondary/60 rounded-xl p-2.5 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Department:</span>
              <strong className="text-foreground">{selectedIncident.department}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">AI Confidence:</span>
              <strong className="text-primary">{selectedIncident.confidence}%</strong>
            </div>
          </div>
        </div>
      )}

      {/* Building Click Popup Card */}
      {selectedBuilding && (
        <div className="absolute top-16 right-4 z-30 w-72 bg-card rounded-2xl p-4 border border-border shadow-2xl space-y-3 animate-rise">
          <div className="flex justify-between items-start">
            <div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-blue-100 text-blue-800">
                {selectedBuilding.category}
              </span>
              <h4 className="text-sm font-bold text-foreground mt-1">{selectedBuilding.name}</h4>
            </div>
            <button
              onClick={() => setSelectedBuilding(null)}
              className="size-6 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="bg-secondary/60 rounded-xl p-2.5 text-[11px] space-y-1 font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Height:</span>
              <strong className="text-primary">{selectedBuilding.height} meters</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">3D Model Status:</span>
              <strong className="text-emerald-600">Optimal Structural Safety</strong>
            </div>
          </div>
        </div>
      )}

      {/* CCTV Click Popup Card */}
      {selectedCctv && (
        <div className="absolute top-16 right-4 z-30 w-72 bg-card rounded-2xl p-4 border border-border shadow-2xl space-y-3 animate-rise">
          <div className="flex justify-between items-start">
            <div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-primary text-white font-mono">
                {selectedCctv.id}
              </span>
              <h4 className="text-sm font-bold text-foreground mt-1">{selectedCctv.name}</h4>
            </div>
            <button
              onClick={() => setSelectedCctv(null)}
              className="size-6 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="h-28 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 relative overflow-hidden">
            <Video className="size-8 text-slate-500 animate-pulse" />
            <span className="absolute bottom-2 left-2 text-[9px] font-mono text-emerald-400 bg-black/60 px-1.5 py-0.5 rounded">
              ● LIVE VISION AI
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono">
            Traffic Detection: <strong className="text-foreground">{selectedCctv.queue}</strong>
          </p>
        </div>
      )}
    </div>
  );
}
