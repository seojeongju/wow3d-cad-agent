import asyncio
import logging
import tempfile
from pathlib import Path
import uuid
from typing import Annotated

from fastapi import APIRouter, File, UploadFile, HTTPException, Query, Request, Form
from fastapi.responses import FileResponse, RedirectResponse, Response

from app.core.config import settings

logger = logging.getLogger(__name__)
from app.core.rate_limit import upload_limiter
from app.services.cad_parser import parse_dxf, ODAFCNotAvailableError
from app.services.dwg_converter import DWGConversionAPIError
from app.services.extrusion import contours_to_mesh, export_mesh
from app.services import supabase_storage

router = APIRouter()

DEFAULT_CAD_HEIGHT = 1.0


def _parse_and_export_dxf_sync(file_path: Path, export_path: Path, height: float) -> dict:
    """CPU-heavy DXF parse + mesh + export. Run in thread pool."""
    result = parse_dxf(file_path)
    contours = result["contours"]
    if not contours:
        return {"result": result, "contour_count": 0}
    mesh = contours_to_mesh(contours, height=height)
    export_path.mkdir(parents=True, exist_ok=True)
    export_mesh(mesh, export_path / "model.stl", "stl")
    export_mesh(mesh, export_path / "model.obj", "obj")
    return {"result": result, "contour_count": len(contours)}


def _parse_and_export_cad_sync(
    file_path: Path,
    export_path: Path,
    height: float,
    api_key: str | None,
) -> dict:
    """Parse DXF or DWG (DWG: ODA or API2Convert if api_key set) and export STL/OBJ."""
    if file_path.suffix.lower() == ".dwg" and api_key:
        from app.services.dwg_converter import (
            DWGConversionAPIError,
            convert_dwg_to_dxf_bytes,
        )
        try:
            dxf_bytes = convert_dwg_to_dxf_bytes(
                file_path.read_bytes(),
                file_path.name,
                api_key,
            )
            dxf_path = file_path.parent / "converted.dxf"
            dxf_path.write_bytes(dxf_bytes)
            return _parse_and_export_dxf_sync(dxf_path, export_path, height)
        except DWGConversionAPIError as e:
            raise e
    return _parse_and_export_dxf_sync(file_path, export_path, height)


_BUCKET_UPLOADS = "uploads"
_BUCKET_EXPORTS = "exports"


def _upload_export_to_storage(export_path: Path, job_id: str) -> None:
    """Upload model.stl and model.obj from export_path to Storage exports/cad/job_id/."""
    for name in ("model.stl", "model.obj"):
        p = export_path / name
        if p.exists():
            supabase_storage.upload(
                _BUCKET_EXPORTS,
                supabase_storage.exports_path_cad(job_id, name),
                p.read_bytes(),
                "application/octet-stream",
            )


@router.post("/parse")
async def cad_parse(
    request: Request,
    file: UploadFile = File(...),
    height: Annotated[float, Form()] = DEFAULT_CAD_HEIGHT,
):
    """Upload DXF or DWG for parsing and 3D conversion. DWG: use ODA File Converter (ODA_FILE_CONVERTER_PATH) or API2Convert (API2CONVERT_API_KEY)."""
    client_ip = request.client.host if request.client else "unknown"
    if not upload_limiter.allow(client_ip):
        raise HTTPException(429, "Too many requests. Please try again later.")
    if not file.filename:
        raise HTTPException(400, "No filename")
    ext = Path(file.filename).suffix.lower()
    if ext not in (".dxf", ".dwg"):
        raise HTTPException(400, "Only .dxf and .dwg are supported.")
    job_id = str(uuid.uuid4())
    content = await file.read()
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(400, f"File too large (max {settings.max_upload_mb}MB)")

    use_supabase = supabase_storage.is_configured()
    if use_supabase:
        supabase_storage.upload(
            _BUCKET_UPLOADS,
            supabase_storage.uploads_path_cad(job_id, file.filename or "drawing.dxf"),
            content,
            "application/dxf" if ext == ".dxf" else "application/octet-stream",
        )

    with tempfile.TemporaryDirectory() as tmp:
        file_path = Path(tmp) / (file.filename or ("drawing.dxf" if ext == ".dxf" else "drawing.dwg"))
        file_path.write_bytes(content)
        export_path = Path(tmp) / "export"
        export_path.mkdir()
        try:
            out = await asyncio.get_event_loop().run_in_executor(
                None,
                _parse_and_export_cad_sync,
                file_path,
                export_path,
                height,
                settings.api2convert_api_key,
            )
        except ODAFCNotAvailableError:
            raise HTTPException(
                503,
                "DWG conversion is not available. Set ODA_FILE_CONVERTER_PATH (local ODA) or API2CONVERT_API_KEY (cloud API), or upload DXF.",
            )
        except DWGConversionAPIError as e:
            raise HTTPException(502, f"DWG API conversion failed: {e!s}")
        except Exception as e:
            raise HTTPException(422, f"CAD parse failed: {e!s}")

        if use_supabase:
            _upload_export_to_storage(export_path, job_id)

        result, contour_count = out["result"], out["contour_count"]
        if contour_count == 0:
            return {"job_id": job_id, "filename": file.filename, "layers": result["layers"], "bounds": result["bounds"], "message": "No closed contours found for extrusion."}

        return {
            "job_id": job_id,
            "filename": file.filename,
            "layers": result["layers"],
            "bounds": result["bounds"],
            "contour_count": contour_count,
            "message": "Parsed and converted to 3D.",
        }


