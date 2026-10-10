import React, { createContext, useContext, useState, useEffect } from "react";
import {
  incidents as initialIncidents,
  alerts as initialAlerts,
  citizenReports as initialCitizenReports,
  recentDecisions as initialRecentDecisions,
  notifications as initialNotifications,
  type Incident,
  type AlertItem,
  type Report,
  type AiDecision,
  type Notification,
} from "@/data/kochi";

import { apiConfig } from "@/config/api";

// Convert schematic x, y coordinates to actual Kochi Lon, Lat coordinates for Mapbox mapping
export function schematicToLngLat(x: number, y: number): [number, number] {
  // Kochi bounding box: Lon 76.24 to 76.36, Lat 9.91 to 10.05
  const lng = 76.24 + (x / 100) * 0.12;
  const lat = 10.05 - (y / 100) * 0.14;
  return [lng, lat];
}

// Convert actual Lon, Lat to schematic x, y percentage
export function lngLatToSchematic(lng: number, lat: number): [number, number] {
  const x = ((lng - 76.24) / 0.12) * 100;
  const y = ((10.05 - lat) / 0.14) * 100;
  return [
    Math.max(0, Math.min(100, x)),
    Math.max(0, Math.min(100, y)),
  ];
}

interface SentinelStoreType {
  incidents: Incident[];
  alerts: AlertItem[];
  citizenReports: Report[];
  recentDecisions: AiDecision[];
  notifications: Notification[];
  mapboxToken: string;
  setMapboxToken: (token: string) => void;
  addIncident: (newIncident: Partial<Incident> & { lng: number; lat: number }) => void;
  addDecision: (decision: Partial<AiDecision> & { action: string }) => void;
  addCitizenReport: (report: Omit<Report, "id" | "status" | "minutesAgo"> & {
    description?: string;
    latitude: number;
    longitude: number;
    severity: Incident["severity"];
    recommendation?: string;
  }) => void;
  resolveIncident: (incidentId: string, officerName?: string) => void;
  // SOS State
  triggerSOS: (type: "police" | "ambulance" | "fire" | "disaster", location: { lat: number; lng: number }) => void;
  // Routing State
  activeRouteIndex: number;
  setActiveRouteIndex: (idx: number) => void;
  greenCorridorActive: boolean;
  setGreenCorridorActive: (active: boolean) => void;
}

const DEFAULT_MAPBOX_TOKEN = apiConfig.mapbox.token || "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTAwM2MzN21keG1ycjhpZ3MifQ.-bgrem2g2t5jRYg6BpA2g";

const SentinelContext = createContext<SentinelStoreType | undefined>(undefined);

