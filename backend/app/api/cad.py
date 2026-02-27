from pathlib import Path
import uuid

from fastapi import APIRouter, File, UploadFile, HTTPException, Query, Request
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.rate_limit import upload_limiter
from app.services.cad_parser import parse_dxf
from app.services.extrusion import contours_to_mesh, export_mesh

router = APIRouter()

DEFAULT_CAD_HEIGHT = 1.0


@router.post("/parse")
async def cad_parse(request: Request, file: UploadFile = File(...)):
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
    upload_path = settings.upload_dir / "cad" / job_id
    upload_path.mkdir(parents=True, exist_ok=True)
    file_path = upload_path / (file.filename or "drawing.dxf")
    content = await file.read()
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(400, f"File too large (max {settings.max_upload_mb}MB)")
    file_path.write_bytes(content)

    if ext == ".dwg":
        return {"job_id": job_id, "filename": file.filename, "message": "DWG upload OK. Export as DXF in AutoCAD for conversion.", "converted": False}

    try:
        result = parse_dxf(file_path)
    except Exception as e:
        raise HTTPException(422, f"DXF parse failed: {e!s}")

    contours = result["contours"]
    if not contours:
        return {"job_id": job_id, "filename": file.filename, "layers": result["layers"], "bounds": result["bounds"], "message": "No closed contours found for extrusion."}

    mesh = contours_to_mesh(contours, height=DEFAULT_CAD_HEIGHT)
    export_path = settings.export_dir / "cad" / job_id
    export_path.mkdir(parents=True, exist_ok=True)
    export_mesh(mesh, export_path / "model.stl", "stl")
    export_mesh(mesh, export_path / "model.obj", "obj")

    return {
        "job_id": job_id,
        "filename": file.filename,
        "layers": result["layers"],
        "bounds": result["bounds"],
        "contour_count": len(contours),
        "message": "Parsed and converted to 3D.",
    }


@router.get("/export")
async def cad_export(job_id: str = Query(...), format: str = Query("stl", regex="^(stl|obj)$")):
    """Download converted 3D file (STL or OBJ)."""
    export_path = settings.export_dir / "cad" / job_id
    if format == "stl":
        path = export_path / "model.stl"
    else:
        path = export_path / "model.obj"
    if not path.exists():
        raise HTTPException(404, "Export not found. Run conversion first.")
    return FileResponse(path, filename=f"model.{format}")


@router.get("/preview")
async def cad_preview(job_id: str = Query(...)):
    """Get metadata for a CAD job (layers, bounds)."""
    upload_path = settings.upload_dir / "cad" / job_id
    if not upload_path.exists():
        raise HTTPException(404, "Job not found")
    dxf_files = list(upload_path.glob("*.dxf"))
    if not dxf_files:
        return {"job_id": job_id, "has_file": False, "message": "DWG job or no DXF; use DXF for conversion."}
    try:
        result = parse_dxf(dxf_files[0])
        return {"job_id": job_id, "has_file": True, "layers": result["layers"], "bounds": result["bounds"], "line_count": result["line_count"]}
    except Exception:
        return {"job_id": job_id, "has_file": True}
