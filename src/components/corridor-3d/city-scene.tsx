// Procedural Low-Poly Night City, Turning Road Graph, 3D Signal Heads & Preemption Displays
import React, { useMemo, useRef, useState, memo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { CorridorSimulation } from "@/lib/sim/corridor-sim";
import { ROAD_SEGMENTS, CORRIDOR_JUNCTION_NODES } from "@/lib/sim/road-graph";
import { sharedCorridorSpline } from "@/lib/sim/spline-path";

// Canvas texture generator for procedural illuminated office building windows
function createBuildingWindowTexture(): THREE.CanvasTexture {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return new THREE.CanvasTexture({} as any);
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#0c1322";
    ctx.fillRect(0, 0, 256, 512);

    const windowColors = ["#fde047", "#38bdf8", "#fed7aa", "#67e8f9", "#0c1322", "#0c1322"];
    const rows = 32;
    const cols = 8;
    const padX = 8;
    const padY = 6;
    const w = (256 - (cols + 1) * padX) / cols;
    const h = (512 - (rows + 1) * padY) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = padX + c * (w + padX);
        const y = padY + r * (h + padY);
        const color = windowColors[Math.floor(Math.random() * windowColors.length)];
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export const CityScene = memo(function CityScene({
  simRef,
  greenCorridorActive,
}: {
  simRef: React.RefObject<CorridorSimulation>;
  greenCorridorActive: boolean;
}) {
  const windowTexture = useMemo(() => createBuildingWindowTexture(), []);

  // Procedural Building Footprints distributed along city grid blocks
  const buildings = useMemo(() => {
    const list: { pos: [number, number, number]; size: [number, number, number]; color: string }[] = [];
    const blockCenters: [number, number][] = [
      [-150, -140], [-150, -60], [-150, 20], [-150, 100],
      [-50, -140], [-50, -60], [-50, 20], [-50, 100],
      [70, -140], [70, -60], [70, 20], [70, 130],
      [140, -140], [140, -40], [140, 30], [140, 130],
      [210, -80], [210, 80],
    ];

    blockCenters.forEach(([bx, bz]) => {
      for (let i = 0; i < 2; i++) {
        const offsetX = (i === 0 ? -1 : 1) * 14;
        const height = 18 + Math.random() * 36;
        list.push({
          pos: [bx + offsetX, height / 2, bz],
          size: [22, height, 22],
          color: "#111827",
        });
      }
    });

    return list;
  }, []);

  return (
    <group>
      {/* 1. Ground Plane (Dark Navy Surface) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[20, -0.05, 0]}>
        <planeGeometry args={[800, 600]} />
        <meshBasicMaterial color="#070b14" />
      </mesh>

      {/* 2. Road Network Segments & Lane Markings */}
      {ROAD_SEGMENTS.map((seg) => (
        <RoadSegmentMesh key={seg.id} segment={seg} />
      ))}

      {/* 3. Junction Boxes with Filleted Corners & Zebra Crossings */}
      {CORRIDOR_JUNCTION_NODES.map((jNode) => (
        <JunctionBoxMesh key={`box-${jNode.id}`} node={jNode} />
      ))}

      {/* 4. Dynamic Curved Green Corridor Ribbon (Lights up along path ahead of ambulance) */}
      {greenCorridorActive && <CurvedGreenCorridorRibbon />}

      {/* 5. Procedural 3D Buildings */}
      {buildings.map((b, i) => (
        <mesh key={`bldg-${i}`} position={b.pos}>
          <boxGeometry args={b.size} />
          <meshStandardMaterial
            color="#0f172a"
            map={windowTexture}
            roughness={0.4}
            metalness={0.1}
          />
        </mesh>
      ))}

      {/* 6. Street Lamps along major corridors */}
      <StreetLamps />

      {/* 7. Start Point: Incident Scene with Hazard Cones */}
      <IncidentSite position={[-190, 0, -100]} />

      {/* 8. Destination: Aster Medcity Hospital with Helipad */}
      <HospitalComplex position={[230, 0, 0]} />

      {/* 9. 3D Signal Heads, Overhead Cantilevers & Preemption Rings */}
      {CORRIDOR_JUNCTION_NODES.map((_, idx) => (
        <JunctionGroup key={`j-${idx}`} junctionIndex={idx} simRef={simRef} />
      ))}
    </group>
  );
});

// Subcomponent: Individual 4-Lane Road Segment Mesh with Yellow Median & Dashes
const RoadSegmentMesh = memo(function RoadSegmentMesh({ segment }: { segment: (typeof ROAD_SEGMENTS)[0] }) {
  const midX = (segment.start[0] + segment.end[0]) / 2;
  const midZ = (segment.start[1] + segment.end[1]) / 2;
  const angle = segment.heading;

  return (
    <group position={[midX, 0.01, midZ]} rotation={[0, -angle, 0]}>
      {/* Asphalt Surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[segment.length, segment.width]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} />
      </mesh>

      {/* Sidewalk Curbs (Left & Right) */}
      <mesh position={[0, 0.15, segment.width / 2 + 0.8]}>
        <boxGeometry args={[segment.length, 0.3, 1.6]} />
        <meshStandardMaterial color="#334155" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.15, -segment.width / 2 - 0.8]}>
        <boxGeometry args={[segment.length, 0.3, 1.6]} />
        <meshStandardMaterial color="#334155" roughness={0.7} />
      </mesh>

      {/* Yellow Double Median Line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.15]}>
        <planeGeometry args={[segment.length, 0.12]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -0.15]}>
        <planeGeometry args={[segment.length, 0.12]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.6} />
      </mesh>

      {/* White Dashed Lane Dividers at +/- 3.2 */}
      {Array.from({ length: Math.floor(segment.length / 8) }).map((_, i) => (
        <group key={`dash-${i}`} position={[-segment.length / 2 + 4 + i * 8, 0.02, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 3.2]}>
            <planeGeometry args={[3.5, 0.14]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -3.2]}>
            <planeGeometry args={[3.5, 0.14]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
    </group>
  );
});

// Subcomponent: Intersection Box with Fillets & Zebra Crossings
const JunctionBoxMesh = memo(function JunctionBoxMesh({ node }: { node: (typeof CORRIDOR_JUNCTION_NODES)[0] }) {
  return (
    <group position={[node.x, 0.015, node.z]}>
      {/* Intersection Center Box */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[18, 18]} />
        <meshStandardMaterial color="#0f172a" roughness={0.45} />
      </mesh>

      {/* Zebra Crossings on Approaches */}
      <ZebraCrossing position={[0, 0.02, 8.5]} rotation={0} />
      <ZebraCrossing position={[0, 0.02, -8.5]} rotation={0} />
      <ZebraCrossing position={[8.5, 0.02, 0]} rotation={Math.PI / 2} />
      <ZebraCrossing position={[-8.5, 0.02, 0]} rotation={Math.PI / 2} />
    </group>
  );
});

// Zebra Crossing Striped Decal
function ZebraCrossing({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[-5, -3, -1, 1, 3, 5].map((off) => (
        <mesh key={`zebra-${off}`} rotation={[-Math.PI / 2, 0, 0]} position={[off, 0, 0]}>
          <planeGeometry args={[1.2, 2.2]} />
          <meshStandardMaterial color="#ffffff" opacity={0.85} transparent />
        </mesh>
      ))}
    </group>
  );
}

// Subcomponent: Continuous Curved Green Corridor Ribbon along Spline Path
function CurvedGreenCorridorRibbon() {
  const meshRef = useRef<THREE.Mesh>(null);

  // Generate ribbon geometry following the spline samples
  const geometry = useMemo(() => {
    const samples = sharedCorridorSpline.samples;
    const positions: number[] = [];
    const ribbonWidth = 4.2;

    for (let i = 0; i < samples.length - 1; i++) {
      const s1 = samples[i];
      const s2 = samples[i + 1];

      // Left and right edges along lane 1 normal (+1.8 center)
      const p1L = [s1.x + s1.normal[0] * (1.8 - ribbonWidth / 2), 0.04, s1.z + s1.normal[1] * (1.8 - ribbonWidth / 2)];
      const p1R = [s1.x + s1.normal[0] * (1.8 + ribbonWidth / 2), 0.04, s1.z + s1.normal[1] * (1.8 + ribbonWidth / 2)];
      const p2L = [s2.x + s2.normal[0] * (1.8 - ribbonWidth / 2), 0.04, s2.z + s2.normal[1] * (1.8 - ribbonWidth / 2)];
      const p2R = [s2.x + s2.normal[0] * (1.8 + ribbonWidth / 2), 0.04, s2.z + s2.normal[1] * (1.8 + ribbonWidth / 2)];

      // 2 triangles per quad
      positions.push(...p1L, ...p1R, ...p2L);
      positions.push(...p1R, ...p2R, ...p2L);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      const pulse = 0.7 + 0.3 * Math.sin(state.clock.getElapsedTime() * 4.0);
      mat.emissiveIntensity = 2.2 * pulse;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        color="#10b981"
        emissive="#10b981"
        emissiveIntensity={2.0}
        transparent
        opacity={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// Subcomponent: 3D Signal Heads, Approach Rotations & Preemption Displays
const JunctionGroup = memo(function JunctionGroup({
  junctionIndex,
  simRef,
}: {
  junctionIndex: number;
  simRef: React.RefObject<CorridorSimulation>;
}) {
  const jNode = CORRIDOR_JUNCTION_NODES[junctionIndex];
  const ringRef = useRef<THREE.Mesh>(null);
  const [isPreempted, setIsPreempted] = useState(false);

  useFrame((state) => {
    const j = simRef.current?.junctions[junctionIndex];
    if (!j) return;

    const preempted = j.preemptionState !== "NORMAL";
    if (preempted !== isPreempted) {
      setIsPreempted(preempted);
    }

    if (ringRef.current) {
      ringRef.current.visible = preempted;
      if (preempted) {
        const t = state.clock.getElapsedTime();
        const scale = 1.0 + 0.15 * Math.sin(t * 6);
        ringRef.current.scale.set(scale, scale, 1);
      }
    }
  });

  // Calculate approach coordinate offsets and rotations from junction incomingHeading
  const theta = jNode.incomingHeading;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const normX = -sinT;
  const normZ = cosT;

  // 4 Approach Pole Positions & Facing Rotations
  const ambPos: [number, number, number] = [-cosT * 9.5 + normX * 8.0, 0, -sinT * 9.5 + normZ * 8.0];
  const ambRot = -theta;

  const oppPos: [number, number, number] = [cosT * 9.5 - normX * 8.0, 0, sinT * 9.5 - normZ * 8.0];
  const oppRot = -(theta + Math.PI);

  const crossAPos: [number, number, number] = [normX * 9.5 + cosT * 8.0, 0, normZ * 9.5 + sinT * 8.0];
  const crossARot = -(theta + Math.PI / 2);

  const crossBPos: [number, number, number] = [-normX * 9.5 - cosT * 8.0, 0, -normZ * 9.5 - sinT * 8.0];
  const crossBRot = -(theta - Math.PI / 2);

  const turnSymbol =
    jNode.turnType === "right" ? "➡️ TURN RIGHT" : jNode.turnType === "left" ? "⬅️ TURN LEFT" : "⬆️ PROCEED";

  return (
    <group position={[jNode.x, 0, jNode.z]}>
      {/* Pulsing Emerald Preemption Ring on Ground when Active */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} visible={false}>
        <ringGeometry args={[9, 11, 32]} />
        <meshStandardMaterial
          color="#10b981"
          emissive="#10b981"
          emissiveIntensity={3.5}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Floating 3D Label & Turn Action Badge */}
      <Html position={[0, 10, 0]} center distanceFactor={45} zIndexRange={[0, 10]}>
        <div className="flex flex-col items-center pointer-events-none select-none max-w-[200px]">
          <div
            className={`px-2.5 py-0.5 rounded-lg text-[9px] font-mono font-bold tracking-wider uppercase backdrop-blur-md border shadow-md whitespace-nowrap ${
              isPreempted
                ? "bg-emerald-600/95 text-white border-emerald-300 shadow-emerald-500/40"
                : "bg-slate-900/85 text-slate-200 border-slate-700"
            }`}
          >
            {jNode.name}
          </div>
          {isPreempted && (
            <div className="mt-0.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/90 text-[8px] font-bold text-emerald-300 uppercase tracking-tight border border-emerald-400/50 shadow-sm whitespace-nowrap">
              <span>{turnSymbol}</span>
            </div>
          )}
        </div>
      </Html>

      {/* 3D Traffic Signal Poles accurately facing each incoming approach */}
      <SignalPole
        position={ambPos}
        rotationY={ambRot}
        junctionIndex={junctionIndex}
        approach="ambulanceApproach"
        simRef={simRef}
      />
      <SignalPole
        position={oppPos}
        rotationY={oppRot}
        junctionIndex={junctionIndex}
        approach="opposingApproach"
        simRef={simRef}
      />
      <SignalPole
        position={crossAPos}
        rotationY={crossARot}
        junctionIndex={junctionIndex}
        approach="crossApproachA"
        simRef={simRef}
      />
      <SignalPole
        position={crossBPos}
        rotationY={crossBRot}
        junctionIndex={junctionIndex}
        approach="crossApproachB"
        simRef={simRef}
      />
    </group>
  );
});

// Shared Geometries for Signal Poles
const poleGeo = new THREE.CylinderGeometry(0.18, 0.22, 6.8, 8);
const housingGeo = new THREE.BoxGeometry(0.85, 2.2, 0.6);
const lampLensGeo = new THREE.CircleGeometry(0.24, 14);
const poleMat = new THREE.MeshStandardMaterial({ color: "#334155", metalness: 0.8, roughness: 0.3 });
const housingMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.5 });

// 3D Signal Post Mesh with Direct Emissive Updates on 60fps Loop
const SignalPole = memo(function SignalPole({
  position,
  rotationY = 0,
  junctionIndex,
  approach,
  simRef,
}: {
  position: [number, number, number];
  rotationY?: number;
  junctionIndex: number;
  approach: "ambulanceApproach" | "opposingApproach" | "crossApproachA" | "crossApproachB";
  simRef: React.RefObject<CorridorSimulation>;
}) {
  const redMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const yellowMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const greenMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    const j = simRef.current?.junctions[junctionIndex];
    if (!j) return;
    const phase = j.signals[approach];

    if (redMatRef.current) {
      redMatRef.current.emissiveIntensity = phase === "red" ? 5.5 : 0.15;
    }
    if (yellowMatRef.current) {
      yellowMatRef.current.emissiveIntensity = phase === "yellow" ? 5.5 : 0.15;
    }
    if (greenMatRef.current) {
      greenMatRef.current.emissiveIntensity = phase === "green" ? 6.0 : 0.15;
    }
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Metal Pole */}
      <mesh position={[0, 3.4, 0]} geometry={poleGeo} material={poleMat} />

      {/* Signal Head Housing */}
      <mesh position={[0, 6.0, 0]} geometry={housingGeo} material={housingMat} />

      {/* Red Light */}
      <mesh position={[0, 6.6, 0.32]} geometry={lampLensGeo}>
        <meshStandardMaterial
          ref={redMatRef}
          color="#ef4444"
          emissive="#ef4444"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* Yellow Light */}
      <mesh position={[0, 6.0, 0.32]} geometry={lampLensGeo}>
        <meshStandardMaterial
          ref={yellowMatRef}
          color="#eab308"
          emissive="#eab308"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* Green Light */}
      <mesh position={[0, 5.4, 0.32]} geometry={lampLensGeo}>
        <meshStandardMaterial
          ref={greenMatRef}
          color="#10b981"
          emissive="#10b981"
          emissiveIntensity={0.15}
        />
      </mesh>
    </group>
  );
});

