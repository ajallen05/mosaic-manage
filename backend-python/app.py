import traceback
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from config import config
from middleware.rate_limiter import limiter
from generation.generation_router import router as generation_router
from editor.editor_router import router as editor_router
from captions.captions_router import router as captions_router
from social.social_router import router as social_router
from publishing.publishing_router import router as publishing_router


app = FastAPI(title="mosaic-manage")

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Use {"error": ...} shape matching Node.js responses
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=400, content={"error": str(exc.errors())})


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    if config.node_env != "production":
        print(f"[error] {exc}")
        return JSONResponse(
            status_code=500,
            content={"error": str(exc), "stack": traceback.format_exc()},
        )
    return JSONResponse(status_code=500, content={"error": "Internal server error"})


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "mosaic-manage",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


app.include_router(generation_router, prefix="/api/v1/generate")
app.include_router(editor_router, prefix="/api/v1/editor")
app.include_router(captions_router, prefix="/api/v1/captions")
app.include_router(social_router, prefix="/api/v1/social")
app.include_router(publishing_router, prefix="/api/v1/publish")
