from urllib.parse import urlencode
import httpx
from config import config

LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
LINKEDIN_API_BASE = "https://api.linkedin.com/v2"


class LinkedIn:
    def get_authorization_url(self, state: str) -> str:
        params = urlencode({
            "response_type": "code",
            "client_id": config.linkedin_client_id,
            "redirect_uri": config.linkedin_redirect_uri,
            "scope": "openid profile email w_member_social",
            "state": state,
        })
        return f"{LINKEDIN_AUTH_URL}?{params}"

    async def exchange_code(self, code: str) -> dict:
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": config.linkedin_redirect_uri,
            "client_id": config.linkedin_client_id,
            "client_secret": config.linkedin_client_secret,
        }
        async with httpx.AsyncClient() as client:
            res = await client.post(
                LINKEDIN_TOKEN_URL,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if not res.is_success:
            raise Exception(f"LinkedIn token exchange failed: {res.text}")
        return res.json()

    async def get_profile(self, access_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{LINKEDIN_API_BASE}/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if not res.is_success:
            raise Exception("Failed to get LinkedIn profile")
        return res.json()

    async def publish_post(self, caption: str, hashtags: list, **kwargs) -> dict:
        # LinkedIn image publishing requires a multi-step binary upload registration:
        # 1) POST /assets?action=registerUpload → get uploadUrl + asset URN
        # 2) PUT <uploadUrl> with binary image data
        # 3) POST /ugcPosts with asset URN and text
        # For production: implement binary upload and UGC post creation.
        cleaned_tags = [f"#{h.lstrip('#')}" for h in hashtags]
        text = f"{caption}\n\n{' '.join(cleaned_tags)}"
        return {
            "success": True,
            "postId": f"li_stub_{__import__('time').time_ns() // 1_000_000}",
            "text": text,
            "note": "Stub: implement binary upload registration for production LinkedIn publishing.",
        }


linkedin = LinkedIn()
