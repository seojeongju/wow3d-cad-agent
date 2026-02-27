from pydantic import BaseModel


class CadParseResponse(BaseModel):
    job_id: str
    filename: str | None
    message: str


class CadPreviewResponse(BaseModel):
    job_id: str
    has_file: bool
    layers: list[str] | None = None
    bounds: dict | None = None


class ImageExtrudeResponse(BaseModel):
    job_id: str
    filename: str | None
    height: float
    message: str
