const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export async function healthCheck(): Promise<{ status: string }> {
  const r = await fetch(`${API_BASE}/api/health`);
  if (!r.ok) throw new Error("Health check failed");
  return r.json();
}

export type CadParseResult = {
  job_id: string;
  filename: string | null;
  message: string;
  contour_count?: number;
  converted?: boolean;
};
export async function cadParse(file: File): Promise<CadParseResult> {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch(`${API_BASE}/api/cad/parse`, { method: "POST", body: form });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || "CAD parse failed");
  }
  return r.json();
}

export function cadExportUrl(jobId: string, format: "stl" | "obj" | "glb"): string {
  const fmt = format === "glb" ? "obj" : format;
  return `${API_BASE}/api/cad/export?job_id=${encodeURIComponent(jobId)}&format=${fmt}`;
}

export type ImageExtrudeResult = { job_id: string; filename: string | null; height: number; message: string; contour_count?: number };
export async function imageExtrude(file: File, height: number): Promise<ImageExtrudeResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("height", String(height));
  const r = await fetch(`${API_BASE}/api/image/extrude`, { method: "POST", body: form });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || "Image extrude failed");
  }
  return r.json();
}

export function imageExportUrl(jobId: string, format: "stl" | "obj" | "glb"): string {
  return `${API_BASE}/api/image/export?job_id=${encodeURIComponent(jobId)}&format=${format}`;
}

export type ImageTo3DResult = { job_id: string; filename?: string; mode: string; message: string; contour_count?: number };
export async function imageTo3d(file: File): Promise<ImageTo3DResult> {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch(`${API_BASE}/api/image/to3d`, { method: "POST", body: form });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || "Image to 3D failed");
  }
  return r.json();
}
