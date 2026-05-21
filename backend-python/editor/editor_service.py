import httpx
from datetime import datetime, timezone
from fastapi import HTTPException
from config import config
from repositories.content_repository import content_repository

IMAGE_MODEL = 'black-forest-labs/FLUX.1-schnell-Free'
API_URL = 'https://api.together.xyz/v1/images/generations'


async def _generate_image(prompt: str) -> str:
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
        raise Exception(f'Together AI image edit failed: {res.text}')
    return res.json()['data'][0]['b64_json']


class EditorService:
    async def prompt_edit(self, user_id: str, image_id: str, edit_prompt: str) -> dict:
        record = content_repository.find_by_id(image_id)
        if not record or record['user_id'] != user_id:
            raise HTTPException(status_code=404, detail='Image not found')

        combined_prompt = f"{record['prompt']}. {edit_prompt}"
        base64 = await _generate_image(combined_prompt)

        edit_history_entry = {
            'prompt': edit_prompt,
            'base64': record['base64'],
            'editedAt': datetime.now(timezone.utc).isoformat(),
        }
        updated = content_repository.update(image_id, {
            'base64': base64,
            'mime_type': 'image/jpeg',
            'edit_history': [*(record.get('edit_history') or []), edit_history_entry],
        })
        return {'id': updated['id'], 'base64': updated['base64'], 'mimeType': updated['mime_type']}

    def save_canvas_edit(self, user_id, image_id, canvas_data, composite_base64, mime_type=None):
        record = content_repository.find_by_id(image_id)
        if not record or record['user_id'] != user_id:
            raise HTTPException(status_code=404, detail='Image not found')

        edit_history_entry = {
            'prompt': '[canvas edit]',
            'base64': record['base64'],
            'editedAt': datetime.now(timezone.utc).isoformat(),
        }
        updated = content_repository.update(image_id, {
            'base64': composite_base64,
            'mime_type': mime_type or 'image/png',
            'canvas_data': canvas_data,
            'edit_history': [*(record.get('edit_history') or []), edit_history_entry],
        })
        return {'id': updated['id'], 'base64': updated['base64'], 'mimeType': updated['mime_type']}


editor_service = EditorService()
