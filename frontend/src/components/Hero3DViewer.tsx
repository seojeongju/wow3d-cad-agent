import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/** Procedural CAD-style 3D model for hero - gear/pipe aesthetic */
function HeroModel() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.15;
    }
  });

  return (
    <group>
      {/* Main torus knot - 색상을 페이지와 조화되게 뮤트 톤 */}
      <mesh ref={meshRef} castShadow receiveShadow>
        <torusKnotGeometry args={[0.6, 0.2, 128, 32]} />
        <meshStandardMaterial
          color="#71717a"
          metalness={0.75}
          roughness={0.25}
          envMapIntensity={0.8}
          emissive="#27272a"
          emissiveIntensity={0.08}
        />
      </mesh>
      {/* Inner ring - 악센트를 은은하게 */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.3]}>
        <torusGeometry args={[0.85, 0.03, 16, 64]} />
        <meshStandardMaterial
          color="#52525b"
          metalness={0.8}
          roughness={0.2}
          transparent
          opacity={0.5}
        />
      </mesh>
    </group>
  );
}

type Hero3DViewerProps = {
  className?: string;
};

export function Hero3DViewer({ className = "" }: Hero3DViewerProps) {
  return (
    <div className={className} style={{ aspectRatio: "4/3", minHeight: 280, position: "relative", width: "100%" }}>
      <Canvas
        camera={{ position: [2.5, 1.5, 2.5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#0f0f12"]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 5, 5]} intensity={0.9} color="#e4e4e7" />
        <directionalLight position={[-3, 2, -2]} intensity={0.35} color="#a1a1aa" />
        <pointLight position={[0, 2, 2]} intensity={0.25} color="#6366f1" />
        <HeroModel />
        <OrbitControls
          makeDefault
          enableZoom={true}
          enablePan={true}
          minDistance={1.5}
          maxDistance={5}
          autoRotate
          autoRotateSpeed={0.8}
        />
      </Canvas>
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 11,
          color: "rgba(161, 161, 170, 0.75)",
          pointerEvents: "none",
        }}
      >
        드래그하여 회전 · 스크롤하여 확대
      </div>
    </div>
  );
}
