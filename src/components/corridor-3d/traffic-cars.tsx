// Procedural 3D Traffic Cars following turning road splines with zero-re-render useFrame updates
import React, { useRef, memo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CorridorSimulation } from "@/lib/sim/corridor-sim";
import { SimCar } from "@/lib/sim/types";

// Shared Geometries & Materials to eliminate WebGL buffer re-allocations and GC pauses
const carBodyGeo = new THREE.BoxGeometry(3.8, 0.8, 1.8);
const carCabinGeo = new THREE.BoxGeometry(2.0, 0.65, 1.6);
const headlightGeo = new THREE.BoxGeometry(0.06, 0.2, 0.35);
const taillightGeo = new THREE.BoxGeometry(0.06, 0.2, 0.3);
const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.25, 8);
const yieldSphereGeo = new THREE.SphereGeometry(0.15, 6, 6);
const collisionBoxGeo = new THREE.BoxGeometry(4.2, 1.6, 2.2);

const cabinMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.2, metalness: 0.8 });
const headlightMat = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 2.5 });
const wheelMat = new THREE.MeshStandardMaterial({ color: "#1e293b" });
const yieldMat = new THREE.MeshStandardMaterial({ color: "#f59e0b", emissive: "#f59e0b", emissiveIntensity: 4.0 });
const collisionWireframeMat = new THREE.MeshBasicMaterial({ color: "#38bdf8", wireframe: true });

export const TrafficCars = memo(function TrafficCars({
  simRef,
  showCollisionBoxes = false,
}: {
  simRef: React.RefObject<CorridorSimulation>;
  showCollisionBoxes?: boolean;
}) {
  const initialCars = simRef.current?.cars || [];

  return (
    <group>
      {initialCars.map((car, idx) => (
        <CarItem
          key={car.id}
          carIndex={idx}
          simRef={simRef}
          initialCar={car}
          showCollisionBoxes={showCollisionBoxes}
        />
      ))}
    </group>
  );
});

const CarItem = memo(function CarItem({
  carIndex,
  simRef,
  initialCar,
  showCollisionBoxes,
}: {
  carIndex: number;
  simRef: React.RefObject<CorridorSimulation>;
  initialCar: SimCar;
  showCollisionBoxes?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const yieldMeshRef = useRef<THREE.Mesh>(null);
  const tailLMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const tailRMatRef = useRef<THREE.MeshStandardMaterial>(null);

  // 60-120fps direct Three.js transform updates without triggering React re-renders
  useFrame(() => {
    const car = simRef.current?.cars[carIndex];
    if (!car || !groupRef.current) return;

    groupRef.current.position.set(car.x, 0, car.z);
    groupRef.current.rotation.set(0, -car.heading, car.roll);

    if (yieldMeshRef.current) {
      yieldMeshRef.current.visible = !!car.isYielding;
    }

    const isBraking = car.speed < 2.0;
    const tailIntensity = isBraking ? 3.5 : 0.8;
    if (tailLMatRef.current) {
      tailLMatRef.current.emissiveIntensity = tailIntensity;
    }
    if (tailRMatRef.current) {
      tailRMatRef.current.emissiveIntensity = tailIntensity;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[initialCar.x, 0, initialCar.z]}
      rotation={[0, -initialCar.heading, initialCar.roll]}
    >
      {/* 1. Car Lower Body */}
      <mesh position={[0, 0.6, 0]} geometry={carBodyGeo}>
        <meshStandardMaterial color={initialCar.color} roughness={0.4} metalness={0.2} />
      </mesh>

      {/* 2. Car Cabin Roof & Windows */}
      <mesh position={[-0.2, 1.25, 0]} geometry={carCabinGeo} material={cabinMat} />

      {/* 3. Front Headlights */}
      <mesh position={[1.92, 0.55, 0.6]} geometry={headlightGeo} material={headlightMat} />
      <mesh position={[1.92, 0.55, -0.6]} geometry={headlightGeo} material={headlightMat} />

      {/* 4. Rear Tail Brake Lights */}
      <mesh position={[-1.92, 0.55, 0.6]} geometry={taillightGeo}>
        <meshStandardMaterial ref={tailLMatRef} color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[-1.92, 0.55, -0.6]} geometry={taillightGeo}>
        <meshStandardMaterial ref={tailRMatRef} color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} />
      </mesh>

      {/* 5. Wheels */}
      <mesh position={[1.1, 0.3, 0.95]} rotation={[Math.PI / 2, 0, 0]} geometry={wheelGeo} material={wheelMat} />
      <mesh position={[1.1, 0.3, -0.95]} rotation={[Math.PI / 2, 0, 0]} geometry={wheelGeo} material={wheelMat} />
      <mesh position={[-1.1, 0.3, 0.95]} rotation={[Math.PI / 2, 0, 0]} geometry={wheelGeo} material={wheelMat} />
      <mesh position={[-1.1, 0.3, -0.95]} rotation={[Math.PI / 2, 0, 0]} geometry={wheelGeo} material={wheelMat} />

      {/* 6. Yielding amber indicator */}
      <mesh ref={yieldMeshRef} position={[0, 1.7, 0.8]} geometry={yieldSphereGeo} material={yieldMat} visible={false} />

      {/* 7. Debug Collision Box Wireframe */}
      {showCollisionBoxes && (
        <mesh position={[0, 0.8, 0]} geometry={collisionBoxGeo} material={collisionWireframeMat} />
      )}
    </group>
  );
});
