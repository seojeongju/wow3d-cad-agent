# Wow3D CAD Agent — 작업 가이드

## 현재 상태

### 배포
| 구분 | URL |
|------|-----|
| 프론트 | https://wow3d-cad-agent-frontend.onrender.com |
| 백엔드 API | https://wow3d-cad-agent.onrender.com |
| API 문서 | https://wow3d-cad-agent.onrender.com/docs |

- **저장소**: GitHub `seojeongju/wow3d-cad-agent` (main)
- **Render**: Blueprint로 프론트(Static) + 백엔드(Python) 동시 배포
- **Supabase**: 프로젝트 생성 완료, Storage 버킷 `uploads` / `exports` 생성 완료
- **백엔드 환경 변수**: Render 서비스(wow3d-cad-agent)에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 설정 완료

### 완료된 작업
- 안정화: API 에러 파싱·재시도, 로딩 스피너·안내 문구
- 기능: DWG 안내 정리, 이미지 반전/감도, CAD 돌출 높이 옵션
- 성능: 백엔드 스레드 풀, 프론트 lazy 로딩·Viewer3D dispose, Vite 청크 분리
- 인프라: Supabase 프로젝트·버킷·env 설정, Render 백엔드 서비스 추가

### 적용 완료
- **Supabase Storage 연동**: `SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY` 설정 시 업로드 → `uploads`, 변환 결과 → `exports` 버킷 사용. 다운로드는 signed URL 리다이렉트. 미설정 시 기존처럼 로컬 디스크 사용.

---

## 다음에 할 작업

1. **선택**
   - DB 테이블(`jobs`) 생성 및 job 메타 저장
   - 커스텀 도메인, README 보강

---

## 주요 경로

| 용도 | 경로 |
|------|------|
| 백엔드 진입 | `backend/app/main.py` |
| 설정 | `backend/app/core/config.py` |
| CAD API | `backend/app/api/cad.py` |
| 이미지 API | `backend/app/api/image.py` |
| 프론트 진입 | `frontend/src/LandingPage.tsx` |
| 배포 | `render.yaml` |

---

## 환경 변수

### 백엔드 (로컬 `backend/.env` 또는 Render Environment)
- `SUPABASE_URL` — Supabase Project URL
- `SUPABASE_SERVICE_ROLE_KEY` — service_role 키 (비공개)
- `MESHY_API_KEY` — (선택) 이미지 AI 3D
- `MAX_UPLOAD_MB` — (선택) 기본 50

### 프론트 (Render: wow3d-cad-agent-frontend)
- `VITE_API_BASE` — 백엔드 URL (예: https://wow3d-cad-agent.onrender.com)

---

## 로컬 실행

```bash
# 백엔드
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000

# 프론트 (별도 터미널)
cd frontend && npm install && npm run dev
```

- API: http://localhost:8000  
- 프론트: http://localhost:5173 (프록시로 /api → 8000)
