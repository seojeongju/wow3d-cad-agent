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


def _check_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    if not upload_limiter.allow(client_ip):
        raise HTTPException(429, "Too many requests. Please try again later.")


@router.post("/extrude")
async def image_extrude(
    request: Request,
    file: UploadFile = File(...),
    height: Annotated[float, Form()] = 5.0,
):
    """Upload image and extrude to 3D with given height. Returns job_id."""
    _check_rate_limit(request)
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

    try:
        contours = image_to_contours(file_path)
    except Exception as e:
        raise HTTPException(422, f"Image processing failed: {e!s}")

    contour_count = len(contours)
    if contour_count == 0:
        return {"job_id": job_id, "filename": file.filename, "height": height, "contour_count": 0, "message": "No contours found. Try a clearer image or invert colors."}

    mesh = contours_to_mesh(contours, height=height)
    export_path = settings.export_dir / "image" / job_id
    export_path.mkdir(parents=True, exist_ok=True)
    export_mesh(mesh, export_path / "model.stl", "stl")
    export_mesh(mesh, export_path / "model.obj", "obj")

    return {"job_id": job_id, "filename": file.filename, "height": height, "contour_count": contour_count, "message": "Extruded to 3D."}


@router.post("/to3d")
async def image_to3d(request: Request, file: UploadFile = File(...)):
    """Image to 3D via AI API (Meshy). On API failure, falls back to simple extrusion."""
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

    # No API key or fallback: use simple extrusion
    try:
        contours = image_to_contours(file_path)
    except Exception as e:
        raise HTTPException(422, f"Image processing failed: {e!s}")
    if not contours:
        return {"job_id": job_id, "filename": file.filename, "mode": "extrude", "contour_count": 0, "message": "No contours found. Try a clearer image."}
    mesh = contours_to_mesh(contours, height=5.0)
    export_path.mkdir(parents=True, exist_ok=True)
    export_mesh(mesh, export_path / "model.stl", "stl")
    export_mesh(mesh, export_path / "model.obj", "obj")
    return {
        "job_id": job_id,
        "filename": file.filename,
        "mode": "extrude",
        "contour_count": len(contours),
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
