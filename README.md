# Wow3D CAD Agent

2D 도면(DXF/DWG) 및 2D 이미지(손글씨·스케치)를 3D 모델로 변환하는 웹 애플리케이션입니다.

## 배포 URL

| 구분 | URL |
|------|-----|
| **웹 사이트 (프론트)** | https://wow3d-cad-agent-frontend.onrender.com |
| **API (백엔드)** | https://wow3d-cad-agent.onrender.com |
| **API 문서** | https://wow3d-cad-agent.onrender.com/docs |

- 무료 플랜 사용 시 백엔드는 15분 미사용 후 슬립되며, 첫 요청 시 약 50초 정도 지연될 수 있습니다.

---

## 구조

- **backend**: FastAPI (Python) — CAD 파싱(ezdxf), 이미지 처리(OpenCV), extrusion(Trimesh), AI API 연동
- **frontend**: React + TypeScript + Three.js — 업로드 UI, 3D 뷰어, 다운로드

---

## 로컬 실행

### 1. Docker Compose (권장)

```bash
docker-compose up --build
```

- API: http://localhost:8000  
- API 문서: http://localhost:8000/docs  
- 프론트: http://localhost:5173  

### 2. 수동 실행

**Backend**

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend** (별도 터미널)

```bash
cd frontend
npm install
npm run dev
```

- 브라우저: http://localhost:5173  
- 프론트는 `vite.config.ts`에서 `/api`를 `http://localhost:8000`으로 프록시하므로, 별도 설정 없이 API 호출이 됩니다.

---

## 환경 변수

### Backend (`backend` 또는 Render Web Service)

| 변수 | 필수 | 설명 |
|------|------|------|
| `MESHY_API_KEY` | 선택 | Meshy Image-to-3D API 키. 없으면 이미지→3D는 단순 돌출만 동작 |
| `MAX_UPLOAD_MB` | 선택 | 업로드 최대 크기(MB). 기본값 `50` |
| `UPLOAD_DIR` | 선택 | 업로드 파일 저장 경로. 기본값 `uploads` |
| `EXPORT_DIR` | 선택 | 변환 결과 저장 경로. 기본값 `exports` |

### Frontend (로컬 개발 / Render Static Site)

| 변수 | 필수 | 설명 |
|------|------|------|
| `VITE_API_BASE` | 선택 | API 서버 URL. 로컬에서는 비워두면 `/api`(프록시) 사용. 배포 시 백엔드 URL 예: `https://wow3d-cad-agent.onrender.com` |

- Render 배포 시 프론트 빌드 단계에서 `VITE_API_BASE`를 설정하면 해당 URL로 API 요청이 갑니다.

---

## API 요약

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/health | 서비스 상태 |
| POST | /api/cad/parse | DXF/DWG 업로드 → job_id |
| GET | /api/cad/export?job_id=&format=stl\|obj | 3D 파일 다운로드 |
| POST | /api/image/extrude | 이미지 + 높이 → 3D (돌출) |
| POST | /api/image/to3d | 이미지 → AI 3D |
| GET | /api/image/export?job_id=&format=stl\|obj\|glb | 이미지 3D 다운로드 |

---

## 제한 사항

- **DWG**: 직접 변환 미지원. 오토캐드에서 DXF로 저장 후 업로드해야 합니다.
- **파일 크기**: 기본 최대 50MB (환경 변수로 변경 가능).
