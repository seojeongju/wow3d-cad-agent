import { Suspense } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

type Viewer3DProps = {
  /** URL to STL, OBJ, or GLB */
  modelUrl: string | null;
  format?: "stl" | "obj" | "glb";
  className?: string;
};

function StlModel({ url }: { url: string }) {
  const geom = useLoader(STLLoader, url);
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial color="#6b7fd7" metalness={0.2} roughness={0.6} />
    </mesh>
  );
}

function ObjModel({ url }: { url: string }) {
  const obj = useLoader(OBJLoader, url);
  const cloned = obj.clone();
  cloned.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      const m = (c as THREE.Mesh).material;
      if (m && !Array.isArray(m)) {
        (m as THREE.MeshStandardMaterial).color?.set("#6b7fd7");
      }
    }
  });
  return <primitive object={cloned} />;
}

function GlbModel({ url }: { url: string }) {
  const { scene } = useGLTF(url, true);
  const cloned = scene.clone(true);
  cloned.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      const m = (c as THREE.Mesh).material;
      if (m && !Array.isArray(m) && (m as THREE.MeshStandardMaterial).color) {
        (m as THREE.MeshStandardMaterial).color.set("#6b7fd7");
      }
    }
  });
  return <primitive object={cloned} />;
}

function Model({ url, format }: { url: string; format: "stl" | "obj" | "glb" }) {
  if (format === "stl") return <StlModel url={url} />;
  if (format === "glb") return <GlbModel url={url} />;
  return <ObjModel url={url} />;
}

function Fallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#3f3f46" wireframe />
    </mesh>
  );
}

export function Viewer3D({ modelUrl, format = "stl", className = "" }: Viewer3DProps) {
  if (!modelUrl) {
    return (
      <div className={className} style={{ background: "#18181b", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 320 }}>
        <span style={{ color: "#71717a" }}>3D 모델을 업로드하고 변환하면 여기에 표시됩니다</span>
      </div>
    );
  }

  return (
    <div className={className} style={{ background: "#18181b", borderRadius: 8, overflow: "hidden", minHeight: 320 }}>
      <Canvas camera={{ position: [4, 4, 4], fov: 45 }} gl={{ antialias: true }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <directionalLight position={[-5, -5, 5]} intensity={0.4} />
        <Suspense fallback={<Fallback />}>
          <Model url={modelUrl} format={format} />
        </Suspense>
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
