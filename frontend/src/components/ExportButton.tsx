type ExportButtonProps = {
  jobId: string | null;
  getExportUrl: (jobId: string, format: "stl" | "obj" | "glb") => string;
  formats?: ("stl" | "obj" | "glb")[];
  label?: string;
};

export function ExportButton({
  jobId,
  getExportUrl,
  formats = ["stl", "obj"],
  label = "다운로드",
}: ExportButtonProps) {
  if (!jobId) return null;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {formats.map((fmt: "stl" | "obj" | "glb") => (
        <a
          key={fmt}
          href={getExportUrl(jobId, fmt)}
          download={`model.${fmt}`}
          style={{
            padding: "8px 16px",
            background: "#3b82f6",
            color: "white",
            borderRadius: 6,
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          {label} .{fmt.toUpperCase()}
        </a>
      ))}
    </div>
  );
}
