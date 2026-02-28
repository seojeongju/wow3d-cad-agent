const API_BASE = import.meta.env.VITE_API_BASE ?? "";

/** Parse API error response (FastAPI detail or plain text) for user-facing message. */
export async function parseApiError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const json = JSON.parse(text) as { detail?: string | { msg?: string }[] };
    if (typeof json.detail === "string") return json.detail;
    if (Array.isArray(json.detail) && json.detail[0]?.msg) return json.detail[0].msg;
  } catch {
    /* ignore */
  }
  return text || "요청에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}

export async function healthCheck(): Promise<{ status: string }> {
  const r = await fetch(`${API_BASE}/api/health`);
  if (!r.ok) throw new Error(await parseApiError(r));
  return r.json();
}

export type CadParseResult = {
  job_id: string;
  filename: string | null;
  message: string;
  contour_count?: number;
  converted?: boolean;
};
export async function cadParse(file: File, height: number = 1.0): Promise<CadParseResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("height", String(height));
  const r = await fetch(`${API_BASE}/api/cad/parse`, { method: "POST", body: form });
  if (!r.ok) throw new Error(await parseApiError(r));
  return r.json();
}

export function cadExportUrl(jobId: string, format: "stl" | "obj" | "glb"): string {
  const fmt = format === "glb" ? "obj" : format;
  return `${API_BASE}/api/cad/export?job_id=${encodeURIComponent(jobId)}&format=${fmt}`;
}

export type ImageExtrudeResult = { job_id: string; filename: string | null; height: number; message: string; contour_count?: number };
export type ImageOptions = { invert?: boolean; sensitivity?: "low" | "medium" | "high" };
export async function imageExtrude(file: File, height: number, options?: ImageOptions): Promise<ImageExtrudeResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("height", String(height));
  if (options?.invert !== undefined) form.append("invert", options.invert ? "true" : "false");
  if (options?.sensitivity) form.append("sensitivity", options.sensitivity);
  const r = await fetch(`${API_BASE}/api/image/extrude`, { method: "POST", body: form });
  if (!r.ok) throw new Error(await parseApiError(r));
  return r.json();
}

export function imageExportUrl(jobId: string, format: "stl" | "obj" | "glb"): string {
  return `${API_BASE}/api/image/export?job_id=${encodeURIComponent(jobId)}&format=${format}`;
}

export type ImageTo3DResult = { job_id: string; filename?: string; mode: string; message: string; contour_count?: number };
export async function imageTo3d(file: File, options?: ImageOptions): Promise<ImageTo3DResult> {
  const form = new FormData();
  form.append("file", file);
  if (options?.invert !== undefined) form.append("invert", options.invert ? "true" : "false");
  if (options?.sensitivity) form.append("sensitivity", options.sensitivity);
  const r = await fetch(`${API_BASE}/api/image/to3d`, { method: "POST", body: form });
  if (!r.ok) throw new Error(await parseApiError(r));
  return r.json();
}
