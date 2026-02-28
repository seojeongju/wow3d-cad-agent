# DWG 직접 변환 설정

DWG 파일을 서버에서 DXF로 변환해 3D(STL/OBJ)까지 처리하는 방법은 두 가지입니다.

---

## 방법 A: API 사용 (권장 – 로컬 설치 없음)

**[API2Convert](https://www.api2convert.com)** 같은 변환 API를 쓰면, 서버에 ODA를 설치하지 않아도 됩니다.

1. [api2convert.com](https://www.api2convert.com) 가입 후 API 키 발급
2. `backend/.env` 또는 배포 환경 변수에 추가:
   ```env
   API2CONVERT_API_KEY=발급받은_API_키
   ```
3. 서버 재시작 후 DWG 업로드 → 자동으로 API로 DWG→DXF 변환 후 3D 변환

자세한 환경 변수 설명은 `ENV_SETUP.md`의 **API2CONVERT_API_KEY** 항목을 참고하세요.

---

## 방법 B: ODA File Converter (로컬 설치)

서버에 **ODA File Converter**를 설치해 두고, 환경 변수로 실행 파일 경로만 지정하는 방식입니다.

---

### 1. ODA File Converter 받기

1. [ODA File Converter 다운로드](https://www.opendesign.com/guestfiles/oda_file_converter) 페이지 접속
2. **Linux x64**용 중 하나 선택:
   - **DEB** (Ubuntu/Debian): `.deb` 패키지
   - **AppImage**: 설치 없이 실행 가능한 단일 파일 (Docker/Render에서 사용하기 좋음)

---

### 2. Docker 이미지에서 사용 (Render 등)

Render는 Dockerfile을 쓰면 커스텀 이미지로 배포할 수 있습니다.  
Linux에서 ODA가 GUI를 띄우려다 실패하면 이미지에 `xvfb`를 넣거나 `xvfb-run`으로 실행하는 것을 고려하세요.

### AppImage로 설치

```dockerfile
# backend/Dockerfile 예시
FROM python:3.11-slim

WORKDIR /app

# ODA File Converter (AppImage) - Linux x64
RUN apt-get update && apt-get install -y --no-install-recommends \
    fuse libfuse2 ca-certificates wget \
    && wget -q "https://download.opendesign.com/guestfiles/ODAFileConverter/ODAFileConverter_QT6_lnxX64_8.3dll_27.1.AppImage" -O /app/ODAFileConverter.AppImage \
    && chmod +x /app/ODAFileConverter.AppImage \
    && apt-get purge -y wget && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# Python 앱
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV ODA_FILE_CONVERTER_PATH=/app/ODAFileConverter.AppImage
# 또는 실행 시 자동으로 찾게 하려면 PATH에 넣고 ODA_FILE_CONVERTER_PATH는 비워 둘 수 있음 (기본명 ODAFileConverter 사용)
```

- 위 `wget` URL은 ODA 사이트의 **최신 Linux AppImage** 링크로 바꿔야 할 수 있습니다. (버전이 올라가면 경로가 바뀝니다.)
- Render에서 Dockerfile 사용 시, 해당 서비스의 **Environment**에 `ODA_FILE_CONVERTER_PATH=/app/ODAFileConverter.AppImage` 를 설정합니다.

### DEB 패키지로 설치 (Ubuntu 계열)

```dockerfile
# DEB 예시 (다운로드 링크는 ODA 사이트에서 확인)
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget gdebi-core \
    && wget -q "https://download.opendesign.com/.../ODAFileConverter_QT6_lnxX64_8.3dll_27.1.deb" -O /tmp/oda.deb \
    && gdebi -n /tmp/oda.deb \
    && rm /tmp/oda.deb \
    && apt-get purge -y wget gdebi-core && apt-get autoremove -y
```

설치 후 실행 파일 경로는 보통 `/usr/bin/ODAFileConverter` 이거나 패키지 설명을 확인해 넣습니다.  
그 경로를 `ODA_FILE_CONVERTER_PATH` 에 넣으면 됩니다.

---

### 3. 로컬 개발 (Windows)

1. ODA File Converter를 [공식 사이트](https://www.opendesign.com/guestfiles/oda_file_converter)에서 Windows용으로 설치
2. 기본 경로: `C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe`
3. `backend/.env` 에 추가:
   ```env
   ODA_FILE_CONVERTER_PATH=C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe
   ```
4. 백엔드 재시작 후 DWG 업로드로 변환 테스트

---

### 4. 확인

- **방법 A (API)**: `API2CONVERT_API_KEY`만 설정하면 DWG 업로드 시 API로 변환 후 3D까지 진행됩니다.
- **방법 B (ODA)**: `ODA_FILE_CONVERTER_PATH`가 설정되면 DWG 업로드 시 로컬 ODA로 변환됩니다.
- 둘 다 없으면 DWG 업로드 시 **503** 과 "ODA 또는 API2CONVERT를 설정하거나 DXF를 업로드하세요" 메시지가 나옵니다.

환경 변수 상세는 `ENV_SETUP.md`를 참고하세요.
