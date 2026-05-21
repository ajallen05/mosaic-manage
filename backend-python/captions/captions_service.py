import json
import re

import httpx
from fastapi import HTTPException

from repositories.content_repository import content_repository

_TEXT_URL = "https://text.pollinations.ai/"

PLATFORM_GUIDANCE = {
    "instagram": "Instagram — casual, visual, personal tone; use 5–30 relevant hashtags; emojis encouraged.",
    "linkedin": "LinkedIn — professional, thought-leadership tone; 3–5 niche hashtags only; minimal emojis.",
    "default": "General social media; balanced professional-casual tone; 10–20 hashtags.",
}

TONE_MODIFIERS = {
    "casual": "Write in a fun, relaxed, conversational tone.",
    "professional": "Write in a polished, authoritative, business-appropriate tone.",
    "playful": "Write in a witty, energetic, bold tone with creative wordplay.",
    "inspirational": "Write in an uplifting, motivational tone that inspires action.",
}


async def _generate_text(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            _TEXT_URL,
            json={
                "messages": [{"role": "user", "content": prompt}],
                "model": "openai",
                "jsonMode": True,
            },
        )
    if not res.is_success:
        raise Exception(f"Pollinations text generation failed: {res.status_code}")
    return res.text.strip()


class CaptionsService:
    async def generate_caption(self, user_id, image_id, platform="default", tone="casual"):
        record = content_repository.find_by_id(image_id)
        if not record or record["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Image not found")

        platform_guide = PLATFORM_GUIDANCE.get(platform, PLATFORM_GUIDANCE["default"])
        tone_guide = TONE_MODIFIERS.get(tone, TONE_MODIFIERS["casual"])

        prompt = (
            f'You are a social media copywriter. Generate a post caption and hashtags for a marketing/advertisement image.\n\n'
            f'The image was created with this prompt: "{record["prompt"]}"\n\n'
            f'Platform guidelines: {platform_guide}\n'
            f'Tone: {tone_guide}\n\n'
            f'Respond ONLY with valid JSON, no markdown fences, no explanation:\n'
            f'{{"caption":"<the post caption, 1-3 sentences>","hashtags":["<hashtag1>","<hashtag2>"],"characterCount":<number>}}'
        )

        raw = await _generate_text(prompt)
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            cleaned = re.sub(r"```json|```", "", raw).strip()
            parsed = json.loads(cleaned)

        content_repository.update(image_id, {
            "caption": parsed["caption"],
            "hashtags": parsed["hashtags"],
            "caption_platform": platform,
            "caption_tone": tone,
        })
        return {"caption": parsed["caption"], "hashtags": parsed["hashtags"], "platform": platform, "tone": tone}

    def update_caption(self, user_id, image_id, caption, hashtags):
        record = content_repository.find_by_id(image_id)
        if not record or record["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Image not found")
        updated = content_repository.update(image_id, {"caption": caption, "hashtags": hashtags})
        return {"caption": updated["caption"], "hashtags": updated["hashtags"]}


captions_service = CaptionsService()