@router.get("/export")
async def cad_export(job_id: str = Query(...), format: str = Query("stl", regex="^(stl|obj)$")):
    """Download converted 3D file (STL or OBJ)."""
    filename = f"model.{format}"
    if supabase_storage.is_configured():
        storage_path = supabase_storage.exports_path_cad(job_id, filename)
        try:
            url = supabase_storage.get_signed_url(_BUCKET_EXPORTS, storage_path)
            return RedirectResponse(url=url, status_code=302)
        except Exception as e:
            logger.warning("CAD export signed URL failed job_id=%s format=%s: %s", job_id, format, e)
        try:
            data = supabase_storage.download(_BUCKET_EXPORTS, storage_path)
            return Response(
                content=data,
                media_type="application/octet-stream",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )
        except Exception as e:
            logger.warning("CAD export download from Storage failed job_id=%s format=%s: %s", job_id, format, e)
    export_path = settings.export_dir / "cad" / job_id
    path = export_path / filename
    if not path.exists():
        raise HTTPException(404, "Export not found. Run conversion first.")
    return FileResponse(path, filename=filename)


def _parse_dxf_preview_sync(dxf_path: Path) -> dict:
    """Parse DXF for preview metadata. Run in thread pool."""
    return parse_dxf(dxf_path)


@router.get("/preview")
async def cad_preview(job_id: str = Query(...)):
    """Get metadata for a CAD job (layers, bounds)."""
    dxf_path: Path | None = None
    if supabase_storage.is_configured():
        try:
            client = supabase_storage._get_client()
            items = client.storage.from_(_BUCKET_UPLOADS).list(f"cad/{job_id}")
            for item in items:
                name = (item.get("name") if isinstance(item, dict) else getattr(item, "name", None)) or ""
                if name.lower().endswith(".dxf") or name.lower().endswith(".dwg"):
                    data = supabase_storage.download(_BUCKET_UPLOADS, f"cad/{job_id}/{name}")
                    suffix = ".dxf" if name.lower().endswith(".dxf") else ".dwg"
                    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
                        f.write(data)
                        dxf_path = Path(f.name)
                    break
        except Exception:
            pass
    if dxf_path is None:
        upload_path = settings.upload_dir / "cad" / job_id
        if not upload_path.exists():
            raise HTTPException(404, "Job not found")
        cad_files = list(upload_path.glob("*.dxf")) or list(upload_path.glob("*.dwg"))
        if not cad_files:
            return {"job_id": job_id, "has_file": False, "message": "No DXF or DWG file found for this job."}
        dxf_path = cad_files[0]
    try:
        result = await asyncio.get_event_loop().run_in_executor(None, _parse_dxf_preview_sync, dxf_path)
        return {"job_id": job_id, "has_file": True, "layers": result["layers"], "bounds": result["bounds"], "line_count": result["line_count"]}
    except ODAFCNotAvailableError:
        return {"job_id": job_id, "has_file": True, "message": "DWG file present; install ODA File Converter for preview and conversion."}
    except Exception:
        return {"job_id": job_id, "has_file": True}
    finally:
        if dxf_path and str(dxf_path).startswith(tempfile.gettempdir()):
            try:
                dxf_path.unlink(missing_ok=True)
            except Exception:
                pass
