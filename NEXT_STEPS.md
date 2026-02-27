# 다음 세션 작업 가이드

## 현재 상태 (마지막 세션 기준)

- **배포**: Render 정상 동작
  - 프론트: https://wow3d-cad-agent-frontend.onrender.com
  - 백엔드: https://wow3d-cad-agent.onrender.com
- **저장소**: GitHub `seojeongju/wow3d-cad-agent` (main)
- **기능**: DXF→3D, 이미지 돌출, 이미지 AI 3D(Meshy), 랜딩 페이지(한국어, Hitem3D 스타일)

## 다음에 이어서 할 수 있는 작업

1. **안정화**: API 에러 시 프론트 메시지/재시도, 로딩 스피너·안내 문구
2. **기능**: DWG 안내 정리 또는 Model Derivative API, 이미지 반전/감도 옵션, CAD 돌출 높이 옵션
3. **인프라**: 커스텀 도메인, 환경 변수·비밀 관리 확인
4. **선택**: Supabase Auth/Storage, 사용량 제한, README 추가 보강

## 주요 경로

- 백엔드 진입: `backend/app/main.py`
- 프론트 진입: `frontend/src/App.tsx`, `LandingPage.tsx`
- 배포 설정: `render.yaml`, `backend/Dockerfile`

## 로컬 실행

```bash
# 백엔드
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000

# 프론트 (별도 터미널)
cd frontend && npm install && npm run dev
```
