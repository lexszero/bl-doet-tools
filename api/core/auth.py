from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal, Optional

import jwt
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

from common.settings import settings
from common.db_async import DBSessionDep
from common.errors import InvalidRequestError, InvalidTokenError, PermissionDeniedError
from core.permission import ClientPermissions, Permission
from core.user import User, get_user

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7

class Token(BaseModel):
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: Literal['bearer'] = 'bearer'
    expires: int = ACCESS_TOKEN_EXPIRE_MINUTES*60

class TokenData(BaseModel):
    username: str
    scopes: list[str] = []

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="_user/token", auto_error=False)

def create_jwt(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)
    return encoded_jwt.decode('utf-8')

def create_access_token(sub: str):
    return create_jwt(
            data={
                'type': 'access',
                'sub': sub
                },
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            )

def create_refresh_token(sub: str):
    return create_jwt(
            data={
                'type': 'refresh',
                'sub': sub
                },
            expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
            )

def get_valid_token(
        token_type: Literal['access'] | Literal['refresh'] = 'access',
        required: bool = True
        ):
    def _get_token(token: Annotated[Optional[str], Depends(oauth2_scheme)]):
        if not token:
            if required:
                raise InvalidTokenError("Access token required")
            else:
                return None
        try:
            payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
            if payload.get('type') != token_type:
                raise InvalidTokenError(f"Expected access token, got {type} instead")
            username = payload.get("sub")
            if username is None:
                raise InvalidTokenError("Access token is missing sub")
            return TokenData(username=username)
        except jwt.ExpiredSignatureError:
            raise InvalidTokenError("Token signature is expired")
        except jwt.InvalidTokenError:
            raise InvalidTokenError("Invalid access token")
    return _get_token

RequiredAccessTokenDep = Annotated[TokenData, Depends(get_valid_token('access', True))]
OptionalAccessTokenDep = Annotated[Optional[TokenData], Depends(get_valid_token('access', False))]
RequiredRefreshTokenDep = Annotated[TokenData, Depends(get_valid_token('refresh', True))]

def get_current_user(required: bool):
    async def _get_user(db: DBSessionDep, token: OptionalAccessTokenDep):
        if not token:
            if required:
                raise InvalidTokenError("Access token required")
            else:
                return None
        user = await get_user(db, name=token.username)
        if user is None:
            raise PermissionDeniedError("User not found")
        if not user.active:
            raise InvalidRequestError("Inactive user")
        return user
    return _get_user

RequiredUserDep = Annotated[User, Depends(get_current_user(True))]
OptionalUserDep = Annotated[Optional[User], Depends(get_current_user(False))]

async def get_current_client_permissions(user: OptionalUserDep):
    if user:
        return user.permissions
    else:
        return frozenset[Permission]()

ClientPermissionsDep = Annotated[ClientPermissions, Depends(get_current_client_permissions)]
