# .env 설정 가이드

백엔드에서 사용하는 환경 변수는 **`backend` 폴더 안의 `.env` 파일**에 넣습니다.  
이 파일은 Git에 올라가지 않으며(`.gitignore`에 포함), 로컬·배포 서버마다 따로 설정합니다.

---

## 1. .env 파일 만들기

1. 프로젝트 루트가 아니라 **`backend` 폴더**로 이동합니다.
   ```
   wow3d-cad agent/
   └── backend/
       ├── .env          ← 여기에 만듦
       ├── .env.example  ← 참고용 예시
       ├── app/
       └── requirements.txt
   ```

2. **`backend/.env`** 파일을 새로 만듭니다.  
   (이미 있다면 그대로 두고 내용만 수정합니다.)

3. 참고용 예시를 쓰려면 `backend/.env.example` 내용을 복사한 뒤, 값 부분만 본인 값으로 바꿉니다.

---

## 2. 변수별 설정 방법

### SUPABASE_URL (Supabase 사용 시 필수)

**의미**  
Supabase 프로젝트의 API 주소입니다. 이게 있어야 Storage(업로드·export)를 사용합니다.

**값 얻는 방법**

1. [Supabase](https://supabase.com) 로그인 후 프로젝트 선택
2. 왼쪽 아래 **Project Settings**(톱니바퀴) 클릭
3. **API** 메뉴 선택
4. **Project URL** 항목의 값을 **전체** 복사  
   - 예: `https://htkzgwfngbunksvrfqra.supabase.co`

** .env 에 넣는 예시**

```env
SUPABASE_URL=https://htkzgwfngbunksvrfqra.supabase.co
```

- `https://` 부터 끝까지 그대로 붙여넣기
- 앞뒤 공백 없이, 따옴표 없이 한 줄로

---

### SUPABASE_SERVICE_ROLE_KEY (Supabase 사용 시 필수)

**의미**  
Supabase API에 **서버 전용**으로 접근할 때 쓰는 비밀 키입니다.  
Storage에 파일을 넣고, signed URL을 만들 때 사용합니다.

**값 얻는 방법**

1. Supabase **Project Settings** → **API**
2. **Project API keys** 섹션으로 내려가기
3. **`service_role`** 옆 **Reveal** 또는 **복사** 버튼으로 키 확인 후 복사  
   - `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` 처럼 긴 문자열

**주의**

- 이 키는 **절대** 프론트엔드나 공개 저장소에 넣지 마세요.
- 백엔드 서버(로컬 `.env` 또는 Render 환경 변수)에서만 사용합니다.

** .env 에 넣는 예시**

```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0a3pn...
```

- 복사한 키를 `=` 뒤에 **한 줄 전체** 붙여넣기
- 따옴표 없이, 줄 바꿈 없이

---

### MESHY_API_KEY (선택)

**의미**  
이미지 → AI 3D 변환(Meshy API)을 쓸 때 필요한 API 키입니다.  
비워 두면 이미지 업로드는 “간단 돌출”만 동작합니다.

**값 얻는 방법**

- [Meshy](https://www.meshy.ai/) 가입 후 대시보드에서 API 키 발급

** .env 예시**

```env
MESHY_API_KEY=your-meshy-api-key
```

---

### MAX_UPLOAD_MB (선택)

**의미**  
업로드 허용 최대 파일 크기(MB)입니다.  
기본값은 `50`이라, 안 넣으면 50MB까지 허용됩니다.

** .env 예시**

```env
MAX_UPLOAD_MB=50
```

---

### ODA_FILE_CONVERTER_PATH (DWG 변환 시 선택)

**의미**  
서버에서 **DWG 파일을 직접 변환**하려면 [ODA File Converter](https://www.opendesign.com/guestfiles/oda_file_converter) 실행 파일 경로를 넣습니다.  
비워 두면 DWG 업로드 시 "ODA File Converter를 설치하거나 DXF를 업로드하세요" 안내가 나옵니다.

**설정 방법**

- **Windows**: ODA 설치 후 예: `C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe`
- **Linux (Render/Docker)**: 설치 스크립트에서 다운로드한 실행 파일 또는 AppImage의 **절대 경로** (자세한 절차는 `backend/DWG_SETUP.md` 참고)

** .env 예시**

```env
ODA_FILE_CONVERTER_PATH=/app/ODAFileConverter
```

---

### API2CONVERT_API_KEY (DWG 변환 시 선택, 로컬 설치 불필요)

**의미**  
[DWG→DXF 변환](https://www.api2convert.com/documentation)을 **클라우드 API**로 할 때 쓰는 API 키입니다.  
ODA File Converter를 서버에 설치하지 않아도 되며, **API 키만 설정**하면 DWG 업로드 시 자동으로 API2Convert로 변환 후 3D 처리합니다.

**값 얻는 방법**

1. [api2convert.com](https://www.api2convert.com) 가입
2. 대시보드에서 **API key** 발급 (무료/유료 플랜 있음)
3. `backend/.env` 또는 Render **Environment**에 `API2CONVERT_API_KEY=발급받은키` 추가

** .env 예시**

```env
API2CONVERT_API_KEY=your-api2convert-api-key
```

- DWG 변환은 **ODA(로컬)** 또는 **API2Convert(API)** 중 하나만 있어도 됩니다. 둘 다 있으면 API 키가 설정된 경우 API 방식을 우선 사용합니다.

---

## 3. .env 파일 작성 규칙

- **위치**: 반드시 **`backend/.env`** (backend 폴더 안)
- **형식**: 한 줄에 `변수이름=값`  
  - 공백 없이: `SUPABASE_URL=https://...`
  - 값에 공백이 있으면 따옴표: `SOME_VAR="값 공백 있음"`
- **주석**: `#` 부터 줄 끝까지 무시됨
- **인코딩**: UTF-8 권장

**전체 예시 (Supabase만 쓸 때)**

```env
# Supabase (Storage 사용)
SUPABASE_URL=https://htkzgwfngbunksvrfqra.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...

# 선택
# MESHY_API_KEY=
# MAX_UPLOAD_MB=50
```

**Supabase 없이 로컬만 쓸 때**

- `.env`를 비워 두거나, 위 두 줄을 넣지 않으면 됩니다.  
- 그러면 기존처럼 로컬 `uploads` / `exports` 폴더만 사용합니다.

---

## 4. 적용·확인

- **로컬**: `backend`에서 `uvicorn app.main:app --reload` 실행 시, 같은 폴더의 `.env`를 자동으로 읽습니다.
- **Render 등 배포**: 서비스의 **Environment** 화면에 위 변수들을 **키–값**으로 하나씩 추가합니다. (파일이 아니라 환경 변수로 넣는 방식입니다.)

`.env`를 수정한 뒤에는 서버를 한 번 재시작해야 반영됩니다.
