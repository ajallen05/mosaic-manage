from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from publishing.publishing_service import (
    publish_now,
    schedule_new_post,
    get_scheduled,
    cancel_scheduled,
    get_history,
)
from middleware.auth import get_current_user

router = APIRouter()


class PublishNowBody(BaseModel):
    contentId: str
    platforms: List[str]
    caption: Optional[str] = ""
    hashtags: Optional[List[str]] = []


class SchedulePostBody(BaseModel):
    contentId: str
    platforms: List[str]
    scheduledAt: str
    caption: Optional[str] = ""
    hashtags: Optional[List[str]] = []


@router.post("/now")
async def publish_now_route(
    body: PublishNowBody,
    current_user: dict = Depends(get_current_user),
):
    if not body.contentId or not body.platforms:
        raise HTTPException(status_code=400, detail="contentId and platforms[] are required")
    record = await publish_now(
        user_id=current_user["id"],
        content_id=body.contentId,
        platforms=body.platforms,
        caption=body.caption or "",
        hashtags=body.hashtags or [],
    )
    return {"record": record}


@router.post("/schedule", status_code=201)
async def schedule_post_route(
    body: SchedulePostBody,
    current_user: dict = Depends(get_current_user),
):
    if not body.contentId or not body.platforms or not body.scheduledAt:
        raise HTTPException(
            status_code=400, detail="contentId, platforms[], and scheduledAt are required"
        )
    try:
        scheduled_dt = datetime.fromisoformat(body.scheduledAt)
        if scheduled_dt.tzinfo is None:
            scheduled_dt = scheduled_dt.replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="scheduledAt must be a valid ISO date string")
    if scheduled_dt <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="scheduledAt must be in the future")
    record = schedule_new_post(
        user_id=current_user["id"],
        content_id=body.contentId,
        platforms=body.platforms,
        caption=body.caption or "",
        hashtags=body.hashtags or [],
        scheduled_at=body.scheduledAt,
    )
    return {"record": record}


@router.get("/scheduled")
async def get_scheduled_route(current_user: dict = Depends(get_current_user)):
    return {"posts": get_scheduled(current_user["id"])}


@router.delete("/scheduled/{id}")
async def cancel_scheduled_route(
    id: str,
    current_user: dict = Depends(get_current_user),
):
    record = cancel_scheduled(current_user["id"], id)
    return {"record": record}


@router.get("/history")
async def get_history_route(current_user: dict = Depends(get_current_user)):
    return {"history": get_history(current_user["id"])}
