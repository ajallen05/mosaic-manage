from dotenv import load_dotenv
import os

load_dotenv()


class Config:
    port: int = int(os.getenv("PORT", "3001"))
    node_env: str = os.getenv("NODE_ENV", "development")
    gemini_api_key: str = os.getenv("GOOGLE_GEMINI_API_KEY", "")
    cors_origins: list = [
        s.strip()
        for s in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    ]
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    instagram_app_id: str = os.getenv("INSTAGRAM_APP_ID", "")
    instagram_app_secret: str = os.getenv("INSTAGRAM_APP_SECRET", "")
    instagram_redirect_uri: str = os.getenv("INSTAGRAM_REDIRECT_URI", "")
    linkedin_client_id: str = os.getenv("LINKEDIN_CLIENT_ID", "")
    linkedin_client_secret: str = os.getenv("LINKEDIN_CLIENT_SECRET", "")
    linkedin_redirect_uri: str = os.getenv("LINKEDIN_REDIRECT_URI", "")


config = Config()
