import asyncio
import base64
import random
import uuid
from urllib.parse import quote

import httpx
from fastapi import HTTPException

from config import config
from repositories.content_repository import content_repository

_IMAGE_URL = "https://image.pollinations.ai/prompt/{prompt}"


async def _generate_one(prompt: str) -> str:
    seed = random.randint(1, 2 ** 31)
    encoded = quote(prompt, safe="")
    url = (
        f"{_IMAGE_URL.format(prompt=encoded)}"
        f"?width=1024&height=1024&model=flux&nologo=true&seed={seed}"
    )
    async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
        res = await client.get(url)
    if not res.is_success:
        raise Exception(f"Pollinations image generation failed: {res.status_code}")
    return base64.b64encode(res.content).decode("utf-8")


class GenerationService:
    async def generate_images(self, user_id: str, prompt: str, count: int = 4) -> list:
        safe_count = max(1, min(int(count or 1), 4))

        results = await asyncio.gather(
            *[_generate_one(prompt) for _ in range(safe_count)],
            return_exceptions=True,
        )

        images = []
        for res in results:
            if isinstance(res, Exception):
                print(f"[generation] One slot failed: {res}")
                continue
            record = content_repository.create({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "prompt": prompt,
                "base64": res,
                "mime_type": "image/jpeg",
            })
            images.append({
                "id": record["id"],
                "base64": record["base64"],
                "mimeType": record["mime_type"],
                "prompt": prompt,
            })

        if not images:
            raise HTTPException(
                status_code=502,
                detail="Image generation failed: no images returned from Pollinations",
            )
        return images

    async def regenerate_image(self, user_id: str, image_id: str, prompt: str) -> dict:
        existing = content_repository.find_by_id(image_id)
        if not existing or existing["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Image not found")
        b64 = await _generate_one(prompt)
        updated = content_repository.update(image_id, {
            "base64": b64,
            "mime_type": "image/jpeg",
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
