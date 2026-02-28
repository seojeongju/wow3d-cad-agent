# Wow3D CAD Agent — 프로젝트 상태 (세션 이어서 작업용)

**최종 업데이트**: 2026-02-28  
**브랜치**: `main` (원격과 동기화됨)

---

## 현재 상태

- **백엔드**: Render 배포 중 (`wow3d-cad-agent.onrender.com`)
- **프론트**: Render 배포 중 (`wow3d-cad-agent-frontend.onrender.com`)
- **저장소**: GitHub `seojeongju/wow3d-cad-agent`

---

## 이번 세션에서 마친 작업

1. **CAD parse 422 / 'str' object is not callable**
   - `backend/app/services/cad_parser.py`: `entity.dxf.dxftype()` → `entity.dxftype()` (ezdxf API 수정)
   - `backend/app/services/extrusion.py`: STL/OBJ 내보내기를 `trimesh.exchange.stl.export_stl`, `trimesh.exchange.obj.export_obj` 사용으로 변경
   - `backend/app/api/cad.py`: 예외 시 `logger.exception(...)` 추가 (Render 로그 traceback 확인용)

2. **3D 미리보기**
   - `frontend/src/components/Viewer3D.tsx`:
     - 로드한 모델 **중앙 정렬 + 크기 맞춤** (바운딩 박스 기준, `FIT_SIZE=2`)
     - STL `computeVertexNormals()` 호출
     - 뷰어 영역 **고정 높이(400px)** + Canvas가 영역 전체 채우도록 수정 (중간·아래까지 모델 노출)
     - `OrbitControls` `target={[0,0,0]}` 지정

3. **커밋·푸시**
   - 위 변경 사항 모두 커밋 후 `origin/main` 푸시 완료.

---

## 주요 경로

| 구분 | 경로 |
|------|------|
| CAD API | `backend/app/api/cad.py` |
| CAD 파싱 | `backend/app/services/cad_parser.py` |
| Extrusion/메시 내보내기 | `backend/app/services/extrusion.py` |
| DWG API 변환 | `backend/app/services/dwg_converter.py` |
| 3D 뷰어 | `frontend/src/components/Viewer3D.tsx` |
| 랜딩/업로드 UI | `frontend/src/LandingPage.tsx` |
| 설정 | `backend/app/core/config.py`, `backend/.env` |

---

## 로컬 실행

```bash
# 백엔드
cd backend && venv\Scripts\activate && uvicorn app.main:app --reload --port 8000

# 프론트 (별도 터미널)
cd frontend && npm run dev
```

---

## 다음 세션에서 이어서 할 수 있는 것

- CAD/이미지 변환 품질·엣지 케이스 점검
- 3D 뷰어 조명·재질·카메라 추가 개선
- 프론트/백엔드 테스트·에러 메시지 정리
- README·환경 변수 문서 보강

---

*이 파일은 세션 전환 시 컨텍스트 공유용입니다. 필요 시 수정·삭제해도 됩니다.*
