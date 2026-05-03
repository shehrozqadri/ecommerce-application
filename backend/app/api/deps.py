from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional

from app.core.config import get_settings
from app.db.mongodb import get_database

bearer_scheme = HTTPBearer(auto_error=True)
bearer_scheme_optional = HTTPBearer(auto_error=False)


def get_db() -> AsyncIOMotorDatabase:
    return get_database()


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    settings = get_settings()
    token = credentials.credentials

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )

    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        admin_id = payload.get("sub")
        token_type = payload.get("type")
        if not admin_id or token_type != "access":
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    admin = await db[settings.collection_admins].find_one({"_id": admin_id, "is_active": True})
    if not admin:
        raise credentials_exception

    return admin


async def require_super_admin(current_admin: dict = Depends(get_current_admin)) -> dict:
    if current_admin.get("role") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required",
        )

    return current_admin


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    settings = get_settings()
    token = credentials.credentials

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )

    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
        token_type = payload.get("type")
        role = payload.get("role")
        if not user_id or token_type != "access" or role != "customer":
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    user = await db[settings.collection_users].find_one({"_id": user_id, "is_active": True})
    if not user:
        raise credentials_exception

    return user


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme_optional),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Optional[dict]:
    """Returns user if valid token present, None otherwise."""
    if not credentials:
        return None
    settings = get_settings()
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
        role = payload.get("role")
        if not user_id or role != "customer":
            return None
    except JWTError:
        return None
    return await db[settings.collection_users].find_one({"_id": user_id, "is_active": True})
