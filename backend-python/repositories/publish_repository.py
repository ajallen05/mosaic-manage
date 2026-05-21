import uuid
from datetime import datetime, timezone

# Two sub-stores in one file: social connections and publish records.
#
# Connection shape: { id, user_id, platform, account_id, account_name,
#                     access_token, refresh_token?, expires_at, connected_at }
#
# Publish record shape: { id, user_id, content_id, platforms[], caption, hashtags,
#                         scheduled_at, status, result, created_at, published_at? }
_connections: dict = {}
_publish_records: dict = {}


class PublishRepository:
    # --- Social connections ---

    def find_connections_by_user_id(self, user_id: str) -> list:
        return [c for c in _connections.values() if c["user_id"] == user_id]

    def find_connection_by_user_and_platform(self, user_id: str, platform: str):
        return next(
            (c for c in _connections.values()
             if c["user_id"] == user_id and c["platform"] == platform),
            None,
        )

    def upsert_connection(self, data: dict) -> dict:
        existing = self.find_connection_by_user_and_platform(data["user_id"], data["platform"])
        cid = existing["id"] if existing else str(uuid.uuid4())
        record = {
            **data,
            "id": cid,
            "connected_at": existing["connected_at"] if existing else datetime.now(timezone.utc).isoformat(),
        }
        _connections[cid] = record
        return record

    def delete_connection(self, user_id: str, platform: str) -> bool:
        conn = self.find_connection_by_user_and_platform(user_id, platform)
        if not conn:
            return False
        _connections.pop(conn["id"])
        return True

    # --- Publish records ---

    def create_publish_record(self, data: dict) -> dict:
        record = {**data, "id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat()}
        _publish_records[record["id"]] = record
        return record

    def find_publish_record_by_id(self, id: str):
        return _publish_records.get(id)

    def find_scheduled_by_user_id(self, user_id: str) -> list:
        return [
            r for r in _publish_records.values()
            if r["user_id"] == user_id and r["status"] == "pending" and r.get("scheduled_at")
        ]

    def find_history_by_user_id(self, user_id: str) -> list:
        return [
            r for r in _publish_records.values()
            if r["user_id"] == user_id and r["status"] != "pending"
        ]

    def update_publish_record(self, id: str, patch: dict):
        existing = _publish_records.get(id)
        if not existing:
            return None
        updated = {**existing, **patch}
        _publish_records[id] = updated
        return updated

    def find_all_publish_records(self) -> list:
        return list(_publish_records.values())


publish_repository = PublishRepository()
