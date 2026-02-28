import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import health, cad, image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _configure_oda_file_converter() -> None:
    """Set ezdxf odafc executable path from settings (for DWG conversion)."""
    path = settings.oda_file_converter_path
    if not path:
        return
    try:
        import platform
        import ezdxf
        if platform.system() == "Windows":
            ezdxf.options.set("odafc-addon", "win_exec_path", path)
        else:
            ezdxf.options.set("odafc-addon", "unix_exec_path", path)
        logger.info("ODA File Converter path set for DWG support")
    except Exception as e:
        logger.warning("Could not set ODA File Converter path: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    settings.export_dir.mkdir(parents=True, exist_ok=True)
    _configure_oda_file_converter()
    yield


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    import time
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = time.perf_counter() - start
    logger.info("%s %s %s %.3fs", request.method, request.url.path, response.status_code, elapsed)
    return response

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(cad.router, prefix="/api/cad", tags=["cad"])
app.include_router(image.router, prefix="/api/image", tags=["image"])


@app.get("/")
async def root():
    return {"message": "Wow3D CAD Agent API", "docs": "/docs"}
