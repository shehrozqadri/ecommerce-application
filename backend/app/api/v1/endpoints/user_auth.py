from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user, get_db
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.schemas.user import TokenResponse, UserLogin, UserPublic, UserRegister, UserUpdate

router = APIRouter(prefix="/store/auth", tags=["Store Auth"])


def _user_to_public(doc: dict) -> UserPublic:
    return UserPublic(
        id=str(doc["_id"]),
        name=doc["name"],
        email=doc["email"],
        phone=doc.get("phone"),
        is_active=doc.get("is_active", True),
        created_at=doc["created_at"],
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister, db: AsyncIOMotorDatabase = Depends(get_db)) -> TokenResponse:
    settings = get_settings()
    existing = await db[settings.collection_users].find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    now = datetime.now(timezone.utc)
    user_doc = {
        "_id": str(uuid4()),
        "name": payload.name,
        "email": payload.email,
        "hashed_password": hash_password(payload.password),
        "phone": payload.phone,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    await db[settings.collection_users].insert_one(user_doc)

    access_token, expires_in = create_access_token(subject=user_doc["_id"], role="customer")
    return TokenResponse(
        access_token=access_token,
        expires_in=expires_in,
        user=_user_to_public(user_doc),
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, db: AsyncIOMotorDatabase = Depends(get_db)) -> TokenResponse:
    settings = get_settings()
    user = await db[settings.collection_users].find_one({"email": payload.email})
    if not user or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    access_token, expires_in = create_access_token(subject=user["_id"], role="customer")
    return TokenResponse(
        access_token=access_token,
        expires_in=expires_in,
        user=_user_to_public(user),
    )


@router.get("/me", response_model=UserPublic)
async def get_me(current_user: dict = Depends(get_current_user)) -> UserPublic:
    return _user_to_public(current_user)


@router.put("/me", response_model=UserPublic)
async def update_me(
    payload: UserUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> UserPublic:
    settings = get_settings()
    updates: dict = {"updated_at": datetime.now(timezone.utc)}
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.phone is not None:
        updates["phone"] = payload.phone

    await db[settings.collection_users].update_one({"_id": current_user["_id"]}, {"$set": updates})
    updated = await db[settings.collection_users].find_one({"_id": current_user["_id"]})
    return _user_to_public(updated)
