"""DWG → DXF conversion via external API (e.g. API2Convert). No local ODA installation required."""
from __future__ import annotations

import logging
import time
import uuid
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

API2CONVERT_JOBS = "https://api.api2convert.com/v2/jobs"
POLL_INTERVAL = 1.0
POLL_TIMEOUT = 120.0


class DWGConversionAPIError(Exception):
    """DWG conversion via API failed."""
    pass


def convert_dwg_to_dxf_via_api2convert(
    dwg_bytes: bytes,
    filename: str,
    api_key: str,
    *,
    timeout: float = POLL_TIMEOUT,
) -> bytes:
    """
    Convert DWG bytes to DXF using API2Convert REST API.
    Returns DXF file bytes.
    Raises DWGConversionAPIError on failure.
    """
    headers = {"X-Oc-Api-Key": api_key, "Content-Type": "application/json"}

    # 1) Create job (cad → dxf), do not process yet
    create_payload = {
        "conversion": [{"category": "cad", "target": "dxf"}],
        "input": [],
        "process": False,
    }
    with httpx.Client(timeout=30.0) as client:
        r = client.post(API2CONVERT_JOBS, json=create_payload, headers=headers)
        r.raise_for_status()
        job = r.json()
    job_id = job.get("id")
    server = (job.get("server") or "").rstrip("/")
    if not job_id or not server:
        raise DWGConversionAPIError("Invalid API2Convert response: missing id or server")

    # 2) Upload file to job
    upload_url = f"{server}/upload-file/{job_id}"
    upload_headers = {
        "X-Oc-Api-Key": api_key,
        "X-Oc-Upload-Uuid": str(uuid.uuid4()),
    }
    with httpx.Client(timeout=60.0) as client:
        files = {"file": (filename or "drawing.dwg", dwg_bytes, "application/octet-stream")}
        ru = client.post(upload_url, files=files, headers=upload_headers)
        ru.raise_for_status()

    # 3) Start processing
    with httpx.Client(timeout=30.0) as client:
        rp = client.patch(
            f"{API2CONVERT_JOBS}/{job_id}",
            json={"process": True},
            headers=headers,
        )
        rp.raise_for_status()

    # 4) Poll until completed or failed
    deadline = time.monotonic() + timeout
    with httpx.Client(timeout=15.0) as client:
        while time.monotonic() < deadline:
            r = client.get(f"{API2CONVERT_JOBS}/{job_id}", headers=headers)
            r.raise_for_status()
            data = r.json()
            code = (data.get("status") or {}).get("code") or ""
            if code == "completed":
                break
            if code == "failed":
                errors = data.get("errors") or []
                msg = "; ".join(
                    (e.get("message") or str(e)) for e in errors
                ) or "Conversion failed"
                raise DWGConversionAPIError(msg)
            time.sleep(POLL_INTERVAL)
        else:
            raise DWGConversionAPIError("Conversion timed out")

        # 5) Download result
        outputs = data.get("output") or []
        if not outputs:
            raise DWGConversionAPIError("No output file from conversion")
        uri = outputs[0].get("uri")
        if not uri:
            raise DWGConversionAPIError("No download URI in output")
        rd = client.get(uri, headers={"X-Oc-Api-Key": api_key})
        rd.raise_for_status()
        return rd.content

    raise DWGConversionAPIError("Unexpected state")


def convert_dwg_to_dxf_bytes(
    dwg_bytes: bytes,
    filename: str,
    api_key: Optional[str] = None,
) -> bytes:
    """
    Convert DWG to DXF using configured API (API2Convert).
    api_key must be set (e.g. from settings.api2convert_api_key).
    """
    if not api_key:
        raise DWGConversionAPIError("DWG API conversion requires API2CONVERT_API_KEY to be set.")
    return convert_dwg_to_dxf_via_api2convert(
        dwg_bytes,
        filename or "drawing.dwg",
        api_key,
    )
