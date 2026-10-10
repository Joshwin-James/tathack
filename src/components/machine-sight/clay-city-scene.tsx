// Procedural Clay City, Road Networks, Minimalist Tree Spheres, and Signals with Multi-Sensor Reveal
import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { ROAD_SEGMENTS, CORRIDOR_JUNCTION_NODES } from "@/lib/sim/road-graph";
import { MultiSensorShader } from "./shaders";
import { CorridorSimulation } from "@/lib/sim/corridor-sim";

interface ClayCitySceneProps {
  simRef: React.RefObject<CorridorSimulation>;
  zoneCenter: [number, number];
  zoneRadius: number;
  sensorMode: 0 | 1 | 2; // 0: LIDAR, 1: SEGMENTS, 2: DEPTH
}

export function ClayCityScene({ simRef, zoneCenter, zoneRadius, sensorMode }: ClayCitySceneProps) {
  // Shared shader material creation with uniforms
  const shaderMaterials = useMemo(() => {
    const createMat = (semanticType: number, clayHex: string, segHex: string) => {
      const uniforms = THREE.UniformsUtils.clone(MultiSensorShader.uniforms);
      uniforms.uSemanticType.value = semanticType;
      uniforms.uClayBaseColor.value = new THREE.Color(clayHex);
      uniforms.uSegmentColor.value = new THREE.Color(segHex);
      uniforms.uZoneRadius.value = zoneRadius;
      uniforms.uSensorMode.value = sensorMode;

      return new THREE.ShaderMaterial({
        uniforms,
        vertexShader: MultiSensorShader.vertexShader,
        fragmentShader: MultiSensorShader.fragmentShader,
        side: THREE.DoubleSide,
      });
    };

    return {
      ground: createMat(0, "#f3f4f6", "#0b1220"),
      road: createMat(1, "#e5e7eb", "#1e293b"),
      sidewalk: createMat(2, "#e2e8f0", "#334155"),
      building: createMat(3, "#ffffff", "#273549"),
      tree: createMat(3, "#e2e8f0", "#10b981"),
      hospital: createMat(3, "#ffffff", "#dc2626"),
    };
  }, [zoneRadius, sensorMode]);

  // Update uniforms every frame
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    Object.values(shaderMaterials).forEach((mat) => {
      mat.uniforms.uZoneCenter.value.set(zoneCenter[0], zoneCenter[1]);
      mat.uniforms.uZoneRadius.value = zoneRadius;
      mat.uniforms.uSensorMode.value = sensorMode;
      mat.uniforms.uTime.value = time;
    });
  });

  // Building geometry footprints
  const buildings = useMemo(() => {
    const list: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    const blockCenters: [number, number][] = [
      [-155, -135], [-155, -60], [-155, 20], [-155, 100],
      [-55, -135], [-55, -60], [-55, 20], [-55, 100],
      [65, -135], [65, -60], [65, 20], [65, 130],
      [145, -135], [145, -40], [145, 30], [145, 130],
      [215, -80], [215, 80],
    ];

    blockCenters.forEach(([bx, bz]) => {
      for (let i = 0; i < 2; i++) {
        const offsetX = (i === 0 ? -1 : 1) * 14;
        const height = 16 + (Math.abs(bx * 7 + bz * 13 + i * 19) % 32);
        list.push({
          pos: [bx + offsetX, height / 2, bz],
          size: [20, height, 20],
        });
      }
    });

    return list;
  }, []);

  // Trees (minimalist spheres with clay shading)
  const trees = useMemo(() => {
    const list: [number, number, number][] = [];
    const coords: [number, number][] = [
      [-120, -100], [-120, -20], [-120, 60],
      [-20, -100], [-20, -20], [-20, 60],
      [100, -100], [100, -20], [100, 70],
      [175, -60], [175, 40],
    ];
    coords.forEach(([tx, tz]) => {
      list.push([tx, 2.5, tz]);
      list.push([tx + 4, 3.2, tz + 3]);
      list.push([tx - 3, 2.8, tz + 4]);
    });
    return list;
  }, []);

  return (
    <group>
      {/* 1. Ground Surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[20, -0.05, 0]} material={shaderMaterials.ground}>
        <planeGeometry args={[800, 600]} />
      </mesh>

      {/* 2. Road Segments */}
      {ROAD_SEGMENTS.map((seg) => {
        const midX = (seg.start[0] + seg.end[0]) / 2;
        const midZ = (seg.start[1] + seg.end[1]) / 2;
        const angle = seg.heading;

        return (
          <group key={seg.id} position={[midX, 0.01, midZ]} rotation={[0, -angle, 0]}>
            {/* Asphalt */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} material={shaderMaterials.road}>
              <planeGeometry args={[seg.length, seg.width]} />
            </mesh>

            {/* Sidewalks (Left & Right) */}
            <mesh position={[0, 0.1, seg.width / 2 + 0.8]} material={shaderMaterials.sidewalk}>
              <boxGeometry args={[seg.length, 0.25, 1.6]} />
            </mesh>
            <mesh position={[0, 0.1, -seg.width / 2 - 0.8]} material={shaderMaterials.sidewalk}>
              <boxGeometry args={[seg.length, 0.25, 1.6]} />
            </mesh>
          </group>
        );
      })}

      {/* 3. Junction Boxes */}
      {CORRIDOR_JUNCTION_NODES.map((jn) => (
        <group key={`jn-${jn.id}`} position={[jn.x, 0.02, jn.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={shaderMaterials.road}>
            <planeGeometry args={[16, 16]} />
          </mesh>
          <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} material={shaderMaterials.sidewalk}>
            <planeGeometry args={[18, 18]} />
          </mesh>
        </group>
      ))}

      {/* 4. Buildings */}
      {buildings.map((b, i) => (
        <mesh key={`b-${i}`} position={b.pos} material={shaderMaterials.building} castShadow receiveShadow>
          <boxGeometry args={b.size} />
        </mesh>
      ))}

      {/* 5. Minimalist Trees */}
      {trees.map((tPos, i) => (
        <group key={`tree-${i}`} position={tPos}>
          {/* Trunk */}
          <mesh position={[0, -1.2, 0]}>
            <cylinderGeometry args={[0.3, 0.4, 2.4, 8]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
          {/* Foliage */}
          <mesh position={[0, 0.6, 0]} material={shaderMaterials.tree}>
            <sphereGeometry args={[1.8, 12, 12]} />
          </mesh>
        </group>
      ))}

      {/* 6. Aster Medcity Trauma Center Complex (Destination) */}
      <group position={[230, 0, 60]}>
        {/* Main Hospital Wing */}
        <mesh position={[0, 16, 0]} material={shaderMaterials.hospital}>
          <boxGeometry args={[36, 32, 28]} />
        </mesh>
        {/* Trauma ER Drop-off Canopy */}
        <mesh position={[-18, 4, 0]} material={shaderMaterials.hospital}>
          <boxGeometry args={[12, 8, 22]} />
        </mesh>
        {/* Helipad on roof */}
        <mesh position={[0, 32.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[7, 24]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      </group>

      {/* 7. 3D Signal Heads with Dynamic Preemption Glow */}
      {CORRIDOR_JUNCTION_NODES.map((jn) => (
        <JunctionSignalPoles key={`signals-${jn.id}`} junctionNode={jn} simRef={simRef} />
      ))}
    </group>
  );
}

// 3D Signal Poles at Junctions
function JunctionSignalPoles({
  junctionNode,
  simRef,
}: {
  junctionNode: (typeof CORRIDOR_JUNCTION_NODES)[0];
  simRef: React.RefObject<CorridorSimulation>;
}) {
  const signalRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    if (!simRef.current || !signalRef.current) return;
    const j = simRef.current.junctions.find((item) => item.id === junctionNode.id);
    if (j) {
      if (j.preemptionState === "EMERGENCY_GREEN") {
        signalRef.current.color.set("#10b981"); // Emerald Preempted
      } else if (j.signals.ambulanceApproach === "green") {
        signalRef.current.color.set("#22c55e");
      } else if (j.signals.ambulanceApproach === "yellow") {
        signalRef.current.color.set("#f59e0b");
      } else {
        signalRef.current.color.set("#ef4444");
      }
    }
  });

  return (
    <group position={[junctionNode.x, 0, junctionNode.z]}>
      {[
        [-9, 0, -9],
        [9, 0, -9],
        [9, 0, 9],
        [-9, 0, 9],
      ].map(([px, py, pz], i) => (
        <group key={`pole-${i}`} position={[px, py, pz]}>
          {/* Mast */}
          <mesh position={[0, 3.5, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 7, 8]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
          {/* Signal Housing */}
          <mesh position={[0, 6.2, 0]}>
            <boxGeometry args={[0.8, 1.8, 0.8]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          {/* Glowing Lens */}
          <mesh position={[0, 6.2, 0.45]}>
            <sphereGeometry args={[0.3, 12, 12]} />
            <meshBasicMaterial ref={i === 0 ? signalRef : undefined} color="#10b981" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
