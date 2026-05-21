from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from jose import jwt
from passlib.context import CryptContext
from config import config
from repositories.user_repository import user_repository

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _parse_expires_in(value: str) -> timedelta:
    """Parse a duration string like '7d', '24h', '60m' into a timedelta."""
    unit = value[-1]
    amount = int(value[:-1])
    if unit == "d":
        return timedelta(days=amount)
    if unit == "h":
        return timedelta(hours=amount)
    if unit == "m":
        return timedelta(minutes=amount)
    if unit == "s":
        return timedelta(seconds=amount)
    return timedelta(days=7)


class AuthService:
    async def register(self, email: str, password: str, name: str) -> dict:
        if user_repository.find_by_email(email):
            raise HTTPException(status_code=409, detail="Email already registered")
        user = await user_repository.create(email=email, password=password, name=name)
        token = self._issue_token(user)
        return {"user": self._sanitize(user), "token": token}

    async def login(self, email: str, password: str) -> dict:
        user = user_repository.find_by_email(email)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not pwd_context.verify(password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        token = self._issue_token(user)
        return {"user": self._sanitize(user), "token": token}

    def me(self, user_id: str) -> dict:
        user = user_repository.find_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return self._sanitize(user)

    def _issue_token(self, user: dict) -> str:
        expires_delta = _parse_expires_in(config.auth.jwt_expires_in)
        expire = datetime.now(timezone.utc) + expires_delta
        payload = {
            "userId": user["id"],
            "email": user["email"],
            "exp": expire,
        }
        return jwt.encode(payload, config.auth.jwt_secret, algorithm="HS256")

    def _sanitize(self, user: dict) -> dict:
        return {
            "id": user["id"],
            "email": user["email"],
            "name": user.get("name"),
            "createdAt": user.get("created_at"),
        }


auth_service = AuthService()
