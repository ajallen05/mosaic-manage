import asyncio
import uuid
import httpx
from fastapi import HTTPException
from config import config
from repositories.content_repository import content_repository

IMAGE_MODEL = 'black-forest-labs/FLUX.1-schnell-Free'
API_URL = 'https://api.together.xyz/v1/images/generations'


async def _generate_one(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(API_URL, headers={
            'Authorization': f'Bearer {config.together_ai_api_key}',
            'Content-Type': 'application/json',
        }, json={
            'model': IMAGE_MODEL,
            'prompt': prompt,
            'width': 1024,
            'height': 1024,
            'steps': 4,
            'n': 1,
            'response_format': 'b64_json',
        })
    if not res.is_success:
        raise Exception(f'Together AI image generation failed: {res.text}')
    return res.json()['data'][0]['b64_json']


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
                print(f'[generation] One slot failed: {res}')
                continue
            record = content_repository.create({
                'id': str(uuid.uuid4()),
                'user_id': user_id,
                'prompt': prompt,
                'base64': res,
                'mime_type': 'image/jpeg',
            })
            images.append({
                'id': record['id'],
                'base64': record['base64'],
                'mimeType': record['mime_type'],
                'prompt': prompt,
            })

        if not images:
            raise HTTPException(status_code=502, detail='Image generation failed: no images returned from Together AI')
        return images

    async def regenerate_image(self, user_id: str, image_id: str, prompt: str) -> dict:
        existing = content_repository.find_by_id(image_id)
        if not existing or existing['user_id'] != user_id:
            raise HTTPException(status_code=404, detail='Image not found')
        base64 = await _generate_one(prompt)
        updated = content_repository.update(image_id, {'base64': base64, 'mime_type': 'image/jpeg', 'prompt': prompt})
        return {'id': updated['id'], 'base64': updated['base64'], 'mimeType': updated['mime_type'], 'prompt': prompt}

    def get_history(self, user_id: str) -> list:
        return [
            {
                'id': r['id'],
                'prompt': r['prompt'],
                'mimeType': r['mime_type'],
                'caption': r.get('caption'),
                'hashtags': r.get('hashtags'),
                'createdAt': r.get('created_at'),
                'updatedAt': r.get('updated_at'),
            }
            for r in content_repository.find_by_user_id(user_id)
        ]


generation_service = GenerationService()
