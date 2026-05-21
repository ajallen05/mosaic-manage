from fastapi import APIRouter, Depends
from pydantic import BaseModel
from auth.auth_service import auth_service
from middleware.auth import get_current_user

router = APIRouter()


class RegisterBody(BaseModel):
    email: str
    password: str
    name: str


class LoginBody(BaseModel):
    email: str
    password: str


@router.post("/register", status_code=201)
async def register(body: RegisterBody):
    return await auth_service.register(body.email, body.password, body.name)


@router.post("/login")
async def login(body: LoginBody):
    return await auth_service.login(body.email, body.password)


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    return {"success": True}


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return auth_service.me(current_user["id"])
