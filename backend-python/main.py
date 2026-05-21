import uvicorn
from app import app
from config import config


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=config.port,
        reload=config.node_env == "development",
    )
