from fastapi import APIRouter
from fastapi.responses import RedirectResponse
from typing import Optional
from social.social_service import social_service
from config import config

router = APIRouter()

DEFAULT_USER_ID = 'default'


@router.get("/connections")
async def get_connections():
    return {"connections": social_service.get_connections(DEFAULT_USER_ID)}


@router.get("/instagram/auth")
async def instagram_auth():
    url = social_service.get_instagram_auth_url(DEFAULT_USER_ID)
    return RedirectResponse(url=url)


@router.get("/instagram/callback")
async def instagram_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
):
    if error or not code or not state:
        return RedirectResponse(url=f"{config.frontend_url}/social?error=instagram_denied")
    try:
        await social_service.handle_instagram_callback(code=code, state=state)
        return RedirectResponse(url=f"{config.frontend_url}/social?connected=instagram")
    except Exception as e:
        print(f"[social] Instagram callback error: {e}")
        return RedirectResponse(url=f"{config.frontend_url}/social?error=instagram_failed")


@router.delete("/instagram")
async def disconnect_instagram():
    social_service.disconnect_instagram(DEFAULT_USER_ID)
    return {"success": True}


@router.get("/linkedin/auth")
async def linkedin_auth():
    url = social_service.get_linkedin_auth_url(DEFAULT_USER_ID)
    return RedirectResponse(url=url)


@router.get("/linkedin/callback")
async def linkedin_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
):
    if error or not code or not state:
        return RedirectResponse(url=f"{config.frontend_url}/social?error=linkedin_denied")
    try:
        await social_service.handle_linkedin_callback(code=code, state=state)
        return RedirectResponse(url=f"{config.frontend_url}/social?connected=linkedin")
    except Exception as e:
        print(f"[social] LinkedIn callback error: {e}")
        return RedirectResponse(url=f"{config.frontend_url}/social?error=linkedin_failed")


@router.delete("/linkedin")
async def disconnect_linkedin():
    social_service.disconnect_linkedin(DEFAULT_USER_ID)
    return {"success": True}
