import asyncio
import tempfile
from pathlib import Path
import uuid
from typing import Annotated

from fastapi import APIRouter, File, UploadFile, HTTPException, Query, Request, Form
from fastapi.responses import FileResponse, RedirectResponse

from app.core.config import settings
from app.core.rate_limit import upload_limiter
from app.services.cad_parser import parse_dxf
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
    """Upload DXF file for parsing and 3D conversion. Returns job_id and metadata."""
    client_ip = request.client.host if request.client else "unknown"
    if not upload_limiter.allow(client_ip):
        raise HTTPException(429, "Too many requests. Please try again later.")
    if not file.filename:
        raise HTTPException(400, "No filename")
    ext = Path(file.filename).suffix.lower()
    if ext not in (".dxf", ".dwg"):
        raise HTTPException(400, "Only .dxf and .dwg are supported. For DWG, export as DXF from AutoCAD.")
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

    if ext == ".dwg":
        return {"job_id": job_id, "filename": file.filename, "message": "DWG upload OK. Export as DXF in AutoCAD for conversion.", "converted": False}

    with tempfile.TemporaryDirectory() as tmp:
        file_path = Path(tmp) / (file.filename or "drawing.dxf")
        file_path.write_bytes(content)
        export_path = Path(tmp) / "export"
        export_path.mkdir()
        try:
            out = await asyncio.get_event_loop().run_in_executor(
                None, _parse_and_export_dxf_sync, file_path, export_path, height
            )
        except Exception as e:
            raise HTTPException(422, f"DXF parse failed: {e!s}")

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
        if supabase_storage.file_exists(_BUCKET_EXPORTS, storage_path):
            url = supabase_storage.get_signed_url(_BUCKET_EXPORTS, storage_path)
            return RedirectResponse(url=url, status_code=302)
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
                name = item.get("name") or ""
                if name.lower().endswith(".dxf"):
                    data = supabase_storage.download(_BUCKET_UPLOADS, f"cad/{job_id}/{name}")
                    with tempfile.NamedTemporaryFile(suffix=".dxf", delete=False) as f:
                        f.write(data)
                        dxf_path = Path(f.name)
                    break
        except Exception:
            pass
    if dxf_path is None:
        upload_path = settings.upload_dir / "cad" / job_id
        if not upload_path.exists():
            raise HTTPException(404, "Job not found")
        dxf_files = list(upload_path.glob("*.dxf"))
        if not dxf_files:
            return {"job_id": job_id, "has_file": False, "message": "DWG job or no DXF; use DXF for conversion."}
        dxf_path = dxf_files[0]
    try:
        result = await asyncio.get_event_loop().run_in_executor(None, _parse_dxf_preview_sync, dxf_path)
        return {"job_id": job_id, "has_file": True, "layers": result["layers"], "bounds": result["bounds"], "line_count": result["line_count"]}
    except Exception:
        return {"job_id": job_id, "has_file": True}
    finally:
        if dxf_path and str(dxf_path).startswith(tempfile.gettempdir()):
            try:
                dxf_path.unlink(missing_ok=True)
            except Exception:
                pass
