import { Component, Suspense, useEffect, useRef } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

class ViewerErrorBoundary extends Component<{ fallback: React.ReactNode; children: React.ReactNode }> {
  state = { hasError: false };
  static getDerivedStateFromError = () => ({ hasError: true });
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function disposeObject(obj: THREE.Object3D) {
  obj.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      const m = (c as THREE.Mesh);
      m.geometry?.dispose();
      if (m.material) {
        const arr = Array.isArray(m.material) ? m.material : [m.material];
        arr.forEach((mat) => (mat as THREE.Material).dispose?.());
      }
    }
  });
}

type Viewer3DProps = {
  /** URL to STL, OBJ, or GLB */
  modelUrl: string | null;
  format?: "stl" | "obj" | "glb";
  className?: string;
};

const FIT_SIZE = 2; // fit model so max dimension is this (camera at ~4,4,4)

function StlModel({ url }: { url: string }) {
  const geom = useLoader(STLLoader, url);
  const fitted = useRef(false);
  if (!fitted.current) {
    geom.computeBoundingBox();
    geom.computeVertexNormals();
    const bbox = geom.boundingBox!;
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    geom.translate(-center.x, -center.y, -center.z);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
    const scale = FIT_SIZE / maxDim;
    geom.scale(scale, scale, scale);
    fitted.current = true;
  }
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial color="#6b7fd7" metalness={0.2} roughness={0.6} />
    </mesh>
  );
}

function ObjModel({ url }: { url: string }) {
  const obj = useLoader(OBJLoader, url);
  const clonedRef = useRef<THREE.Group | null>(null);
  const fitted = useRef(false);
  const cloned = obj.clone();
  clonedRef.current = cloned;
  cloned.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      const m = (c as THREE.Mesh).material;
      if (m && !Array.isArray(m)) {
        (m as THREE.MeshStandardMaterial).color?.set("#6b7fd7");
      }
    }
  });
  if (!fitted.current) {
    const box = new THREE.Box3().setFromObject(cloned);
    const center = new THREE.Vector3();
    box.getCenter(center);
    cloned.position.sub(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
    cloned.scale.multiplyScalar(FIT_SIZE / maxDim);
    fitted.current = true;
  }
  useEffect(() => () => { if (clonedRef.current) disposeObject(clonedRef.current); }, []);
  return <primitive object={cloned} />;
}

function GlbModel({ url }: { url: string }) {
  const { scene } = useGLTF(url, true);
  const cloned = scene.clone(true);
  const fitted = useRef(false);
  cloned.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      const m = (c as THREE.Mesh).material;
      if (m && !Array.isArray(m) && (m as THREE.MeshStandardMaterial).color) {
        (m as THREE.MeshStandardMaterial).color.set("#6b7fd7");
      }
    }
  });
  if (!fitted.current) {
    const box = new THREE.Box3().setFromObject(cloned);
    const center = new THREE.Vector3();
    box.getCenter(center);
    cloned.position.sub(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
    cloned.scale.multiplyScalar(FIT_SIZE / maxDim);
    fitted.current = true;
  }
  useEffect(() => () => disposeObject(cloned), []);
  return <primitive object={cloned} />;
}

function Model({ url, format }: { url: string; format: "stl" | "obj" | "glb" }) {
  if (format === "stl") return <StlModel url={url} />;
  if (format === "glb") return <GlbModel url={url} />;
  return <ObjModel url={url} />;
}

function ModelWithErrorBoundary({ url, format }: { url: string; format: "stl" | "obj" | "glb" }) {
  return (
    <ViewerErrorBoundary
      fallback={
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#3f3f46" wireframe />
        </mesh>
      }
    >
      <Model url={url} format={format} />
    </ViewerErrorBoundary>
  );
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

  const bg = "#18181b";
  return (
    <div className={className} style={{ background: bg, borderRadius: 8, overflow: "hidden", minHeight: 320 }}>
      <Canvas camera={{ position: [4, 4, 4], fov: 45 }} gl={{ antialias: true }}>
        <color attach="background" args={[bg]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <directionalLight position={[-5, -5, 5]} intensity={0.4} />
        <Suspense fallback={<Fallback />}>
          <ModelWithErrorBoundary url={modelUrl} format={format} />
        </Suspense>
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
