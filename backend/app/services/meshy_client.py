"""Meshy Image-to-3D API client (async task + poll + download)."""
import base64
import time
from pathlib import Path
from typing import Any

import httpx


MESHY_BASE = "https://api.meshy.ai"
CREATE_URL = f"{MESHY_BASE}/openapi/v1/image-to-3d"
POLL_INTERVAL = 3
MAX_WAIT_SECONDS = 120


def image_to_data_uri(image_path: Path) -> str:
    data = image_path.read_bytes()
    b64 = base64.b64encode(data).decode("ascii")
    suffix = image_path.suffix.lower()
    mime = "image/png" if suffix == ".png" else "image/jpeg"
    return f"data:{mime};base64,{b64}"


def create_task(api_key: str, image_url: str, *, should_texture: bool = False) -> str:
    """Create Meshy image-to-3d task. Returns task id."""
    with httpx.Client(timeout=30) as client:
        r = client.post(
            CREATE_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"image_url": image_url, "should_texture": should_texture},
        )
        r.raise_for_status()
        data = r.json()
        return data["result"]


def get_task(api_key: str, task_id: str) -> dict[str, Any]:
    """Retrieve task status and result."""
    url = f"{MESHY_BASE}/openapi/v1/image-to-3d/{task_id}"
    with httpx.Client(timeout=30) as client:
        r = client.get(url, headers={"Authorization": f"Bearer {api_key}"})
        r.raise_for_status()
        return r.json()


def wait_for_task(api_key: str, task_id: str) -> dict[str, Any] | None:
    """Poll until SUCCEEDED or FAILED or timeout. Returns task object or None on timeout/failure."""
    start = time.monotonic()
    while (time.monotonic() - start) < MAX_WAIT_SECONDS:
        task = get_task(api_key, task_id)
        status = task.get("status")
        if status == "SUCCEEDED":
            return task
        if status in ("FAILED", "CANCELED"):
            return None
        time.sleep(POLL_INTERVAL)
    return None


def download_model(task: dict[str, Any], export_dir: Path, fmt: str = "glb") -> Path:
    """Download model_urls[fmt] to export_dir/model.{fmt}."""
    urls = task.get("model_urls") or {}
    url = urls.get(fmt) or urls.get("glb")
    if not url:
        raise ValueError(f"No {fmt} or glb URL in task")
    export_dir.mkdir(parents=True, exist_ok=True)
    out_path = export_dir / f"model.{fmt}"
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        r = client.get(url)
        r.raise_for_status()
        out_path.write_bytes(r.content)
    return out_path


def run_image_to_3d(api_key: str, image_path: Path, export_dir: Path) -> tuple[bool, str | None]:
    """
    Create task, wait, download GLB/OBJ. Returns (success, error_message).
    On success, writes model.glb and model.obj to export_dir if available.
    """
    data_uri = image_to_data_uri(image_path)
    try:
        task_id = create_task(api_key, data_uri)
    except httpx.HTTPStatusError as e:
        return False, f"Meshy API error: {e.response.status_code}"
    except Exception as e:
        return False, str(e)

    task = wait_for_task(api_key, task_id)
    if not task:
        return False, "Meshy task timed out or failed"

    try:
        urls = task.get("model_urls") or {}
        if urls.get("glb"):
            download_model(task, export_dir, "glb")
        if urls.get("obj"):
            download_model(task, export_dir, "obj")
        if not (export_dir / "model.glb").exists() and not (export_dir / "model.obj").exists():
            return False, "No model URL in response"
    except Exception as e:
        return False, f"Download failed: {e}"
    return True, None
