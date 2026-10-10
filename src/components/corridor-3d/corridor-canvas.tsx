// Client-Only Three.js Canvas with R3F, PostProcessing Bloom & Smooth Turning Camera Controllers
import React, { useEffect, useState, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { CityScene } from "./city-scene";
import { VehicleMesh } from "./vehicle-mesh";
import { TrafficCars } from "./traffic-cars";
import { CorridorSimulation } from "@/lib/sim/corridor-sim";
import { CameraMode, VehicleType } from "@/lib/sim/types";

interface CorridorCanvasProps {
  simRef: React.RefObject<CorridorSimulation>;
  isRunning: boolean;
  vehicleType: VehicleType;
  greenCorridorActive: boolean;
  cameraMode: CameraMode;
  lowQuality?: boolean;
  showCollisionBoxes?: boolean;
}

export function CorridorCanvas(props: CorridorCanvasProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof window === "undefined") {
    return (
      <div className="w-full h-full min-h-[540px] bg-slate-950 flex items-center justify-center text-slate-500 font-mono text-xs">
        Initializing 3D Green Corridor Scene...
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[540px] relative rounded-3xl overflow-hidden bg-[#070b14]">
      <Canvas
        camera={{ position: [-210, 45, -70], fov: 48, near: 0.5, far: 1000 }}
        dpr={[1, props.lowQuality ? 1 : 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        {/* Sky / Deep Night Fog */}
        <color attach="background" args={["#070b14"]} />
        <fog attach="fog" args={["#070b14", 100, 550]} />

        {/* Lighting Setup */}
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[60, 150, 60]}
          intensity={0.8}
        />

        {/* 60fps Native Physics Stepper inside WebGL Render Loop */}
        <SimStepper simRef={props.simRef} isRunning={props.isRunning} />

        {/* Camera Controller with Turn Smoothing & Multi-Shot Director */}
        <CameraController mode={props.cameraMode} simRef={props.simRef} />

        {/* 3D City Scene (Road Network, Buildings, Signals, Hospital) */}
        <CityScene
          simRef={props.simRef}
          greenCorridorActive={props.greenCorridorActive}
        />

        {/* Emergency Vehicle Mesh */}
        <VehicleMesh
          simRef={props.simRef}
          type={props.vehicleType}
          showCollisionBox={props.showCollisionBoxes}
        />

        {/* AI Traffic Cars */}
        <TrafficCars simRef={props.simRef} showCollisionBoxes={props.showCollisionBoxes} />

        {/* Orbit Controls when in orbit mode */}
        {props.cameraMode === "orbit" && (
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            maxPolarAngle={Math.PI / 2 - 0.05}
            minDistance={10}
            maxDistance={500}
          />
        )}

        {/* Postprocessing (Bloom & Vignette) */}
        {!props.lowQuality && (
          <EffectComposer>
            <Bloom
              luminanceThreshold={0.8}
              luminanceSmoothing={0.35}
              intensity={0.85}
              mipmapBlur
            />
            <Vignette eskil={false} offset={0.15} darkness={0.85} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}

// 60-120fps physics loop stepping inside Canvas
function SimStepper({
  simRef,
  isRunning,
}: {
  simRef: React.RefObject<CorridorSimulation>;
  isRunning: boolean;
}) {
  useFrame((_, delta) => {
    if (isRunning && simRef.current && typeof document !== "undefined" && !document.hidden) {
      simRef.current.step(Math.min(0.05, delta));
    }
  });
  return null;
}

// Multi-Shot Cinematic Director Camera with dynamic angles, corner tracking & smooth framing
function CameraController({
  mode,
  simRef,
}: {
  mode: CameraMode;
  simRef: React.RefObject<CorridorSimulation>;
}) {
  const { camera } = useThree();
  const smoothCamPos = useRef(new THREE.Vector3(-210, 45, -70));
  const smoothLookAt = useRef(new THREE.Vector3(-190, 1.4, -100));

  // Cinematic shot switcher state
  const shotState = useRef({
    currentShot: 0, // 0: Low-Angle Flyby, 1: Front-Facing Leading, 2: Elevated Apex Pan, 3: Rooftop Drone
    timer: 0,
    targetShotDuration: 7.5, // Switch dynamic angles every ~7.5 seconds
  });

  useFrame((_, delta) => {
    if (mode === "orbit") return;
    const vehicle = simRef.current?.vehicle;
    if (!vehicle) return;

    const lerpFactor = Math.min(1.0, delta * 4.0);
    const cosH = Math.cos(vehicle.heading);
    const sinH = Math.sin(vehicle.heading);

    // Left normal vector (perpendicular to road)
    const normX = -sinH;
    const normZ = cosH;

    if (mode === "chase") {
      // Smooth dynamic follow camera behind vehicle
      const targetX = vehicle.x - 22 * cosH;
      const targetZ = vehicle.z - 22 * sinH;
      const targetY = 9.5;

      smoothCamPos.current.x += (targetX - smoothCamPos.current.x) * lerpFactor;
      smoothCamPos.current.y += (targetY - smoothCamPos.current.y) * lerpFactor;
      smoothCamPos.current.z += (targetZ - smoothCamPos.current.z) * lerpFactor;

      const lookTargetX = vehicle.x + 8 * cosH;
      const lookTargetZ = vehicle.z + 8 * sinH;
      const lookTargetY = 1.6;

      smoothLookAt.current.x += (lookTargetX - smoothLookAt.current.x) * lerpFactor;
      smoothLookAt.current.y += (lookTargetY - smoothLookAt.current.y) * lerpFactor;
      smoothLookAt.current.z += (lookTargetZ - smoothLookAt.current.z) * lerpFactor;

      camera.position.copy(smoothCamPos.current);
      camera.lookAt(smoothLookAt.current);
    } else if (mode === "top_down") {
      // Tactical top-down command radar view
      const targetX = vehicle.x;
      const targetZ = vehicle.z;
      const targetY = 125;

      smoothCamPos.current.x += (targetX - smoothCamPos.current.x) * lerpFactor;
      smoothCamPos.current.y += (targetY - smoothCamPos.current.y) * lerpFactor;
      smoothCamPos.current.z += (targetZ - smoothCamPos.current.z) * lerpFactor;

      smoothLookAt.current.x = vehicle.x;
      smoothLookAt.current.y = 0;
      smoothLookAt.current.z = vehicle.z;

      camera.position.copy(smoothCamPos.current);
      camera.lookAt(smoothLookAt.current);
    } else if (mode === "cinematic") {
      // Director Cinematic Camera: Cycles between 4 Hollywood Action Shots
      shotState.current.timer += delta;
      if (shotState.current.timer >= shotState.current.targetShotDuration) {
        shotState.current.timer = 0;
        shotState.current.currentShot = (shotState.current.currentShot + 1) % 4;
      }

      const shot = shotState.current.currentShot;
      let targetCamX = vehicle.x;
      let targetCamY = 10;
      let targetCamZ = vehicle.z;

      let lookTargetX = vehicle.x;
      let lookTargetY = 1.5;
      let lookTargetZ = vehicle.z;

      if (shot === 0) {
        // Shot 1: Low-Angle Side-Flyby (Action tracking from outer lane)
        targetCamX = vehicle.x - 12 * cosH + 16 * normX;
        targetCamZ = vehicle.z - 12 * sinH + 16 * normZ;
        targetCamY = 5.5;

        lookTargetX = vehicle.x + 10 * cosH;
        lookTargetZ = vehicle.z + 10 * sinH;
        lookTargetY = 2.0;
      } else if (shot === 1) {
        // Shot 2: Front-Facing Leading Shot (Camera pulls ahead, headlights beaming)
        targetCamX = vehicle.x + 24 * cosH + 4 * normX;
        targetCamZ = vehicle.z + 24 * sinH + 4 * normZ;
        targetCamY = 6.0;

        lookTargetX = vehicle.x;
        lookTargetZ = vehicle.z;
        lookTargetY = 1.4;
      } else if (shot === 2) {
        // Shot 3: High Corner Apex Dolly (Frames the dramatic turn and preemption)
        targetCamX = vehicle.x - 8 * cosH - 18 * normX;
        targetCamZ = vehicle.z - 8 * sinH - 18 * normZ;
        targetCamY = 14.0;

        lookTargetX = vehicle.x + 12 * cosH;
        lookTargetZ = vehicle.z + 12 * sinH;
        lookTargetY = 1.0;
      } else {
        // Shot 4: Elevated Helicopter Drone Tracking Shot
        targetCamX = vehicle.x - 26 * cosH + 10 * normX;
        targetCamZ = vehicle.z - 26 * sinH + 10 * normZ;
        targetCamY = 28.0;

        lookTargetX = vehicle.x + 15 * cosH;
        lookTargetZ = vehicle.z + 15 * sinH;
        lookTargetY = 1.0;
      }

      // Smooth cinematic camera movement with damping
      const cineLerp = Math.min(1.0, delta * 2.8);
      smoothCamPos.current.x += (targetCamX - smoothCamPos.current.x) * cineLerp;
      smoothCamPos.current.y += (targetCamY - smoothCamPos.current.y) * cineLerp;
      smoothCamPos.current.z += (targetCamZ - smoothCamPos.current.z) * cineLerp;

      smoothLookAt.current.x += (lookTargetX - smoothLookAt.current.x) * (cineLerp * 1.4);
      smoothLookAt.current.y += (lookTargetY - smoothLookAt.current.y) * (cineLerp * 1.4);
      smoothLookAt.current.z += (lookTargetZ - smoothLookAt.current.z) * (cineLerp * 1.4);

      camera.position.copy(smoothCamPos.current);
      camera.lookAt(smoothLookAt.current);
    }
  });

  return null;
}
