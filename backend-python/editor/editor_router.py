from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Any
from editor.editor_service import editor_service
from middleware.auth import get_current_user
from middleware.rate_limiter import limiter, GENERATION_LIMIT

router = APIRouter()


class PromptEditBody(BaseModel):
    imageId: str
    editPrompt: str


class SaveCanvasBody(BaseModel):
    imageId: str
    compositeBase64: str
    canvasData: Optional[Any] = None
    mimeType: Optional[str] = None


@router.post("/prompt-edit")
@limiter.limit(GENERATION_LIMIT)
async def prompt_edit(
    request: Request,
    body: PromptEditBody,
    current_user: dict = Depends(get_current_user),
):
    if not body.imageId or not body.editPrompt or not body.editPrompt.strip():
        raise HTTPException(status_code=400, detail="imageId and editPrompt are required")
    image = await editor_service.prompt_edit(
        user_id=current_user["id"],
        image_id=body.imageId,
        edit_prompt=body.editPrompt.strip(),
    )
    return {"image": image}


@router.post("/save")
async def save_canvas(
    body: SaveCanvasBody,
    current_user: dict = Depends(get_current_user),
):
    if not body.imageId or not body.compositeBase64:
        raise HTTPException(status_code=400, detail="imageId and compositeBase64 are required")
    image = editor_service.save_canvas_edit(
        user_id=current_user["id"],
        image_id=body.imageId,
        canvas_data=body.canvasData,
        composite_base64=body.compositeBase64,
        mime_type=body.mimeType,
    )
    return {"image": image}
