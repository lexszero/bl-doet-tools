from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm

from common.db_async import DBSessionDep
from common.errors import UnauthorizedError
from core.auth import RequiredRefreshTokenDep, Token, create_access_token, create_refresh_token
from core.user import authenticate_user

router = APIRouter()

@router.post("/login")
async def login(
    db: DBSessionDep,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> Token:
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise UnauthorizedError("Incorrect username or password")
    return Token(
            access_token=create_access_token(user.name),
            refresh_token=create_refresh_token(user.name),
            )

@router.get("/refresh")
async def refresh(refresh_token: RequiredRefreshTokenDep) -> Token:
    return Token(
            access_token=create_access_token(refresh_token.username),
            refresh_token=create_refresh_token(refresh_token.username),
            )
