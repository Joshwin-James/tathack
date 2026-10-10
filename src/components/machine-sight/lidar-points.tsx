// High-Performance Instanced Point Cloud & Concentric LIDAR Scan Waves for Machine Sight
import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CorridorSimulation } from "@/lib/sim/corridor-sim";
import { ROAD_SEGMENTS, CORRIDOR_JUNCTION_NODES } from "@/lib/sim/road-graph";

interface LidarPointsProps {
  simRef: React.RefObject<CorridorSimulation>;
  zoneCenter: [number, number];
  zoneRadius: number;
  sensorMode: 0 | 1 | 2;
  lowQuality?: boolean;
}

export function LidarPoints({ simRef, zoneCenter, zoneRadius, sensorMode, lowQuality }: LidarPointsProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const ringsGroupRef = useRef<THREE.Group>(null);

  // Generate dense synthetic point cloud geometry along city structures
  const { positions, colors } = useMemo(() => {
    const pointList: number[] = [];
    const colorList: number[] = [];

    const addPoint = (x: number, y: number, z: number, r: number, g: number, b: number) => {
      pointList.push(x, y, z);
      colorList.push(r, g, b);
    };

    // 1. Road Edges & Curb Points
    ROAD_SEGMENTS.forEach((seg) => {
      const step = lowQuality ? 6 : 3;
      const count = Math.floor(seg.length / step);
      const perpAngle = seg.heading + Math.PI / 2;
      const nx = Math.cos(perpAngle);
      const nz = Math.sin(perpAngle);

      for (let i = 0; i <= count; i++) {
        const t = i / count;
        const px = seg.start[0] + (seg.end[0] - seg.start[0]) * t;
        const pz = seg.start[1] + (seg.end[1] - seg.start[1]) * t;

        const halfWidth = seg.width / 2;

        // Left curb and right curb
        addPoint(px + nx * halfWidth, 0.15, pz + nz * halfWidth, 0.0, 0.85, 1.0);
        addPoint(px - nx * halfWidth, 0.15, pz - nz * halfWidth, 0.0, 0.85, 1.0);

        // Center line dots
        if (i % 2 === 0) {
          addPoint(px, 0.1, pz, 0.9, 0.8, 0.1);
        }
      }
    });

    // 2. Building Facade & Corner Points
    const blockCenters: [number, number][] = [
      [-155, -135], [-155, -60], [-155, 20], [-155, 100],
      [-55, -135], [-55, -60], [-55, 20], [-55, 100],
      [65, -135], [65, -60], [65, 20], [65, 130],
      [145, -135], [145, -40], [145, 30], [145, 130],
      [215, -80], [215, 80],
    ];

    blockCenters.forEach(([bx, bz]) => {
      for (let bIdx = 0; bIdx < 2; bIdx++) {
        const ox = (bIdx === 0 ? -1 : 1) * 14;
        const cx = bx + ox;
        const cz = bz;
        const height = 16 + (Math.abs(bx * 7 + bz * 13 + bIdx * 19) % 32);

        // Horizontal slices
        const slices = lowQuality ? 4 : 8;
        for (let s = 1; s <= slices; s++) {
          const y = (s / slices) * height;
          const half = 10;
          for (let e = -half; e <= half; e += (lowQuality ? 5 : 2.5)) {
            addPoint(cx + e, y, cz - half, 0.1, 0.5, 0.9);
            addPoint(cx + e, y, cz + half, 0.1, 0.5, 0.9);
            addPoint(cx - half, y, cz + e, 0.1, 0.5, 0.9);
            addPoint(cx + half, y, cz + e, 0.1, 0.5, 0.9);
          }
        }
      }
    });

    // 3. Junction Grid Points
    CORRIDOR_JUNCTION_NODES.forEach((jn) => {
      const half = 8;
      for (let x = -half; x <= half; x += 4) {
        for (let z = -half; z <= half; z += 4) {
          addPoint(jn.x + x, 0.12, jn.z + z, 0.1, 0.9, 0.5);
        }
      }
    });

    return {
      positions: new Float32Array(pointList),
      colors: new Float32Array(colorList),
    };
  }, [lowQuality]);

  // Point Cloud Shader Material
  const pointShaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uZoneCenter: { value: new THREE.Vector2(0, 0) },
        uZoneRadius: { value: zoneRadius },
        uTime: { value: 0 },
        uSensorMode: { value: sensorMode },
      },
      vertexShader: `
        uniform vec2 uZoneCenter;
        uniform float uZoneRadius;
        uniform float uTime;
        uniform int uSensorMode;
        
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vColor = color;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          float dist = length(worldPos.xz - uZoneCenter);

          if (dist > uZoneRadius || uSensorMode != 0) {
            vAlpha = 0.0;
          } else {
            float scan = sin(dist * 0.5 - uTime * 6.0) * 0.5 + 0.5;
            vAlpha = smoothstep(uZoneRadius, uZoneRadius - 8.0, dist) * (0.35 + scan * 0.65);
          }

          vec4 viewPos = viewMatrix * worldPos;
          gl_Position = projectionMatrix * viewPos;
          gl_PointSize = 3.5 * (100.0 / -viewPos.z);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          if (vAlpha <= 0.01) discard;
          vec2 coord = gl_PointCoord - vec2(0.5);
          if (length(coord) > 0.5) discard;
          gl_FragColor = vec4(vColor, vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [sensorMode, zoneRadius]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    pointShaderMaterial.uniforms.uZoneCenter.value.set(zoneCenter[0], zoneCenter[1]);
    pointShaderMaterial.uniforms.uZoneRadius.value = zoneRadius;
    pointShaderMaterial.uniforms.uSensorMode.value = sensorMode;
    pointShaderMaterial.uniforms.uTime.value = time;

    // Animate concentric rings
    if (ringsGroupRef.current) {
      ringsGroupRef.current.position.set(zoneCenter[0], 0.2, zoneCenter[1]);
    }
  });

  return (
    <group>
      {/* 1. Point Cloud */}
      <points ref={pointsRef} material={pointShaderMaterial}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[colors, 3]}
          />
        </bufferGeometry>
      </points>

      {/* 2. Concentric LIDAR Range Rings */}
      {sensorMode === 0 && (
        <group ref={ringsGroupRef}>
          {[15, 30, 45, 60].map((radius, idx) => (
            <mesh key={`ring-${idx}`} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[radius - 0.2, radius, 64]} />
              <meshBasicMaterial
                color="#00f0ff"
                transparent
                opacity={0.35 - idx * 0.06}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
