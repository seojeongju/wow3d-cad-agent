import { useState, useCallback, lazy, Suspense } from "react";
import { useDropzone } from "react-dropzone";
import { cadParse, cadExportUrl, imageExtrude, imageExportUrl, imageTo3d } from "./api/client";
import "./LandingPage.css";

const Viewer3D = lazy(() => import("./components/Viewer3D").then((m) => ({ default: m.Viewer3D })));
const Hero3DViewer = lazy(() => import("./components/Hero3DViewer").then((m) => ({ default: m.Hero3DViewer })));
const Showcase3DItem = lazy(() => import("./components/Showcase3DItem").then((m) => ({ default: m.Showcase3DItem })));

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
            <div className="landing-hero-badge">2D → 3D 변환</div>
            <h1 className="landing-hero-title">
              <span className="landing-hero-title-line">2D에서 3D로의</span>
              <span className="landing-hero-title-line landing-hero-title-accent">재구성</span>
            </h1>
            <p className="landing-hero-subhead">도면·이미지 업로드 한 번에 STL·OBJ·GLB 3D 모델 생성</p>
            <p className="landing-hero-sub">
              <strong>DXF·DWG</strong> 도면은 서버에서 자동 변환 후 3D로 만들고,
              <strong>이미지</strong>는 윤곽 돌출 또는 AI 3D 생성으로 모델을 만듭니다. 결과물을 STL·OBJ·GLB로 바로 다운로드할 수 있습니다.
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
            DXF·DWG → 3D
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
              ? "지원 형식: DXF, DWG (업로드 시 자동 변환) · 최대 50MB"
              : "지원 형식: JPG, JPEG, PNG, BMP · 최대 50MB"}
          </span>
        </div>

        {progress === "uploading" && (
          <div className="landing-status loading">
            <span className="landing-spinner" aria-hidden />
            <span>{tab === "cad" ? "도면 변환 및 3D 생성 중…" : "이미지 분석 및 3D 변환 중…"}</span>
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
              <strong>DXF·DWG</strong> 모두 그대로 업로드하면 서버에서 자동으로 3D(STL·OBJ)로 변환됩니다. 별도 변환 작업 없이 사용하세요.
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
        <h2>지원 출력 포맷</h2>
        <p className="landing-showcase-sub">변환 결과를 원하는 포맷으로 내려받아 3D 프린팅, CAM, 시각화 툴에서 바로 사용하세요.</p>
        <div className="landing-showcase-grid">
          <Suspense fallback={<div className="landing-showcase-placeholder">STL 로딩 중…</div>}>
            <Showcase3DItem theme="machinery" format="STL" useCase="3D 프린팅 · CAM" description="제조·프로토타입 표준 포맷. 슬라이서·가공 소프트웨어에서 그대로 사용 가능합니다." />
          </Suspense>
          <Suspense fallback={<div className="landing-showcase-placeholder">OBJ 로딩 중…</div>}>
            <Showcase3DItem theme="architecture" format="OBJ" useCase="시각화 · 인테리어" description="메쉬·텍스처·재질 호환. 건축·인테리어·영상 툴에서 널리 지원됩니다." />
          </Suspense>
          <Suspense fallback={<div className="landing-showcase-placeholder">GLB 로딩 중…</div>}>
            <Showcase3DItem theme="engine" format="GLB" useCase="웹 · AR/VR" description="glTF 바이너리. 웹 뷰어·게임 엔진·AR/VR에서 단일 파일로 로드할 수 있습니다." />
          </Suspense>
        </div>
      </section>

      <section id="why" className="landing-why">
        <h2>Wow3D를 선택해야 하는 이유</h2>
        <p className="landing-why-sub">
          정확하고 강력한 2D→3D 변환을 한 곳에서 경험하세요.
        </p>
        <div className="landing-cards">
          <div className="landing-card">
            <h3>CAD 도면 → 3D</h3>
            <p>
              DXF·DWG 파일을 업로드하면 폐곡선을 추출해 돌출 높이만 지정해 3D로 만듭니다.
              DWG는 서버에서 자동으로 변환되므로 별도 작업 없이 사용할 수 있습니다.
            </p>
          </div>
          <div className="landing-card">
            <h3>이미지 → 3D</h3>
            <p>
              스케치·도안 이미지를 업로드해 <strong>간단 돌출</strong>(윤곽 추출 후 높이 지정) 또는
              <strong>AI 3D 생성</strong>(Meshy 연동, 실패 시 돌출로 대체)으로 3D 모델을 만듭니다.
            </p>
          </div>
          <div className="landing-card">
            <h3>표준 포맷 내보내기</h3>
            <p>
              변환 결과를 STL·OBJ·GLB 등으로 다운로드해 3D 프린팅, CAM, 게임·시각화 툴에서
              그대로 불러올 수 있습니다.
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
              CAD 도면(DXF·DWG)과 이미지(JPG, PNG 등)를 3D 모델로 변환하는 웹 도구입니다.
              도면은 폐곡선 추출 후 돌출로, 이미지는 윤곽 돌출 또는 AI(Meshy) 3D 생성으로 변환하며,
              결과를 STL·OBJ·GLB로 다운로드할 수 있습니다.
            </p>
          </div>
          <div className="landing-faq-item">
            <h4>DWG는 어떻게 되나요?</h4>
            <p>
              DWG 파일을 업로드하면 서버에서 자동으로 DXF로 변환한 뒤 3D로 처리됩니다. API2Convert API 키 또는
              ODA File Converter를 설정해 두면 별도 변환 없이 DWG를 그대로 업로드할 수 있습니다.
            </p>
          </div>
          <div className="landing-faq-item">
            <h4>어디에 활용할 수 있나요?</h4>
            <p>
              3D 프린팅, CAM, 제품·건축 시각화, 게임·AR 에셋 등 생성된 STL·OBJ·GLB를
              각종 소프트웨어에서 바로 불러와 사용할 수 있습니다.
            </p>
          </div>
          <div className="landing-faq-item">
            <h4>어떻게 사용하나요?</h4>
            <p>
              「CAD 도면 → 3D」탭에서 DXF 또는 DWG를, 「이미지 → 3D」탭에서 JPG/PNG 등을 업로드하면 됩니다.
              돌출 높이·색 반전·윤곽 감도·AI 3D 생성 여부 등을 선택할 수 있으며, 최대 50MB까지 지원합니다.
            </p>
          </div>
          <div className="landing-faq-item">
            <h4>지원 형식은?</h4>
            <p>
              업로드: DXF, DWG(CAD) / JPG, JPEG, PNG, BMP(이미지). 다운로드: STL, OBJ(CAD·이미지 공통),
              GLB(이미지 AI 3D 생성 시). 모두 일반 3D 소프트웨어에서 호환됩니다.
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
