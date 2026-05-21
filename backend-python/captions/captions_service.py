import json
import re
import httpx
from fastapi import HTTPException
from config import config
from repositories.content_repository import content_repository

TEXT_MODEL = 'meta-llama/Llama-3.2-3B-Instruct-Turbo'
API_URL = 'https://api.together.xyz/v1/chat/completions'

PLATFORM_GUIDANCE = {
    'instagram': 'Instagram — casual, visual, personal tone; use 5–30 relevant hashtags; emojis encouraged.',
    'linkedin': 'LinkedIn — professional, thought-leadership tone; 3–5 niche hashtags only; minimal emojis.',
    'default': 'General social media; balanced professional-casual tone; 10–20 hashtags.',
}

TONE_MODIFIERS = {
    'casual': 'Write in a fun, relaxed, conversational tone.',
    'professional': 'Write in a polished, authoritative, business-appropriate tone.',
    'playful': 'Write in a witty, energetic, bold tone with creative wordplay.',
    'inspirational': 'Write in an uplifting, motivational tone that inspires action.',
}


async def _generate_text(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(API_URL, headers={
            'Authorization': f'Bearer {config.together_ai_api_key}',
            'Content-Type': 'application/json',
        }, json={
            'model': TEXT_MODEL,
            'messages': [{'role': 'user', 'content': prompt}],
            'max_tokens': 512,
            'temperature': 0.7,
        })
    if not res.is_success:
        raise Exception(f'Together AI caption generation failed: {res.text}')
    return res.json()['choices'][0]['message']['content'].strip()


class CaptionsService:
    async def generate_caption(self, user_id, image_id, platform='default', tone='casual'):
        record = content_repository.find_by_id(image_id)
        if not record or record['user_id'] != user_id:
            raise HTTPException(status_code=404, detail='Image not found')

        platform_guide = PLATFORM_GUIDANCE.get(platform, PLATFORM_GUIDANCE['default'])
        tone_guide = TONE_MODIFIERS.get(tone, TONE_MODIFIERS['casual'])

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
            cleaned = re.sub(r'```json|```', '', raw).strip()
            parsed = json.loads(cleaned)

        content_repository.update(image_id, {
            'caption': parsed['caption'],
            'hashtags': parsed['hashtags'],
            'caption_platform': platform,
            'caption_tone': tone,
        })
        return {'caption': parsed['caption'], 'hashtags': parsed['hashtags'], 'platform': platform, 'tone': tone}

    def update_caption(self, user_id, image_id, caption, hashtags):
        record = content_repository.find_by_id(image_id)
        if not record or record['user_id'] != user_id:
            raise HTTPException(status_code=404, detail='Image not found')
        updated = content_repository.update(image_id, {'caption': caption, 'hashtags': hashtags})
        return {'caption': updated['caption'], 'hashtags': updated['hashtags']}


captions_service = CaptionsService()
