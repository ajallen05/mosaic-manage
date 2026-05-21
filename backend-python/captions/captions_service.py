import asyncio
import json
import re
from fastapi import HTTPException
import google.generativeai as genai
from config import config
from repositories.content_repository import content_repository

genai.configure(api_key=config.gemini_api_key)

_TEXT_MODEL = "gemini-2.5-flash"

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


def _sync_generate_caption(prompt_text: str) -> str:
    model = genai.GenerativeModel(model_name=_TEXT_MODEL)
    result = model.generate_content(prompt_text)
    return result.text.strip()


class CaptionsService:
    async def generate_caption(
        self,
        user_id: str,
        image_id: str,
        platform: str = "default",
        tone: str = "casual",
    ) -> dict:
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

        raw = await asyncio.to_thread(_sync_generate_caption, prompt)

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

        return {
            "caption": parsed["caption"],
            "hashtags": parsed["hashtags"],
            "platform": platform,
            "tone": tone,
        }

    def update_caption(self, user_id: str, image_id: str, caption: str, hashtags: list) -> dict:
        record = content_repository.find_by_id(image_id)
        if not record or record["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Image not found")
        updated = content_repository.update(image_id, {"caption": caption, "hashtags": hashtags})
        return {"caption": updated["caption"], "hashtags": updated["hashtags"]}


captions_service = CaptionsService()
