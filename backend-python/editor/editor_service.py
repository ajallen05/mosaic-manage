import asyncio
from datetime import datetime, timezone
from fastapi import HTTPException
import google.generativeai as genai
from config import config
from repositories.content_repository import content_repository

genai.configure(api_key=config.gemini_api_key)

_IMAGE_MODEL = "gemini-2.0-flash-preview-image-generation"
_GENERATION_CONFIG = {"response_modalities": ["IMAGE", "TEXT"]}


def _find_inline_data(response):
    try:
        for part in response.candidates[0].content.parts:
            if part.inline_data:
                return part.inline_data
    except (IndexError, AttributeError):
        pass
    return None


def _sync_prompt_edit(mime_type: str, base64_data: str, edit_prompt: str):
    model = genai.GenerativeModel(model_name=_IMAGE_MODEL)
    return model.generate_content(
        contents=[{
            "role": "user",
            "parts": [
                {"inline_data": {"mime_type": mime_type, "data": base64_data}},
                {"text": edit_prompt},
            ],
        }],
        generation_config=_GENERATION_CONFIG,
    )


class EditorService:
    async def prompt_edit(self, user_id: str, image_id: str, edit_prompt: str) -> dict:
        record = content_repository.find_by_id(image_id)
        if not record or record["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Image not found")

        response = await asyncio.to_thread(
            _sync_prompt_edit, record["mime_type"], record["base64"], edit_prompt
        )
        inline = _find_inline_data(response)
        if not inline:
            raise HTTPException(status_code=502, detail="Prompt edit failed: no image returned")

        edit_history_entry = {
            "prompt": edit_prompt,
            "base64": record["base64"],
            "editedAt": datetime.now(timezone.utc).isoformat(),
        }
        updated = content_repository.update(image_id, {
            "base64": inline.data,
            "mime_type": inline.mime_type or "image/png",
            "edit_history": [*(record.get("edit_history") or []), edit_history_entry],
        })
        return {"id": updated["id"], "base64": updated["base64"], "mimeType": updated["mime_type"]}

    def save_canvas_edit(
        self,
        user_id: str,
        image_id: str,
        canvas_data,
        composite_base64: str,
        mime_type: str = None,
    ) -> dict:
        record = content_repository.find_by_id(image_id)
        if not record or record["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Image not found")

        edit_history_entry = {
            "prompt": "[canvas edit]",
            "base64": record["base64"],
            "editedAt": datetime.now(timezone.utc).isoformat(),
        }
        updated = content_repository.update(image_id, {
            "base64": composite_base64,
            "mime_type": mime_type or "image/png",
            "canvas_data": canvas_data,
            "edit_history": [*(record.get("edit_history") or []), edit_history_entry],
        })
        return {"id": updated["id"], "base64": updated["base64"], "mimeType": updated["mime_type"]}


editor_service = EditorService()
