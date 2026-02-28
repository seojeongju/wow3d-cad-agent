import asyncio
from pathlib import Path
import uuid
from typing import Annotated

from fastapi import APIRouter, File, UploadFile, HTTPException, Query, Form, Request
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.rate_limit import upload_limiter
from app.services.image_contours import image_to_contours
from app.services.extrusion import contours_to_mesh, export_mesh

router = APIRouter()


def _sensitivity_to_min_area(s: str) -> float:
    return {"low": 50.0, "medium": 10.0, "high": 2.0}.get((s or "").lower(), 10.0)


def _form_bool(val: str | None) -> bool:
    return (val or "").lower() in ("true", "1", "yes")


def _extrude_image_sync(file_path: Path, export_path: Path, height: float, invert: bool = True, min_area: float = 10.0) -> int:
    """CPU-heavy image contours + mesh + export. Run in thread pool. Returns contour_count."""
    contours = image_to_contours(file_path, invert=invert, min_area=min_area)
    if not contours:
        return 0
    mesh = contours_to_mesh(contours, height=height)
    export_path.mkdir(parents=True, exist_ok=True)
    export_mesh(mesh, export_path / "model.stl", "stl")
    export_mesh(mesh, export_path / "model.obj", "obj")
    return len(contours)


def _extrude_image_fallback_sync(file_path: Path, export_path: Path, height: float = 5.0, invert: bool = True, min_area: float = 10.0) -> int:
    """Fallback extrusion for to3d (no AI or AI failed). Run in thread pool. Returns contour_count."""
    contours = image_to_contours(file_path, invert=invert, min_area=min_area)
    if not contours:
        return 0
    mesh = contours_to_mesh(contours, height=height)
    export_path.mkdir(parents=True, exist_ok=True)
    export_mesh(mesh, export_path / "model.stl", "stl")
    export_mesh(mesh, export_path / "model.obj", "obj")
    return len(contours)


def _check_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    if not upload_limiter.allow(client_ip):
        raise HTTPException(429, "Too many requests. Please try again later.")


@router.post("/extrude")
async def image_extrude(
    request: Request,
    file: UploadFile = File(...),
    height: Annotated[float, Form()] = 5.0,
    invert: Annotated[str, Form()] = "true",
    sensitivity: Annotated[str, Form()] = "medium",
):
    """Upload image and extrude to 3D with given height. Returns job_id."""
    _check_rate_limit(request)
    invert_bool = _form_bool(invert)
    if not file.filename:
        raise HTTPException(400, "No filename")
    ext = Path(file.filename).suffix.lower()
    if ext not in (".png", ".jpg", ".jpeg", ".bmp"):
        raise HTTPException(400, "Only PNG, JPG, BMP are supported")
    job_id = str(uuid.uuid4())
    upload_path = settings.upload_dir / "image" / job_id
    upload_path.mkdir(parents=True, exist_ok=True)
    file_path = upload_path / (file.filename or "image.png")
    content = await file.read()
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(400, f"File too large (max {settings.max_upload_mb}MB)")
    file_path.write_bytes(content)

    min_area = _sensitivity_to_min_area(sensitivity)
    export_path = settings.export_dir / "image" / job_id
    try:
        contour_count = await asyncio.get_event_loop().run_in_executor(
            None, _extrude_image_sync, file_path, export_path, height, invert_bool, min_area
        )
    except Exception as e:
        raise HTTPException(422, f"Image processing failed: {e!s}")

    if contour_count == 0:
        return {"job_id": job_id, "filename": file.filename, "height": height, "contour_count": 0, "message": "No contours found. Try a clearer image or invert colors."}

    return {"job_id": job_id, "filename": file.filename, "height": height, "contour_count": contour_count, "message": "Extruded to 3D."}


@router.post("/to3d")
async def image_to3d(
    request: Request,
    file: UploadFile = File(...),
    invert: Annotated[str, Form()] = "true",
    sensitivity: Annotated[str, Form()] = "medium",
):
    """Image to 3D via AI API (Meshy). On API failure, falls back to simple extrusion."""
    invert_bool = _form_bool(invert)
    _check_rate_limit(request)
    if not file.filename:
        raise HTTPException(400, "No filename")
    ext = Path(file.filename).suffix.lower()
    if ext not in (".png", ".jpg", ".jpeg"):
        raise HTTPException(400, "Only PNG, JPG are supported for AI 3D")
    job_id = str(uuid.uuid4())
    upload_path = settings.upload_dir / "image" / job_id
    upload_path.mkdir(parents=True, exist_ok=True)
    file_path = upload_path / (file.filename or "image.png")
    content = await file.read()
    file_path.write_bytes(content)
    export_path = settings.export_dir / "image" / job_id
    fallback_msg: str | None = None

    if settings.meshy_api_key:
        from app.services.meshy_client import run_image_to_3d
        ok, err = run_image_to_3d(settings.meshy_api_key, file_path, export_path)
        if ok:
            return {"job_id": job_id, "filename": file.filename, "mode": "ai", "message": "AI 3D model generated."}
        fallback_msg = f"AI failed ({err}); used simple extrusion."

    min_area = _sensitivity_to_min_area(sensitivity)
    try:
        contour_count = await asyncio.get_event_loop().run_in_executor(
            None, _extrude_image_fallback_sync, file_path, export_path, 5.0, invert_bool, min_area
        )
    except Exception as e:
        raise HTTPException(422, f"Image processing failed: {e!s}")
    if contour_count == 0:
        return {"job_id": job_id, "filename": file.filename, "mode": "extrude", "contour_count": 0, "message": "No contours found. Try a clearer image."}
    return {
        "job_id": job_id,
        "filename": file.filename,
        "mode": "extrude",
        "contour_count": contour_count,
        "message": fallback_msg or "Extruded to 3D (no AI key set).",
    }


@router.get("/export")
async def image_export(job_id: str = Query(...), format: str = Query("stl", regex="^(stl|obj|glb)$")):
    """Download extruded or AI-generated 3D file."""
    export_path = settings.export_dir / "image" / job_id
    path = export_path / f"model.{format}"
    if not path.exists():
        raise HTTPException(404, "Export not found.")
    return FileResponse(path, filename=f"model.{format}")
