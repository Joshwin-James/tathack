// Procedural Road Network Graph: Junctions, Edges, 4-Lane Profiles & Left-Hand Drive Splines
import { Junction } from "./types";
import { sharedCorridorSpline } from "./spline-path";

export interface RoadEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  start: [number, number]; // [x, z]
  end: [number, number]; // [x, z]
  length: number;
  heading: number; // Radians
  width: number; // 14 units (4 lanes + median)
  isCorridorPath: boolean;
}

export const CORRIDOR_JUNCTION_NODES: {
  id: string;
  name: string;
  x: number;
  z: number;
  incomingHeading: number;
  outgoingHeading: number;
  turnType: "right" | "left" | "straight" | "curve";
  routeDistance: number; // Distance along spline
}[] = [
  {
    id: "j-kaloor",
    name: "Kaloor Junction",
    x: -100,
    z: -100,
    incomingHeading: 0, // Heading East
    outgoingHeading: Math.PI / 2, // Turning South (Right Turn)
    turnType: "right",
    routeDistance: 90,
  },
  {
    id: "j-palarivattom",
    name: "Palarivattom Flyover",
    x: -100,
    z: -20,
    incomingHeading: Math.PI / 2, // Heading South
    outgoingHeading: 0, // Turning East (Left Turn)
    turnType: "left",
    routeDistance: 175,
  },
  {
    id: "j-edappally",
    name: "Edappally Toll Jn",
    x: 20,
    z: -20,
    incomingHeading: 0, // Heading East
    outgoingHeading: Math.PI / 2, // Turning South (Right Turn)
    turnType: "right",
    routeDistance: 295,
  },
  {
    id: "j-vyttila",
    name: "Vyttila Mobility Hub",
    x: 20,
    z: 80,
    incomingHeading: Math.PI / 2, // Heading South
    outgoingHeading: 0, // Turning East (Left Turn)
    turnType: "left",
    routeDistance: 400,
  },
  {
    id: "j-aster",
    name: "Aster Medcity Hospital",
    x: 230,
    z: 0,
    incomingHeading: -Math.PI / 4, // Curving North-East
    outgoingHeading: 0,
    turnType: "curve",
    routeDistance: sharedCorridorSpline.totalLength,
  },
];

export const ROAD_SEGMENTS: RoadEdge[] = [
  // 1. Corridor Segments (Main Emergency Route)
  {
    id: "seg-start-kaloor",
    fromNodeId: "start",
    toNodeId: "j-kaloor",
    start: [-190, -100],
    end: [-100, -100],
    length: 90,
    heading: 0,
    width: 14,
    isCorridorPath: true,
  },
  {
    id: "seg-kaloor-palarivattom",
    fromNodeId: "j-kaloor",
    toNodeId: "j-palarivattom",
    start: [-100, -100],
    end: [-100, -20],
    length: 80,
    heading: Math.PI / 2,
    width: 14,
    isCorridorPath: true,
  },
  {
    id: "seg-palarivattom-edappally",
    fromNodeId: "j-palarivattom",
    toNodeId: "j-edappally",
    start: [-100, -20],
    end: [20, -20],
    length: 120,
    heading: 0,
    width: 14,
    isCorridorPath: true,
  },
  {
    id: "seg-edappally-vyttila",
    fromNodeId: "j-edappally",
    toNodeId: "j-vyttila",
    start: [20, -20],
    end: [20, 80],
    length: 100,
    heading: Math.PI / 2,
    width: 14,
    isCorridorPath: true,
  },
  {
    id: "seg-vyttila-aster",
    fromNodeId: "j-vyttila",
    toNodeId: "j-aster",
    start: [20, 80],
    end: [150, 80],
    length: 130,
    heading: 0,
    width: 14,
    isCorridorPath: true,
  },

  // 2. Cross Streets (Urban Grid Arterials)
  {
    id: "cross-kaloor-north",
    fromNodeId: "grid-kaloor-n",
    toNodeId: "j-kaloor",
    start: [-100, -160],
    end: [-100, -100],
    length: 60,
    heading: Math.PI / 2,
    width: 12,
    isCorridorPath: false,
  },
  {
    id: "cross-kaloor-east",
    fromNodeId: "j-kaloor",
    toNodeId: "grid-kaloor-e",
    start: [-100, -100],
    end: [-30, -100],
    length: 70,
    heading: 0,
    width: 12,
    isCorridorPath: false,
  },
  {
    id: "cross-palarivattom-west",
    fromNodeId: "grid-pal-w",
    toNodeId: "j-palarivattom",
    start: [-170, -20],
    end: [-100, -20],
    length: 70,
    heading: 0,
    width: 12,
    isCorridorPath: false,
  },
  {
    id: "cross-palarivattom-south",
    fromNodeId: "j-palarivattom",
    toNodeId: "grid-pal-s",
    start: [-100, -20],
    end: [-100, 50],
    length: 70,
    heading: Math.PI / 2,
    width: 12,
    isCorridorPath: false,
  },
  {
    id: "cross-edappally-north",
    fromNodeId: "grid-edp-n",
    toNodeId: "j-edappally",
    start: [20, -90],
    end: [20, -20],
    length: 70,
    heading: Math.PI / 2,
    width: 12,
    isCorridorPath: false,
  },
  {
    id: "cross-edappally-east",
    fromNodeId: "j-edappally",
    toNodeId: "grid-edp-e",
    start: [20, -20],
    end: [90, -20],
    length: 70,
    heading: 0,
    width: 12,
    isCorridorPath: false,
  },
  {
    id: "cross-vyttila-west",
    fromNodeId: "grid-vyt-w",
    toNodeId: "j-vyttila",
    start: [-60, 80],
    end: [20, 80],
    length: 80,
    heading: 0,
    width: 12,
    isCorridorPath: false,
  },
  {
    id: "cross-vyttila-south",
    fromNodeId: "j-vyttila",
    toNodeId: "grid-vyt-s",
    start: [20, 80],
    end: [20, 150],
    length: 70,
    heading: Math.PI / 2,
    width: 12,
    isCorridorPath: false,
  },
];
