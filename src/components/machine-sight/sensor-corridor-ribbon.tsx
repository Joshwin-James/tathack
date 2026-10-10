// Glowing Emerald Emergency Corridor Ribbon, Junction Preemption Status Rings & Clearances
import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { sharedCorridorSpline } from "@/lib/sim/spline-path";
import { CORRIDOR_JUNCTION_NODES } from "@/lib/sim/road-graph";
import { CorridorSimulation } from "@/lib/sim/corridor-sim";

interface SensorCorridorRibbonProps {
  simRef: React.RefObject<CorridorSimulation>;
  greenCorridorActive: boolean;
}

export function SensorCorridorRibbon({ simRef, greenCorridorActive }: SensorCorridorRibbonProps) {
  const ribbonMeshRef = useRef<THREE.Mesh>(null);

  // Generate smooth flat ribbon along the corridor spline (width ~4.2m)
  const ribbonGeometry = useMemo(() => {
    const segments = 220;
    const vertices: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];

    const halfWidth = 2.2;
    const totalLen = sharedCorridorSpline.totalLength;

    for (let i = 0; i <= segments; i++) {
      const dist = (i / segments) * totalLen;
      const sample = sharedCorridorSpline.sampleAtDistance(dist, 1.0);

      // Normal perpendicular to heading
      const perpHeading = sample.heading + Math.PI / 2;
      const nx = Math.cos(perpHeading);
      const nz = Math.sin(perpHeading);

      const leftX = sample.finalX - nx * halfWidth;
      const leftZ = sample.finalZ - nz * halfWidth;
      const rightX = sample.finalX + nx * halfWidth;
      const rightZ = sample.finalZ + nz * halfWidth;

      // Left vertex
      vertices.push(leftX, 0.18, leftZ);
      // Right vertex
      vertices.push(rightX, 0.18, rightZ);

      const u = i / segments;
      uvs.push(0, u, 1, u);

      if (i < segments) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Animated emerald shader material for the ribbon
  const ribbonMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uActive: { value: greenCorridorActive ? 1.0 : 0.2 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uProgress;
        uniform float uActive;
        varying vec2 vUv;

        void main() {
          if (uActive < 0.5) {
            gl_FragColor = vec4(0.2, 0.4, 0.3, 0.15);
            return;
          }

          // Dynamic flow pulses running towards destination
          float flow = fract(vUv.y * 12.0 - uTime * 2.5);
          float chevron = smoothstep(0.0, 0.3, flow) * smoothstep(0.7, 0.3, flow);

          // Edge glow
          float edge = abs(vUv.x - 0.5) * 2.0;
          float edgeGlow = pow(edge, 3.0) * 0.8;

          // Lit progressively up to ambulance position and beyond
          vec3 baseGreen = vec3(0.06, 0.85, 0.5);
          vec3 brightGlow = vec3(0.3, 1.0, 0.7);

          vec3 finalColor = mix(baseGreen, brightGlow, chevron + edgeGlow);
          float alpha = 0.5 + chevron * 0.4 + edgeGlow * 0.3;

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, [greenCorridorActive]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    ribbonMaterial.uniforms.uTime.value = time;
    ribbonMaterial.uniforms.uActive.value = greenCorridorActive ? 1.0 : 0.2;
    if (simRef.current) {
      ribbonMaterial.uniforms.uProgress.value = simRef.current.vehicle.progress;
    }
  });

  return (
    <group>
      {/* 1. Emerald Route Ribbon */}
      <mesh ref={ribbonMeshRef} geometry={ribbonGeometry} material={ribbonMaterial} />

      {/* 2. Junction Preemption Status Rings & Clearances */}
      {CORRIDOR_JUNCTION_NODES.map((jn) => (
        <JunctionPreemptionMarker
          key={`ribbon-jn-${jn.id}`}
          node={jn}
          simRef={simRef}
          greenCorridorActive={greenCorridorActive}
        />
      ))}
    </group>
  );
}

function JunctionPreemptionMarker({
  node,
  simRef,
  greenCorridorActive,
}: {
  node: (typeof CORRIDOR_JUNCTION_NODES)[0];
  simRef: React.RefObject<CorridorSimulation>;
  greenCorridorActive: boolean;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const [badgeText, setBadgeText] = React.useState<string>("NORMAL");
  const [isPreempted, setIsPreempted] = React.useState<boolean>(false);

  useFrame((state) => {
    if (!simRef.current) return;
    const j = simRef.current.junctions.find((item) => item.id === node.id);
    if (!j) return;

    const time = state.clock.getElapsedTime();
    if (ringRef.current) {
      ringRef.current.rotation.z = time * 0.8;
    }

    if (j.preemptionState === "EMERGENCY_GREEN") {
      setBadgeText("CORRIDOR CLEARED");
      setIsPreempted(true);
    } else if (j.preemptionState === "ALL_RED_CLEARANCE") {
      setBadgeText("ALL-RED CLEARING");
      setIsPreempted(true);
    } else if (j.cleared) {
      setBadgeText("PASSED");
      setIsPreempted(false);
    } else {
      setBadgeText("MONITORING");
      setIsPreempted(false);
    }
  });

  return (
    <group position={[node.x, 0.25, node.z]}>
      {/* Preemption Ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[14, 15, 32]} />
        <meshBasicMaterial
          color={isPreempted ? "#10b981" : "#64748b"}
          transparent
          opacity={isPreempted ? 0.7 : 0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Floating 3D Monospace HTML Label */}
      <Html position={[0, 4.5, 0]} center distanceFactor={140} zIndexRange={[100, 0]}>
        <div className="pointer-events-none select-none whitespace-nowrap rounded-md border border-slate-700/80 bg-slate-950/85 px-2 py-0.5 text-[9px] font-mono tracking-wider shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <span
              className={`size-1.5 rounded-full ${
                isPreempted ? "bg-emerald-400 animate-ping" : "bg-slate-400"
              }`}
            />
            <span className="font-semibold text-slate-200">{node.name.toUpperCase()}</span>
            <span className={isPreempted ? "text-emerald-400 font-bold" : "text-slate-400"}>
              [{badgeText}]
            </span>
          </div>
        </div>
      </Html>
    </group>
  );
}