export function SentinelProvider({ children }: { children: React.ReactNode }) {
  const [incidents, setIncidents] = useState<Incident[]>(() => {
    // Add default lng/lat coordinates to pre-existing incidents
    return initialIncidents.map((i) => {
      const [lng, lat] = schematicToLngLat(i.x, i.y);
      return { ...i, lng, lat };
    });
  });

  const [alerts, setAlerts] = useState<AlertItem[]>(initialAlerts);
  const [citizenReports, setCitizenReports] = useState<Report[]>(initialCitizenReports);
  const [recentDecisions, setRecentDecisions] = useState<AiDecision[]>(initialRecentDecisions);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  
  const [mapboxToken, setMapboxTokenState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sentinel_mapbox_token") || DEFAULT_MAPBOX_TOKEN;
    }
    return DEFAULT_MAPBOX_TOKEN;
  });

  const [activeRouteIndex, setActiveRouteIndex] = useState<number>(0);
  const [greenCorridorActive, setGreenCorridorActive] = useState<boolean>(true);

  const setMapboxToken = (token: string) => {
    setMapboxTokenState(token);
    if (typeof window !== "undefined") {
      localStorage.setItem("sentinel_mapbox_token", token);
    }
  };

  // Add Incident directly (e.g. from Command Center or system auto-generation)
  const addIncident = (newIncident: Partial<Incident> & { lng: number; lat: number }) => {
    const [x, y] = lngLatToSchematic(newIncident.lng, newIncident.lat);
    const incident: Incident = {
      id: newIncident.id || `I-${Math.floor(1000 + Math.random() * 9000)}`,
      title: newIncident.title || "Incident reported",
      location: newIncident.location || "Kochi",
      severity: newIncident.severity || "warning",
      minutesAgo: 0,
      confidence: newIncident.confidence || 95,
      department: newIncident.department || "Municipal",
      category: newIncident.category || "accident",
      x,
      y,
      lng: newIncident.lng,
      lat: newIncident.lat,
    };

    setIncidents((prev) => [incident, ...prev]);

    // Create a corresponding alert
    const newAlert: AlertItem = {
      id: `A-${Math.floor(700 + Math.random() * 300)}`,
      title: incident.title,
      location: incident.location,
      severity: incident.severity,
      confidence: incident.confidence,
      priority: incident.severity === "critical" ? "P0" : incident.severity === "warning" ? "P1" : "P2",
      recommendation: `AI Dispatching: Mobilize resources to ${incident.location} immediately.`,
      department: incident.department,
      minutesAgo: 0,
    };
    setAlerts((prev) => [newAlert, ...prev]);

    // Add notification
    const newNotif: Notification = {
      id: `N-${Math.floor(100 + Math.random() * 900)}`,
      kind: incident.severity as any,
      title: incident.title,
      body: `Incident detected at ${incident.location}. Confidence: ${incident.confidence}%.`,
      minutesAgo: 0,
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    // Add decision
    const newDecision: AiDecision = {
      id: `D-${Math.floor(9000 + Math.random() * 1000)}`,
      time: "0m",
      agent: "Master AI Agent",
      action: `Detected ${incident.title} at ${incident.location}. Standard dispatch route initiated.`,
      outcome: "auto",
    };
    setRecentDecisions((prev) => [newDecision, ...prev]);
  };

  // Add a Citizen Report
  const addCitizenReport = (reportData: Omit<Report, "id" | "status" | "minutesAgo"> & {
    description?: string;
    latitude: number;
    longitude: number;
    severity: Incident["severity"];
    recommendation?: string;
  }) => {
    const reportId = `R-${Math.floor(3000 + Math.random() * 1000)}`;
    const newReport: Report = {
      id: reportId,
      title: reportData.title,
      citizen: reportData.citizen,
      location: reportData.location,
      status: "verifying",
      priority: reportData.priority,
      department: reportData.department,
      minutesAgo: 0,
    };

    setCitizenReports((prev) => [newReport, ...prev]);

    // 1. Instantly create live incident & alert in the Command Center (http://localhost:8080/)
    addIncident({
      title: reportData.title,
      location: reportData.location,
      severity: reportData.severity,
      confidence: 96,
      department: reportData.department,
      category: getCategoryFromTitle(reportData.title),
      lng: reportData.longitude,
      lat: reportData.latitude,
    });

    // 2. Create notification of new citizen report
    const newNotif: Notification = {
      id: `N-${Math.floor(100 + Math.random() * 900)}`,
      kind: "system",
      title: `Citizen Report Live Synced`,
      body: `${reportData.title} by ${reportData.citizen} at ${reportData.location}. Synced to Command Center.`,
      minutesAgo: 0,
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    // 3. Update verification status after 3 seconds
    setTimeout(() => {
      setCitizenReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: "verified" as const } : r))
      );

      setTimeout(() => {
        setCitizenReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: "assigned" as const } : r))
        );
      }, 5000);
    }, 3000);
  };

  // Helper mapping category
  const getCategoryFromTitle = (title: string): Incident["category"] => {
    const t = title.toLowerCase();
    if (t.includes("accident") || t.includes("crash")) return "accident";
    if (t.includes("flood") || t.includes("water") || t.includes("rain")) return "flood";
    if (t.includes("traffic") || t.includes("jam") || t.includes("block")) return "congestion";
    if (t.includes("fire") || t.includes("smoke")) return "fire";
    return "crowd";
  };

  // Resolve an incident
  const resolveIncident = (incidentId: string, officerName = "Officer Suresh Kumar") => {
    // Mark incident as resolved
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === incidentId ? { ...inc, severity: "resolved" as const } : inc))
    );

    // Find the corresponding alert and mark it resolved/remove it from priority list if needed
    setAlerts((prev) =>
      prev.map((alt) =>
        alt.title === incidents.find((i) => i.id === incidentId)?.title
          ? { ...alt, severity: "resolved" as const }
          : alt
      )
    );

    // Sync citizen reports: If there's a matching citizen report, resolve it!
    const matchingInc = incidents.find((i) => i.id === incidentId);
    if (matchingInc) {
      setCitizenReports((prev) =>
        prev.map((rep) =>
          rep.title === matchingInc.title || rep.location === matchingInc.location
            ? { ...rep, status: "resolved" as const }
            : rep
        )
      );

      // Create a resolution notification
      const resolveNotif: Notification = {
        id: `N-${Math.floor(100 + Math.random() * 900)}`,
        kind: "resolved",
        title: `Incident Resolved: ${matchingInc.title}`,
        body: `Resolved by ${officerName} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        minutesAgo: 0,
        read: false,
      };
      setNotifications((prev) => [resolveNotif, ...prev]);

      // Create decision log
      const newDecision: AiDecision = {
        id: `D-${Math.floor(9000 + Math.random() * 1000)}`,
        time: "0m",
        agent: "Emergency Agent",
        action: `Incident ${matchingInc.id} (${matchingInc.title}) resolved. Resources standing down.`,
        outcome: "auto",
      };
      setRecentDecisions((prev) => [newDecision, ...prev]);
    }
  };

  // SOS request trigger
  const triggerSOS = (type: "police" | "ambulance" | "fire" | "disaster", location: { lat: number; lng: number }) => {
    const sosTitle = `SOS Alert: Citizen Emergency (${type.toUpperCase()})`;
    
    // Add to citizen reports
    addCitizenReport({
      title: sosTitle,
      citizen: "Citizen (SOS User)",
      location: `Emergency coordinates near GPS Location`,
      priority: "high",
      department: type === "police" ? "Police Dept" : type === "ambulance" ? "Emergency + Traffic" : type === "fire" ? "Fire Force" : "Disaster Response",
      latitude: location.lat,
      longitude: location.lng,
      severity: "critical",
    });
  };

  const addDecision = (decision: Partial<AiDecision> & { action: string }) => {
    const newDecision: AiDecision = {
      id: decision.id || `D-${Math.floor(9000 + Math.random() * 1000)}`,
      time: decision.time || "0m",
      agent: decision.agent || "Hospital Agent",
      action: decision.action,
      outcome: decision.outcome || "auto",
    };
    setRecentDecisions((prev) => [newDecision, ...prev]);
  };

  return (
    <SentinelContext.Provider
      value={{
        incidents,
        alerts,
        citizenReports,
        recentDecisions,
        notifications,
        mapboxToken,
        setMapboxToken,
        addIncident,
        addDecision,
        addCitizenReport,
        resolveIncident,
        triggerSOS,
        activeRouteIndex,
        setActiveRouteIndex,
        greenCorridorActive,
        setGreenCorridorActive,
      }}
    >
      {children}
    </SentinelContext.Provider>
  );
}

export function useSentinelStore() {
  const context = useContext(SentinelContext);
  if (!context) {
    throw new Error("useSentinelStore must be used within a SentinelProvider");
  }
  return context;
}
