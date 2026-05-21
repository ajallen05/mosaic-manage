import time
import uuid
from fastapi import HTTPException
from social.providers.instagram import instagram
from social.providers.linkedin import linkedin
from repositories.publish_repository import publish_repository
from config import config
from datetime import datetime, timezone

# In-memory OAuth state store: state_uuid → { user_id, platform, created_at }
_oauth_states: dict = {}


def _create_state(user_id: str, platform: str) -> str:
    state = str(uuid.uuid4())
    _oauth_states[state] = {"user_id": user_id, "platform": platform, "created_at": time.time()}
    return state


def _consume_state(state: str):
    entry = _oauth_states.pop(state, None)
    if not entry:
        return None
    if time.time() - entry["created_at"] > 10 * 60:  # 10 min expiry
        return None
    return entry


class SocialService:
    def get_connections(self, user_id: str) -> list:
        return [
            {
                "platform": c["platform"],
                "accountId": c["account_id"],
                "accountName": c["account_name"],
                "connectedAt": c["connected_at"],
            }
            for c in publish_repository.find_connections_by_user_id(user_id)
        ]

    def get_instagram_auth_url(self, user_id: str) -> str:
        if not config.instagram_app_id:
            raise HTTPException(
                status_code=503,
                detail="Instagram OAuth not configured. Set INSTAGRAM_APP_ID in .env",
            )
        state = _create_state(user_id, "instagram")
        return instagram.get_authorization_url(state)

    async def handle_instagram_callback(self, code: str, state: str) -> str:
        state_data = _consume_state(state)
        if not state_data:
            raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

        token_data = await instagram.exchange_code(code)
        long_lived = await instagram.get_long_lived_token(token_data["access_token"])
        account_info = await instagram.get_account_info(
            long_lived["access_token"], token_data["user_id"]
        )

        publish_repository.upsert_connection({
            "user_id": state_data["user_id"],
            "platform": "instagram",
            "account_id": str(token_data["user_id"]),
            "account_name": account_info.get("username") or account_info.get("name") or "Instagram Account",
            "access_token": long_lived["access_token"],
            "expires_at": datetime.fromtimestamp(
                time.time() + (long_lived.get("expires_in") or 5184000),
                tz=timezone.utc,
            ).isoformat(),
        })
        return state_data["user_id"]

    def get_linkedin_auth_url(self, user_id: str) -> str:
        if not config.linkedin_client_id:
            raise HTTPException(
                status_code=503,
                detail="LinkedIn OAuth not configured. Set LINKEDIN_CLIENT_ID in .env",
            )
        state = _create_state(user_id, "linkedin")
        return linkedin.get_authorization_url(state)

    async def handle_linkedin_callback(self, code: str, state: str) -> str:
        state_data = _consume_state(state)
        if not state_data:
            raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

        token_data = await linkedin.exchange_code(code)
        profile = await linkedin.get_profile(token_data["access_token"])

        publish_repository.upsert_connection({
            "user_id": state_data["user_id"],
            "platform": "linkedin",
            "account_id": profile["sub"],
            "account_name": profile.get("name") or profile.get("email") or "LinkedIn Account",
            "access_token": token_data["access_token"],
            "expires_at": datetime.fromtimestamp(
                time.time() + (token_data.get("expires_in") or 5184000),
                tz=timezone.utc,
            ).isoformat(),
        })
        return state_data["user_id"]

    def disconnect_instagram(self, user_id: str) -> bool:
        return publish_repository.delete_connection(user_id, "instagram")

    def disconnect_linkedin(self, user_id: str) -> bool:
        return publish_repository.delete_connection(user_id, "linkedin")


social_service = SocialService()
