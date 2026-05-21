import uuid
from passlib.context import CryptContext
from datetime import datetime, timezone

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

# In-memory store. To switch to PostgreSQL: replace this file with an adapter
# that exposes the same interface (find_by_id, find_by_email, create, update, delete, find_all).
_users: dict = {}
_by_email: dict = {}


class UserRepository:
    def find_by_id(self, id: str):
        return _users.get(id)

    def find_by_email(self, email: str):
        uid = _by_email.get(email.lower())
        return _users.get(uid) if uid else None

    async def create(self, email: str, password: str, name: str) -> dict:
        uid = str(uuid.uuid4())
        password_hash = pwd_context.hash(password)
        user = {
            "id": uid,
            "email": email.lower(),
            "password_hash": password_hash,
            "name": name,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        _users[uid] = user
        _by_email[email.lower()] = uid
        return user

    def update(self, id: str, patch: dict):
        user = _users.get(id)
        if not user:
            return None
        updated = {**user, **patch, "updated_at": datetime.now(timezone.utc).isoformat()}
        _users[id] = updated
        return updated

    def delete(self, id: str) -> bool:
        user = _users.get(id)
        if not user:
            return False
        _by_email.pop(user["email"], None)
        _users.pop(id)
        return True

    def find_all(self) -> list:
        return list(_users.values())


user_repository = UserRepository()
