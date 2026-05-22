import base64
import io
import random
from datetime import datetime, timezone
from urllib.parse import quote

import httpx
from fastapi import HTTPException
from PIL import Image

from repositories.content_repository import content_repository

_IMAGE_URL = "https://image.pollinations.ai/prompt/{prompt}"

_FORMAT_META = {
    "png":  ("image/png",  "png"),
    "jpeg": ("image/jpeg", "jpg"),
    "webp": ("image/webp", "webp"),
}


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

    def save_canvas_edit(self, user_id, image_id, canvas_data, composite_base64, scene_graph=None, mime_type=None):
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
            "scene_graph": scene_graph,
            "edit_history": [*(record.get("edit_history") or []), entry],
        })
        return {"id": updated["id"], "base64": updated["base64"], "mimeType": updated["mime_type"]}

    def export_image(self, user_id: str, image_id: str, fmt: str = "png", quality: float = 0.92):
        record = content_repository.find_by_id(image_id)
        if not record or record["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Image not found")

        fmt = fmt.lower()
        if fmt not in _FORMAT_META:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {fmt}")

        media_type, ext = _FORMAT_META[fmt]
        raw = base64.b64decode(record["base64"])
        img = Image.open(io.BytesIO(raw)).convert("RGBA" if fmt == "png" else "RGB")

        buf = io.BytesIO()
        pil_fmt = fmt.upper() if fmt != "jpeg" else "JPEG"
        save_kwargs = {}
        if fmt in ("jpeg", "webp"):
            save_kwargs["quality"] = max(1, min(95, int(quality * 100)))
        if fmt == "png":
            img_out = img
        else:
            img_out = img.convert("RGB")
        img_out.save(buf, format=pil_fmt, **save_kwargs)
        return buf.getvalue(), media_type, ext


editor_service = EditorService()
