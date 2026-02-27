# Wow3D CAD Agent

2D 도면(DXF/DWG) 및 2D 이미지(손글씨·스케치)를 3D 모델로 변환하는 웹 애플리케이션입니다.

## 구조

- **backend**: FastAPI (Python) — CAD 파싱(ezdxf), 이미지 처리(OpenCV), extrusion(Trimesh), AI API 연동
- **frontend**: React + TypeScript + Three.js — 업로드 UI, 3D 뷰어, 다운로드

## 로컬 실행

### Docker Compose (권장)

```bash
docker-compose up --build
```

- API: http://localhost:8000  
- API 문서: http://localhost:8000/docs  
- 프론트: http://localhost:5173  

### 수동 실행

**Backend**

```bash
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

## API 요약

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/health | 서비스 상태 |
| POST | /api/cad/parse | DXF/DWG 업로드 → job_id |
| GET | /api/cad/export?job_id=&format=stl\|obj | 3D 파일 다운로드 |
| POST | /api/image/extrude | 이미지 + 높이 → 3D (돌출) |
| POST | /api/image/to3d | 이미지 → AI 3D (Phase 4) |
| GET | /api/image/export?job_id=&format=stl\|obj\|glb | 이미지 3D 다운로드 |

## 환경 변수 (선택)

- `MESHY_API_KEY`: Meshy Image-to-3D API 키 (Phase 4)
- `MAX_UPLOAD_MB`: 업로드 최대 크기(MB), 기본 50
