import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Theme = "machinery" | "architecture" | "engine";

/** 기계: 톱니바퀴 느낌의 링 + 허브 */
function MachineryModel() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.4;
  });
  return (
    <group ref={ref}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.45, 0.12, 16, 24]} />
        <meshStandardMaterial color="#a1a1aa" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.08, 16]} />
        <meshStandardMaterial color="#71717a" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

/** 건축: 단순 건물 블록 */
function ArchitectureModel() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.25;
  });
  return (
    <group ref={ref}>
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.5, 0.4, 0.35]} />
        <meshStandardMaterial color="#d4d4d8" metalness={0.2} roughness={0.6} />
      </mesh>
      <mesh position={[0.1, 0.15, 0]}>
        <boxGeometry args={[0.25, 0.25, 0.2]} />
        <meshStandardMaterial color="#a1a1aa" metalness={0.15} roughness={0.65} />
      </mesh>
    </group>
  );
}

/** 엔진: 실린더 블록 */
function EngineModel() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.3;
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.35, 0.38, 0.3, 24]} />
        <meshStandardMaterial color="#71717a" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.15, 16]} />
        <meshStandardMaterial color="#a1a1aa" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

function ThemeModel({ theme }: { theme: Theme }) {
  if (theme === "machinery") return <MachineryModel />;
  if (theme === "architecture") return <ArchitectureModel />;
  return <EngineModel />;
}

type Showcase3DItemProps = {
  theme: Theme;
  format: "STL" | "OBJ" | "GLB";
  description: string;
  useCase?: string;
};

export function Showcase3DItem({ theme, format, description, useCase }: Showcase3DItemProps) {
  return (
    <article className="showcase-card">
      <div className="showcase-card-viewport">
        <Canvas
          camera={{ position: [0, 0, 1.35], fov: 42 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
        >
          <color attach="background" args={["#0c0c0f"]} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[3, 2, 4]} intensity={0.9} />
          <directionalLight position={[-2, 1, 2]} intensity={0.25} />
          <pointLight position={[0, 1, 1]} intensity={0.3} distance={3} />
          <ThemeModel theme={theme} />
        </Canvas>
        <span className="showcase-card-format-badge">{format}</span>
        {useCase && <span className="showcase-card-use-badge">{useCase}</span>}
      </div>
      <div className="showcase-card-body">
        <h3 className="showcase-card-title">{format} 포맷</h3>
        <p className="showcase-card-desc">{description}</p>
        <a href="#converter" className="showcase-card-cta">
          이 포맷으로 변환하기
          <span className="showcase-card-cta-arrow" aria-hidden>→</span>
        </a>
      </div>
    </article>
  );
}
