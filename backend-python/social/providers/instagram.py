from urllib.parse import urlencode
import httpx
from config import config

INSTAGRAM_AUTH_URL = "https://api.instagram.com/oauth/authorize"
INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token"
GRAPH_BASE = "https://graph.instagram.com"


class Instagram:
    def get_authorization_url(self, state: str) -> str:
        params = urlencode({
            "client_id": config.instagram_app_id,
            "redirect_uri": config.instagram_redirect_uri,
            "scope": "instagram_basic,instagram_content_publish",
            "response_type": "code",
            "state": state,
        })
        return f"{INSTAGRAM_AUTH_URL}?{params}"

    async def exchange_code(self, code: str) -> dict:
        data = {
            "client_id": config.instagram_app_id,
            "client_secret": config.instagram_app_secret,
            "grant_type": "authorization_code",
            "redirect_uri": config.instagram_redirect_uri,
            "code": code,
        }
        async with httpx.AsyncClient() as client:
            res = await client.post(
                INSTAGRAM_TOKEN_URL,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if not res.is_success:
            raise Exception(f"Instagram token exchange failed: {res.text}")
        return res.json()

    async def get_long_lived_token(self, short_lived_token: str) -> dict:
        params = urlencode({
            "grant_type": "ig_exchange_token",
            "client_secret": config.instagram_app_secret,
            "access_token": short_lived_token,
        })
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{GRAPH_BASE}/access_token?{params}")
        if not res.is_success:
            raise Exception("Failed to get long-lived Instagram token")
        return res.json()

    async def get_account_info(self, access_token: str, user_id) -> dict:
        params = urlencode({"fields": "id,name,username", "access_token": access_token})
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{GRAPH_BASE}/{user_id}?{params}")
        if not res.is_success:
            raise Exception("Failed to get Instagram account info")
        return res.json()

    async def publish_photo(self, access_token: str, user_id: str, caption: str) -> dict:
        # Instagram Content Publishing API requires a publicly accessible image URL.
        # Base64 cannot be passed directly. For production: upload image to cloud storage
        # (S3/GCS), get a public URL, then use the 2-step container + publish flow.
        return {
            "success": True,
            "postId": f"ig_stub_{__import__('time').time_ns() // 1_000_000}",
            "note": "Stub: wire up cloud storage to get a public image URL for production publishing.",
        }


instagram = Instagram()
