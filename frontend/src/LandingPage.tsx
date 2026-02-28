import { useState, useCallback, lazy, Suspense } from "react";
import { useDropzone } from "react-dropzone";
import { cadParse, cadExportUrl, imageExtrude, imageExportUrl, imageTo3d } from "./api/client";
import "./LandingPage.css";

const Viewer3D = lazy(() => import("./components/Viewer3D").then((m) => ({ default: m.Viewer3D })));
const Hero3DViewer = lazy(() => import("./components/Hero3DViewer").then((m) => ({ default: m.Hero3DViewer })));

type Tab = "cad" | "image";

export default function LandingPage() {
  const [tab, setTab] = useState<Tab>("cad");
  const [cadJobId, setCadJobId] = useState<string | null>(null);
  const [imageJobId, setImageJobId] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerFormat, setViewerFormat] = useState<"stl" | "obj" | "glb">("stl");
  const [extrudeHeight, setExtrudeHeight] = useState(5);
  const [cadHeight, setCadHeight] = useState(1);
  const [imageMode, setImageMode] = useState<"extrude" | "ai">("extrude");
  const [imageInvert, setImageInvert] = useState(true);
  const [imageSensitivity, setImageSensitivity] = useState<"low" | "medium" | "high">("medium");
  const [progress, setProgress] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleRetry = useCallback(() => {
    setProgress("idle");
    setError(null);
  }, []);

  const handleCadUpload = useCallback(async (file: File) => {
    setProgress("uploading");
    setError(null);
    try {
      const r = await cadParse(file, cadHeight);
      setCadJobId(r.job_id);
      if (r.contour_count !== undefined && r.contour_count > 0) {
        setViewerUrl(cadExportUrl(r.job_id, "stl"));
        setViewerFormat("stl");
      } else setViewerUrl(null);
      setProgress("done");
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드 실패");
      setProgress("error");
      throw e;
    }
  }, [cadHeight]);

  const handleImageUpload = useCallback(async (file: File) => {
    setProgress("uploading");
    setError(null);
    try {
      if (imageMode === "ai") {
        const r = await imageTo3d(file, { invert: imageInvert, sensitivity: imageSensitivity });
        setImageJobId(r.job_id);
        if (r.mode === "ai") {
          setViewerUrl(imageExportUrl(r.job_id, "glb"));
          setViewerFormat("glb");
        } else {
          setViewerUrl((r.contour_count ?? 0) > 0 ? imageExportUrl(r.job_id, "stl") : null);
          setViewerFormat("stl");
        }
        setProgress("done");
        return r;
      }
      const r = await imageExtrude(file, extrudeHeight, { invert: imageInvert, sensitivity: imageSensitivity });
      setImageJobId(r.job_id);
      if (r.contour_count !== undefined && r.contour_count > 0) {
        setViewerUrl(imageExportUrl(r.job_id, "stl"));
        setViewerFormat("stl");
      } else setViewerUrl(null);
      setProgress("done");
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드 실패");
      setProgress("error");
      throw e;
    }
  }, [imageMode, extrudeHeight, imageInvert, imageSensitivity]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      if (tab === "cad") handleCadUpload(file);
      else handleImageUpload(file);
    },
    [tab, handleCadUpload, handleImageUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: tab === "cad"
      ? { "application/dxf": [".dxf"], "application/acad": [".dwg"] }
      : { "image/*": [".png", ".jpg", ".jpeg", ".bmp"] },
    maxFiles: 1,
    disabled: progress === "uploading",
  });

  const currentJobId = tab === "cad" ? cadJobId : imageJobId;
  const getExportUrl = tab === "cad" ? cadExportUrl : (id: string, fmt: "stl" | "obj" | "glb") => imageExportUrl(id, fmt);
  const exportFormats: ("stl" | "obj" | "glb")[] = tab === "image" && imageMode === "ai" ? ["glb", "obj", "stl"] : ["stl", "obj"];

  return (
    <div className="landing">
      <nav className="landing-nav">
        <span className="landing-logo">Wow3D CAD Agent</span>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-grid">
          <div className="landing-hero-content">
            <div className="landing-hero-badge">2D → 3D AI 변환</div>
            <h1 className="landing-hero-title">
              <span className="landing-hero-title-line">2D에서 3D로의</span>
              <span className="landing-hero-title-line landing-hero-title-accent">재구성</span>
            </h1>
            <p className="landing-hero-subhead">도면·이미지로 제조 가능한 3D 모델 생성</p>
            <p className="landing-hero-sub">
              <strong>AI 기술</strong>과 도면 파싱을 결합해 2D 도면(DXF)과 이미지(손글씨·스케치)를
              업로드하면 즉시 품질 높은 3D 모델로 변환됩니다. <strong>한 곳에서</strong> 속도와 정확도를 경험하세요.
            </p>
            <div className="landing-hero-cta">
              <a href="#converter" className="landing-hero-cta-btn">무료 체험 시작</a>
              <span className="landing-hero-cta-hint">신용 카드 필요 없음</span>
              <a href="#why" className="landing-hero-cta-link">원리 보기</a>
            </div>
          </div>
          <div className="landing-hero-viewer">
            <div className="landing-hero-viewer-frame">
              <Suspense fallback={<div style={{ aspectRatio: "4/3", minHeight: 280, background: "#111113", borderRadius: "1rem", display: "flex", alignItems: "center", justifyContent: "center", color: "#71717a" }}>로딩 중…</div>}>
                <Hero3DViewer />
              </Suspense>
            </div>
          </div>
        </div>

        <div id="converter" className="landing-hero-converter">
        <div className="landing-tabs">
          <button
            type="button"
            className={`landing-tab ${tab === "cad" ? "active" : ""}`}
            onClick={() => setTab("cad")}
          >
            CAD 도면 → 3D
          </button>
          <button
            type="button"
            className={`landing-tab ${tab === "image" ? "active" : ""}`}
            onClick={() => setTab("image")}
          >
            이미지 → 3D
          </button>
        </div>

        {tab === "cad" && (
          <div className="landing-options">
            <label>
              <span>돌출 높이</span>
              <input
                type="number"
                min={0.1}
                max={100}
                step={0.1}
                value={cadHeight}
                onChange={(e) => setCadHeight(Number(e.target.value))}
              />
            </label>
          </div>
        )}

        {tab === "image" && (
          <div className="landing-options">
            <label>
              <input
                type="radio"
                checked={imageMode === "extrude"}
                onChange={() => setImageMode("extrude")}
              />
              간단 돌출
            </label>
            <label>
              <input
                type="radio"
                checked={imageMode === "ai"}
                onChange={() => setImageMode("ai")}
              />
              AI 3D 생성
            </label>
            {imageMode === "extrude" && (
              <>
                <span>돌출 높이</span>
                <input
                  type="number"
                  min={0.5}
                  max={100}
                  step={0.5}
                  value={extrudeHeight}
                  onChange={(e) => setExtrudeHeight(Number(e.target.value))}
                />
              </>
            )}
            <label className="landing-option-check">
              <input type="checkbox" checked={imageInvert} onChange={(e) => setImageInvert(e.target.checked)} />
              색 반전
            </label>
            <label>
              <span>윤곽 감도</span>
              <select value={imageSensitivity} onChange={(e) => setImageSensitivity(e.target.value as "low" | "medium" | "high")}>
                <option value="low">낮음</option>
                <option value="medium">보통</option>
                <option value="high">높음</option>
              </select>
            </label>
          </div>
        )}

        <div
          {...getRootProps()}
          className={`landing-upload-zone ${isDragActive ? "drag-active" : ""}`}
        >
          <input {...getInputProps()} />
          <p>클릭하거나 파일을 끌어다 놓으세요</p>
          <span>
            {tab === "cad"
              ? "지원 형식: DXF / DWG (DXF 권장) · 최대 50MB"
              : "지원 형식: JPG / JPEG / PNG / BMP · 최대 50MB"}
          </span>
        </div>

        {progress === "uploading" && (
          <div className="landing-status loading">
            <span className="landing-spinner" aria-hidden />
            <span>{tab === "cad" ? "도면 분석 및 3D 변환 중…" : "이미지 분석 및 3D 변환 중…"}</span>
          </div>
        )}
        {progress === "done" && currentJobId && (
          <p className="landing-status success">완료. 미리보기 아래에서 다운로드할 수 있습니다.</p>
        )}
        {progress === "error" && error && (
          <div className="landing-status error-wrap" role="alert">
            <p className="landing-status error">
              {error.includes("429") ? "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." : error}
            </p>
            <button type="button" className="landing-retry-btn" onClick={handleRetry}>다시 시도</button>
          </div>
        )}

        {tab === "cad" && (
          <div className="landing-dwg-hint">
            <p className="landing-note">
              <strong>DWG 파일을 사용하려면</strong> 오토캐드에서 [다른 이름으로 저장] → 형식을 <strong>DXF</strong>로 선택한 뒤 저장하고, 저장된 DXF 파일을 업로드하세요.
            </p>
          </div>
        )}

        {currentJobId && (
          <div className="landing-export">
            {exportFormats.map((fmt) => (
              <a
                key={fmt}
                href={getExportUrl(currentJobId, fmt)}
                download={`model.${fmt}`}
              >
                {fmt.toUpperCase()} 다운로드
              </a>
            ))}
          </div>
        )}
        </div>
      </section>

      <section className="landing-viewer-wrap">
        <h3>3D 미리보기</h3>
        <Suspense fallback={<div style={{ background: "#18181b", borderRadius: 8, minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "#71717a" }}>로딩 중…</div>}>
          <Viewer3D modelUrl={viewerUrl} format={viewerFormat} />
        </Suspense>
      </section>

      <section className="landing-showcase">
        <h2>3D 모델 쇼케이스</h2>
        <div className="landing-showcase-grid">
          <div className="landing-showcase-item">STL</div>
          <div className="landing-showcase-item">OBJ</div>
          <div className="landing-showcase-item">GLB</div>
        </div>
      </section>

      <section id="why" className="landing-why">
        <h2>Wow3D를 선택해야 하는 이유</h2>
        <p className="landing-why-sub">
          정확하고 강력한 2D→3D 변환을 한 곳에서 경험하세요.
        </p>
        <div className="landing-cards">
          <div className="landing-card">
            <h3>고해상도 파이프라인</h3>
            <p>
              디테일이 중요합니다. 2D 도면과 이미지의 선, 윤곽, 가장자리를 선명하게 유지한 채
              품질 높은 3D 메쉬로 변환합니다.
            </p>
          </div>
          <div className="landing-card">
            <h3>완전한 형상 재구성</h3>
            <p>
              DXF 폐곡선과 이미지 윤곽을 정확히 추출해 앞·뒤·측면이 갖춰진 360° 3D 모델을 생성하며,
              어떤 각도에서도 활용 가능합니다.
            </p>
          </div>
          <div className="landing-card">
            <h3>표면 정확도</h3>
            <p>
              거친 노이즈 없이 부드러운 표면과 정확한 단면 돌출을 제공하며,
              제조·프린팅·시각화에 바로 사용할 수 있는 품질을 목표로 합니다.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-community">
        <h2>크리에이티브 커뮤니티에 참여하세요!</h2>
        <a href="https://discord.gg" target="_blank" rel="noopener noreferrer">
          Discord 서버 참여
        </a>
      </section>

      <section className="landing-faq">
        <h2>자주 묻는 질문</h2>
        <p className="landing-faq-sub">
          Wow3D CAD Agent의 기능, 사용 방법, 지원 형식에 대한 답변을 확인하세요.
        </p>
        <div className="landing-faq-list">
          <div className="landing-faq-item">
            <h4>Wow3D CAD Agent란?</h4>
            <p>
              2D 도면(DXF)과 2D 이미지(손글씨, 스케치 등)를 3D 모델로 변환하는 웹 도구입니다.
              CAD 파싱(ezdxf)과 이미지 윤곽 추출(OpenCV)을 결합하고, 필요 시 AI API(Meshy 등)를
              활용해 고품질 3D 에셋을 생성합니다.
            </p>
          </div>
          <div className="landing-faq-item">
            <h4>어디에 활용할 수 있나요?</h4>
            <p>
              게임 개발, 시각 효과, 제품 모델링, 3D 프린팅, 설계 시각화 등 다양한 분야에서
              생성된 3D 모델을 사용할 수 있습니다.
            </p>
          </div>
          <div className="landing-faq-item">
            <h4>주요 장점은 무엇인가요?</h4>
            <p>
              도면 기반의 정확한 폐곡선 추출과 돌출, 이미지 기반의 간단 돌출·AI 3D 생성 옵션을
              한 곳에서 제공하며, STL·OBJ·GLB 등 표준 포맷으로 내보낼 수 있습니다.
            </p>
          </div>
          <div className="landing-faq-item">
            <h4>어떻게 사용하나요?</h4>
            <p>
              CAD 도면은 DXF 파일을, 이미지는 JPG/PNG 등을 업로드하면 됩니다. 이미지의 경우
              「간단 돌출」또는 「AI 3D 생성」을 선택할 수 있으며, 최대 50MB까지 지원합니다.
            </p>
          </div>
          <div className="landing-faq-item">
            <h4>업로드·다운로드 지원 형식은?</h4>
            <p>
              업로드: DXF, DWG(CAD) / JPG, JPEG, PNG, BMP(이미지). 다운로드: STL, OBJ, GLB(AI 3D 시) 등
              주요 3D 소프트웨어에서 바로 불러올 수 있는 형식을 지원합니다.
            </p>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-links">
          <a href="/docs/privacy">개인정보처리방침</a>
          <a href="/docs/terms">이용약관</a>
        </div>
      </footer>
    </div>
  );
}
