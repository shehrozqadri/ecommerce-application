from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_admin, get_db
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.schemas.admin import AdminLoginRequest, AdminPublic, TokenResponse

router = APIRouter(prefix="/admin/auth", tags=["Admin Auth"])


def _admin_to_public(admin_doc: dict) -> AdminPublic:
    return AdminPublic(
        id=admin_doc["_id"],
        name=admin_doc["name"],
        email=admin_doc["email"],
        role=admin_doc.get("role", "admin"),
        is_active=admin_doc.get("is_active", True),
        created_at=admin_doc["created_at"],
        updated_at=admin_doc["updated_at"],
    )


@router.post("/bootstrap", response_model=AdminPublic, status_code=status.HTTP_201_CREATED)
async def bootstrap_initial_admin(db: AsyncIOMotorDatabase = Depends(get_db)) -> AdminPublic:
    settings = get_settings()

    existing_count = await db[settings.collection_admins].count_documents({})
    if existing_count > 0:
        raise HTTPException(status_code=400, detail="Bootstrap is disabled: admin already exists")

    if not settings.initial_admin_email or not settings.initial_admin_password:
        raise HTTPException(status_code=500, detail="Initial admin credentials are missing")

    now = datetime.now(timezone.utc)
    admin_doc = {
        "_id": str(uuid4()),
        "name": settings.initial_admin_name,
        "email": settings.initial_admin_email.lower(),
        "hashed_password": hash_password(settings.initial_admin_password),
        "role": "super_admin",
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }

    await db[settings.collection_admins].insert_one(admin_doc)
    return _admin_to_public(admin_doc)


@router.post("/login", response_model=TokenResponse)
async def admin_login(payload: AdminLoginRequest, db: AsyncIOMotorDatabase = Depends(get_db)) -> TokenResponse:
    settings = get_settings()

    admin = await db[settings.collection_admins].find_one({"email": payload.email.lower(), "is_active": True})
    if not admin or not verify_password(payload.password, admin["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token, expires_in = create_access_token(subject=admin["_id"], role=admin.get("role", "admin"))
    return TokenResponse(access_token=token, expires_in=expires_in)


@router.get("/me", response_model=AdminPublic)
async def get_me(current_admin: dict = Depends(get_current_admin)) -> AdminPublic:
    return _admin_to_public(current_admin)