// Street Lamps along arterial roads
const StreetLamps = memo(function StreetLamps() {
  const lampPositions: [number, number][] = [
    [-170, -110], [-130, -110], [-90, -110],
    [-110, -70], [-110, -40],
    [-70, -30], [-30, -30], [0, -30],
    [30, 0], [30, 40], [30, 70],
    [60, 90], [100, 90], [140, 90],
  ];

  return (
    <group>
      {lampPositions.map(([x, z], i) => (
        <group key={`lamp-${i}`} position={[x, 0, z]}>
          <mesh position={[0, 4, 0]}>
            <cylinderGeometry args={[0.1, 0.12, 8, 8]} />
            <meshStandardMaterial color="#475569" metalness={0.7} />
          </mesh>
          <mesh position={[0, 7.8, 0]}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={2.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
});

// Start Incident Site
const IncidentSite = memo(function IncidentSite({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <Html position={[0, 4.5, 0]} center distanceFactor={45} zIndexRange={[0, 10]}>
        <div className="flex items-center gap-1.5 rounded-lg border border-rose-500 bg-rose-950/90 px-2 py-0.5 text-[9px] font-mono font-bold text-rose-300 shadow-md backdrop-blur-md whitespace-nowrap pointer-events-none">
          🚨 INCIDENT ORIGIN
        </div>
      </Html>
      <mesh position={[0, 0.4, 0]}>
        <coneGeometry args={[0.6, 1.2, 8]} />
        <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={1.5} />
      </mesh>
    </group>
  );
});

// Aster Medcity Hospital Complex with Illuminated Helipad
const HospitalComplex = memo(function HospitalComplex({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Main Hospital Tower */}
      <mesh position={[0, 24, 0]}>
        <boxGeometry args={[42, 48, 36]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Red Cross on Facade */}
      <mesh position={[0, 36, 18.2]}>
        <boxGeometry args={[3, 10, 0.2]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={3.0} />
      </mesh>
      <mesh position={[0, 36, 18.2]}>
        <boxGeometry args={[10, 3, 0.2]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={3.0} />
      </mesh>

      {/* Rooftop Helipad 'H' */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 48.1, 0]}>
        <circleGeometry args={[10, 32]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 48.15, 0]}>
        <ringGeometry args={[8.5, 9.2, 32]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={2.5} />
      </mesh>

      <Html position={[0, 52, 0]} center distanceFactor={45} zIndexRange={[0, 10]}>
        <div className="flex flex-col items-center pointer-events-none select-none max-w-[200px]">
          <div className="px-2.5 py-0.5 rounded-lg bg-emerald-950/90 text-emerald-300 font-mono text-[9px] font-bold border border-emerald-500 shadow-md backdrop-blur-md whitespace-nowrap">
            🏥 ASTER MEDCITY TRAUMA ICU
          </div>
        </div>
      </Html>
    </group>
  );
});
