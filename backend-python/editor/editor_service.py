import base64
import random
from datetime import datetime, timezone
from urllib.parse import quote

import httpx
from fastapi import HTTPException

from repositories.content_repository import content_repository

_IMAGE_URL = "https://image.pollinations.ai/prompt/{prompt}"


async def _generate_image(prompt: str) -> str:
    seed = random.randint(1, 2 ** 31)
    encoded = quote(prompt, safe="")
    url = (
        f"{_IMAGE_URL.format(prompt=encoded)}"
        f"?width=1024&height=1024&model=flux&nologo=true&seed={seed}"
    )
    async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
        res = await client.get(url)
    if not res.is_success:
        raise Exception(f"Pollinations image edit failed: {res.status_code}")
    return base64.b64encode(res.content).decode("utf-8")


class EditorService:
    async def prompt_edit(self, user_id: str, image_id: str, edit_prompt: str) -> dict:
        record = content_repository.find_by_id(image_id)
        if not record or record["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Image not found")

        combined_prompt = f"{record['prompt']}. {edit_prompt}"
        b64 = await _generate_image(combined_prompt)

        entry = {
            "prompt": edit_prompt,
            "base64": record["base64"],
            "editedAt": datetime.now(timezone.utc).isoformat(),
        }
        updated = content_repository.update(image_id, {
            "base64": b64,
            "mime_type": "image/jpeg",
            "edit_history": [*(record.get("edit_history") or []), entry],
        })
        return {"id": updated["id"], "base64": updated["base64"], "mimeType": updated["mime_type"]}

    def save_canvas_edit(self, user_id, image_id, canvas_data, composite_base64, mime_type=None):
        record = content_repository.find_by_id(image_id)
        if not record or record["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Image not found")

        entry = {
            "prompt": "[canvas edit]",
            "base64": record["base64"],
            "editedAt": datetime.now(timezone.utc).isoformat(),
        }
        updated = content_repository.update(image_id, {
            "base64": composite_base64,
            "mime_type": mime_type or "image/png",
            "canvas_data": canvas_data,
            "edit_history": [*(record.get("edit_history") or []), entry],
        })
        return {"id": updated["id"], "base64": updated["base64"], "mimeType": updated["mime_type"]}


editor_service = EditorService()
