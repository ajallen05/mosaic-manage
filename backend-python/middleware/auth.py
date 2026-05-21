from fastapi import HTTPException, Header
from jose import jwt, JWTError
import httpx
from config import config
from repositories.user_repository import user_repository


async def get_current_user(authorization: str = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")
    token = authorization[7:]

    try:
        if config.auth.mode == "local":
            payload = jwt.decode(token, config.auth.jwt_secret, algorithms=["HS256"])
            user = user_repository.find_by_id(payload["userId"])
            if not user:
                raise HTTPException(status_code=401, detail="User not found")
            return {"id": user["id"], "email": user["email"]}

        if config.auth.mode == "mosaic":
            if not config.auth.mosaic_api_url:
                raise HTTPException(status_code=500, detail="MOSAIC_API_URL not configured")
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    f"{config.auth.mosaic_api_url}/api/auth/validate",
                    headers={"Authorization": f"Bearer {token}"},
                )
            if not r.is_success:
                raise HTTPException(status_code=401, detail="Invalid Mosaic token")
            mosaic_user = r.json()
            return {"id": str(mosaic_user["id"]), "email": mosaic_user["email"], "from_mosaic": True}

        raise HTTPException(status_code=500, detail=f"Unknown AUTH_MODE: {config.auth.mode}")

    except HTTPException:
        raise
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
