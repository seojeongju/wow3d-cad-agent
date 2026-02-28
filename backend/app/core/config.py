from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Wow3D CAD Agent"
    debug: bool = False
    upload_dir: Path = Path("uploads")
    export_dir: Path = Path("exports")
    max_upload_mb: int = 50
    # AI API (Phase 4) - optional
    meshy_api_key: str | None = None
    # Supabase (optional - if set, uploads/exports use Storage instead of local disk)
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
