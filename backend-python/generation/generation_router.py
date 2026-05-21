from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from generation.generation_service import generation_service
from middleware.auth import get_current_user
from middleware.rate_limiter import limiter, GENERATION_LIMIT

router = APIRouter()


class GenerateImagesBody(BaseModel):
    prompt: str
    count: Optional[int] = 4


class RegenerateImageBody(BaseModel):
    imageId: str
    prompt: str


@router.post("/images", status_code=201)
@limiter.limit(GENERATION_LIMIT)
async def generate_images(
    request: Request,
    body: GenerateImagesBody,
    current_user: dict = Depends(get_current_user),
):
    if not body.prompt or not body.prompt.strip():
        raise HTTPException(status_code=400, detail="prompt is required")
    images = await generation_service.generate_images(
        user_id=current_user["id"],
        prompt=body.prompt.strip(),
        count=body.count,
    )
    return {"images": images}


@router.post("/regenerate")
@limiter.limit(GENERATION_LIMIT)
async def regenerate_image(
    request: Request,
    body: RegenerateImageBody,
    current_user: dict = Depends(get_current_user),
):
    if not body.imageId or not body.prompt or not body.prompt.strip():
        raise HTTPException(status_code=400, detail="imageId and prompt are required")
    image = await generation_service.regenerate_image(
        user_id=current_user["id"],
        image_id=body.imageId,
        prompt=body.prompt.strip(),
    )
    return {"image": image}


@router.get("/history")
async def get_history(current_user: dict = Depends(get_current_user)):
    history = generation_service.get_history(current_user["id"])
    return {"history": history}
