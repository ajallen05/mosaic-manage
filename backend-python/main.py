import uvicorn
from app import app
from config import config
from publishing.scheduler import init_scheduler


@app.on_event("startup")
async def startup_event():
    print(f"[mosaic-manage] Backend running on http://localhost:{config.port}")
    print(
        f"[mosaic-manage] Together AI key: "
        f"{'set' if config.together_ai_api_key else 'MISSING — set TOGETHER_AI_API_KEY'}"
    )
    init_scheduler()


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=config.port,
        reload=config.node_env == "development",
    )
