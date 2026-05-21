from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from captions.captions_service import captions_service

router = APIRouter()

DEFAULT_USER_ID = 'default'


class GenerateCaptionBody(BaseModel):
    imageId: str
    platform: Optional[str] = "default"
    tone: Optional[str] = "casual"


class UpdateCaptionBody(BaseModel):
    caption: str
    hashtags: List[str]


@router.post("/generate")
async def generate_caption(body: GenerateCaptionBody):
    if not body.imageId:
        raise HTTPException(status_code=400, detail="imageId is required")
    return await captions_service.generate_caption(
        user_id=DEFAULT_USER_ID,
        image_id=body.imageId,
        platform=body.platform or "default",
        tone=body.tone or "casual",
    )


@router.put("/{image_id}")
async def update_caption(image_id: str, body: UpdateCaptionBody):
    if not body.caption or not isinstance(body.hashtags, list):
        raise HTTPException(status_code=400, detail="caption and hashtags array are required")
    return captions_service.update_caption(
        user_id=DEFAULT_USER_ID,
        image_id=image_id,
        caption=body.caption,
        hashtags=body.hashtags,
    )
