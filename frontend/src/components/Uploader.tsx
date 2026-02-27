import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

type UploaderProps = {
  accept: Record<string, string[]>;
  onUpload: (file: File) => Promise<{ job_id: string }>;
  busy?: boolean;
  children?: React.ReactNode;
};

export function Uploader({ accept, onUpload, busy, children }: UploaderProps) {
  const [progress, setProgress] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      setProgress("uploading");
      setError(null);
      setJobId(null);
      try {
        const result = await onUpload(file);
        setJobId(result.job_id);
        setProgress("done");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
        setProgress("error");
      }
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles: 1,
    disabled: busy,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        style={{
          border: "2px dashed #3f3f46",
          borderRadius: 8,
          padding: 24,
          textAlign: "center",
          cursor: busy ? "not-allowed" : "pointer",
          background: isDragActive ? "#27272a" : "#18181b",
        }}
      >
        <input {...getInputProps()} />
        {children ?? (
          <span style={{ color: "#a1a1aa" }}>
            {isDragActive ? "파일을 놓으세요" : "파일을 끌어오거나 클릭하여 선택"}
          </span>
        )}
      </div>
      {progress === "uploading" && <p style={{ marginTop: 8, color: "#a1a1aa" }}>업로드 중…</p>}
      {progress === "done" && jobId && (
        <p style={{ marginTop: 8, color: "#22c55e" }}>완료. job_id: {jobId.slice(0, 8)}…</p>
      )}
      {progress === "error" && error && (
        <p style={{ marginTop: 8, color: "#f87171" }} role="alert">
          {error.includes("429") ? "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." : error}
        </p>
      )}
    </div>
  );
}

export function useUploadResult() {
  const [jobId, setJobId] = useState<string | null>(null);
  return { jobId, setJobId };
}
