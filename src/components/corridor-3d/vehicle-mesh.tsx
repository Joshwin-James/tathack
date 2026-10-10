// Procedural 3D Emergency Vehicle (Ambulance, Fire Engine, Police) with heading tangent, corner banking & collision wireframe
import React, { useRef, useMemo, memo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CorridorSimulation } from "@/lib/sim/corridor-sim";
import { VehicleType } from "@/lib/sim/types";

// Shared Geometries
const chassisGeo = new THREE.BoxGeometry(5.2, 2.0, 2.4);
const hoodGeo = new THREE.BoxGeometry(1.6, 1.4, 2.3);
const windshieldGeo = new THREE.BoxGeometry(1.2, 0.9, 2.2);
const stripeGeo = new THREE.BoxGeometry(5.0, 0.35, 0.05);
const sirenBaseGeo = new THREE.BoxGeometry(1.2, 0.3, 1.8);
const sirenLightGeo = new THREE.BoxGeometry(0.8, 0.3, 0.5);
const headlightGeo = new THREE.BoxGeometry(0.1, 0.3, 0.45);
const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12);
const emergencyCollisionBoxGeo = new THREE.BoxGeometry(5.6, 2.4, 2.8);

const windshieldMat = new THREE.MeshStandardMaterial({ color: "#0284c7", roughness: 0.1, metalness: 0.9 });
const sirenBaseMat = new THREE.MeshStandardMaterial({ color: "#0f172a" });
const headlightMat = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 3.5 });
const wheelMat = new THREE.MeshStandardMaterial({ color: "#1e293b" });
const collisionWireframeMat = new THREE.MeshBasicMaterial({ color: "#10b981", wireframe: true });

export const VehicleMesh = memo(function VehicleMesh({
  simRef,
  type,
  showCollisionBox = false,
}: {
  simRef: React.RefObject<CorridorSimulation>;
  type: VehicleType;
  showCollisionBox?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const redSirenMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const blueSirenMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const wheelRefs = useRef<THREE.Mesh[]>([]);

  // Siren flashing state, wheel rotation & direct transform update on 60fps WebGL loop
  useFrame((state) => {
    const v = simRef.current?.vehicle;
    if (!v) return;

    if (groupRef.current) {
      groupRef.current.position.set(v.x, 0, v.z);
      groupRef.current.rotation.set(0, -v.heading, v.roll);
    }

    const time = state.clock.getElapsedTime();
    const flashFreq = type === "police" ? 14 : type === "fire" ? 9 : 12;
    const isRedActive = Math.sin(time * flashFreq) > 0;

    if (redSirenMatRef.current) {
      redSirenMatRef.current.emissiveIntensity = isRedActive ? 5.0 : 0.4;
    }
    if (blueSirenMatRef.current) {
      blueSirenMatRef.current.emissiveIntensity = !isRedActive ? 5.0 : 0.4;
    }

    const wheelRotDelta = v.speed * 0.18;
    for (let i = 0; i < wheelRefs.current.length; i++) {
      const wheel = wheelRefs.current[i];
      if (wheel) {
        wheel.rotation.z -= wheelRotDelta;
      }
    }
  });

  const style = useMemo(() => {
    if (type === "fire") {
      return {
        bodyColor: "#dc2626",
        stripeColor: "#fde047",
        sirenRed: "#ef4444",
        sirenBlue: "#f59e0b",
      };
    }
    if (type === "police") {
      return {
        bodyColor: "#0f172a",
        stripeColor: "#ffffff",
        sirenRed: "#ef4444",
        sirenBlue: "#3b82f6",
      };
    }
    return {
      bodyColor: "#f8fafc",
      stripeColor: "#ef4444",
      sirenRed: "#ef4444",
      sirenBlue: "#3b82f6",
    };
  }, [type]);

  const initialV = simRef.current?.vehicle || { x: -190, z: -100, heading: 0, roll: 0 };

  return (
    <group
      ref={groupRef}
      position={[initialV.x, 0, initialV.z]}
      rotation={[0, -initialV.heading, initialV.roll]}
    >
      {/* 1. Main Vehicle Body Chassis */}
      <mesh position={[0, 1.4, 0]} geometry={chassisGeo}>
        <meshStandardMaterial color={style.bodyColor} roughness={0.3} metalness={0.1} />
      </mesh>

      {/* 2. Cabin Front Slanted Hood & Windshield */}
      <mesh position={[1.8, 1.1, 0]} geometry={hoodGeo}>
        <meshStandardMaterial color={style.bodyColor} roughness={0.3} />
      </mesh>

      {/* Windshield Glass */}
      <mesh position={[1.4, 1.8, 0]} rotation={[0, 0, -0.3]} geometry={windshieldGeo} material={windshieldMat} />

      {/* 3. Side Emergency Stripes */}
      <mesh position={[0, 1.2, 1.22]} geometry={stripeGeo}>
        <meshStandardMaterial color={style.stripeColor} />
      </mesh>
      <mesh position={[0, 1.2, -1.22]} geometry={stripeGeo}>
        <meshStandardMaterial color={style.stripeColor} />
      </mesh>

      {/* 4. Roof Siren Light Bar */}
      <mesh position={[0.2, 2.55, 0]} geometry={sirenBaseGeo} material={sirenBaseMat} />

      {/* Red Siren Strobe */}
      <mesh position={[0.2, 2.75, 0.6]} geometry={sirenLightGeo}>
        <meshStandardMaterial
          ref={redSirenMatRef}
          color={style.sirenRed}
          emissive={style.sirenRed}
          emissiveIntensity={3.5}
        />
      </mesh>

      {/* Blue Siren Strobe */}
      <mesh position={[0.2, 2.75, -0.6]} geometry={sirenLightGeo}>
        <meshStandardMaterial
          ref={blueSirenMatRef}
          color={style.sirenBlue}
          emissive={style.sirenBlue}
          emissiveIntensity={3.5}
        />
      </mesh>

      {/* 5. Headlights */}
      <mesh position={[2.62, 0.9, 0.8]} geometry={headlightGeo} material={headlightMat} />
      <mesh position={[2.62, 0.9, -0.8]} geometry={headlightGeo} material={headlightMat} />

      {/* 6. Wheels */}
      <mesh
        ref={(el) => {
          if (el) wheelRefs.current[0] = el;
        }}
        position={[1.5, 0.45, 1.25]}
        rotation={[Math.PI / 2, 0, 0]}
        geometry={wheelGeo}
        material={wheelMat}
      />
      <mesh
        ref={(el) => {
          if (el) wheelRefs.current[1] = el;
        }}
        position={[1.5, 0.45, -1.25]}
        rotation={[Math.PI / 2, 0, 0]}
        geometry={wheelGeo}
        material={wheelMat}
      />
      <mesh
        ref={(el) => {
          if (el) wheelRefs.current[2] = el;
        }}
        position={[-1.5, 0.45, 1.25]}
        rotation={[Math.PI / 2, 0, 0]}
        geometry={wheelGeo}
        material={wheelMat}
      />
      <mesh
        ref={(el) => {
          if (el) wheelRefs.current[3] = el;
        }}
        position={[-1.5, 0.45, -1.25]}
        rotation={[Math.PI / 2, 0, 0]}
        geometry={wheelGeo}
        material={wheelMat}
      />

      {/* 7. Debug Collision Box Wireframe */}
      {showCollisionBox && (
        <mesh position={[0, 1.2, 0]} geometry={emergencyCollisionBoxGeo} material={collisionWireframeMat} />
      )}
    </group>
  );
});
