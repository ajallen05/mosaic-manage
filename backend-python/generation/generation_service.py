import asyncio
import uuid
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


def _sync_generate_image(prompt: str):
    model = genai.GenerativeModel(model_name=_IMAGE_MODEL)
    return model.generate_content(
        contents=[{"role": "user", "parts": [{"text": prompt}]}],
        generation_config=_GENERATION_CONFIG,
    )


class GenerationService:
    async def generate_images(self, user_id: str, prompt: str, count: int = 4) -> list:
        safe_count = max(1, min(int(count or 1), 4))

        tasks = [asyncio.to_thread(_sync_generate_image, prompt) for _ in range(safe_count)]
        responses = await asyncio.gather(*tasks, return_exceptions=True)

        results = []
        for res in responses:
            if isinstance(res, Exception):
                print(f"[generation] Image generation failed for one slot: {res}")
                continue
            inline = _find_inline_data(res)
            if not inline:
                continue
            record = content_repository.create({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "prompt": prompt,
                "base64": inline.data,
                "mime_type": inline.mime_type or "image/png",
            })
            results.append({
                "id": record["id"],
                "base64": record["base64"],
                "mimeType": record["mime_type"],
                "prompt": prompt,
            })

        if not results:
            raise HTTPException(
                status_code=502,
                detail="Image generation failed: no images returned from Gemini",
            )
        return results

    async def regenerate_image(self, user_id: str, image_id: str, prompt: str) -> dict:
        existing = content_repository.find_by_id(image_id)
        if not existing or existing["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Image not found")

        response = await asyncio.to_thread(_sync_generate_image, prompt)
        inline = _find_inline_data(response)
        if not inline:
            raise HTTPException(status_code=502, detail="Regeneration failed: no image returned")

        updated = content_repository.update(image_id, {
            "base64": inline.data,
            "mime_type": inline.mime_type or "image/png",
            "prompt": prompt,
        })
        return {
            "id": updated["id"],
            "base64": updated["base64"],
            "mimeType": updated["mime_type"],
            "prompt": prompt,
        }

    def get_history(self, user_id: str) -> list:
        return [
            {
                "id": r["id"],
                "prompt": r["prompt"],
                "mimeType": r["mime_type"],
                "caption": r.get("caption"),
                "hashtags": r.get("hashtags"),
                "createdAt": r.get("created_at"),
                "updatedAt": r.get("updated_at"),
            }
            for r in content_repository.find_by_user_id(user_id)
        ]


generation_service = GenerationService()
