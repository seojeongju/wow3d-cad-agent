"""Supabase Storage helper: upload, download, signed URL. Uses buckets 'uploads' and 'exports'."""
from __future__ import annotations

from typing import Optional

from app.core.config import settings

_BUCKET_UPLOADS = "uploads"
_BUCKET_EXPORTS = "exports"

_client: Optional[object] = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return None
    from supabase import create_client
    _client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _client


def is_configured() -> bool:
    return bool(settings.supabase_url and settings.supabase_service_role_key)


def upload(bucket: str, path: str, data: bytes, content_type: str = "application/octet-stream") -> None:
    """Upload bytes to Storage. path e.g. 'cad/job_id/filename.dxf'."""
    client = _get_client()
    if not client:
        raise RuntimeError("Supabase not configured")
    opts = {"content-type": content_type}
    client.storage.from_(bucket).upload(path, data, opts)


def download(bucket: str, path: str) -> bytes:
    """Download file from Storage."""
    client = _get_client()
    if not client:
        raise RuntimeError("Supabase not configured")
    return client.storage.from_(bucket).download(path)


def get_signed_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    """Return a signed download URL (valid for expires_in seconds)."""
    client = _get_client()
    if not client:
        raise RuntimeError("Supabase not configured")
    resp = client.storage.from_(bucket).create_signed_url(path, expires_in)
    # API returns {"path": "...", "signedURL": "...", "error": null} or similar
    url = resp.get("signedURL") or resp.get("signedUrl")
    if not url:
        raise RuntimeError(f"No signed URL in response: {resp}")
    return url


def file_exists(bucket: str, path: str) -> bool:
    """Check if a file exists in Storage (list and check)."""
    client = _get_client()
    if not client:
        return False
    try:
        parts = path.replace("\\", "/").split("/")
        if len(parts) <= 1:
            folder, name = "", path
        else:
            folder = "/".join(parts[:-1])
            name = parts[-1]
        items = client.storage.from_(bucket).list(folder)
        for item in items:
            # Support both dict (item.get("name")) and object (e.g. FileObject.name)
            item_name = item.get("name") if isinstance(item, dict) else getattr(item, "name", None)
            if item_name == name:
                return True
        return False
    except Exception:
        return False


# Path helpers for CAD/Image
def uploads_path_cad(job_id: str, filename: str) -> str:
    return f"cad/{job_id}/{filename}"


def uploads_path_image(job_id: str, filename: str) -> str:
    return f"image/{job_id}/{filename}"


def exports_path_cad(job_id: str, filename: str) -> str:
    return f"cad/{job_id}/{filename}"


def exports_path_image(job_id: str, filename: str) -> str:
    return f"image/{job_id}/{filename}"
