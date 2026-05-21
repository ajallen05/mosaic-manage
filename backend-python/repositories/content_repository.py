import uuid
from datetime import datetime, timezone

# In-memory store for generated/edited content records.
# Shape: { id, user_id, prompt, base64, mime_type, edit_history[], caption,
#          hashtags, caption_platform, caption_tone, canvas_data?, created_at, updated_at }
_items: dict = {}


class ContentRepository:
    def find_by_id(self, id: str):
        return _items.get(id)

    def find_by_user_id(self, user_id: str) -> list:
        return [i for i in _items.values() if i["user_id"] == user_id]

    def create(self, data: dict) -> dict:
        record = {
            **data,
            "id": data.get("id") or str(uuid.uuid4()),
            "edit_history": data.get("edit_history", []),
            "caption": data.get("caption"),
            "hashtags": data.get("hashtags"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        _items[record["id"]] = record
        return record

    def update(self, id: str, patch: dict):
        existing = _items.get(id)
        if not existing:
            return None
        updated = {**existing, **patch, "updated_at": datetime.now(timezone.utc).isoformat()}
        _items[id] = updated
        return updated

    def delete(self, id: str) -> bool:
        return _items.pop(id, None) is not None

    def find_all(self) -> list:
        return list(_items.values())


content_repository = ContentRepository()
