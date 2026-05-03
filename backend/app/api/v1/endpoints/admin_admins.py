from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_db, require_super_admin
from app.core.config import get_settings
from app.core.security import hash_password
from app.schemas.admin import AdminCreate, AdminPublic, AdminUpdate

router = APIRouter(prefix="/admin/admins", tags=["Admin Management"])


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


async def _get_admin_or_404(db: AsyncIOMotorDatabase, admin_id: str) -> dict:
    settings = get_settings()
    admin = await db[settings.collection_admins].find_one({"_id": admin_id})
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")
    return admin


async def _ensure_email_available(
    db: AsyncIOMotorDatabase,
    email: str,
    excluded_admin_id: Optional[str] = None,
) -> None:
    settings = get_settings()
    existing = await db[settings.collection_admins].find_one({"email": email})
    if existing and existing.get("_id") != excluded_admin_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Admin email already exists")


async def _ensure_not_last_active_super_admin(
    db: AsyncIOMotorDatabase,
    target_admin: dict,
    next_role: Optional[str] = None,
    next_is_active: Optional[bool] = None,
) -> None:
    settings = get_settings()
    current_role = target_admin.get("role", "admin")
    current_is_active = target_admin.get("is_active", True)
    final_role = next_role if next_role is not None else current_role
    final_is_active = next_is_active if next_is_active is not None else current_is_active

    if current_role != "super_admin":
        return

    if final_role == "super_admin" and final_is_active:
        return

    remaining_super_admins = await db[settings.collection_admins].count_documents(
        {
            "role": "super_admin",
            "is_active": True,
            "_id": {"$ne": target_admin["_id"]},
        }
    )
    if remaining_super_admins == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one active super admin must remain",
        )


@router.get("", response_model=list[AdminPublic])
async def list_admins(
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: dict = Depends(require_super_admin),
) -> list[AdminPublic]:
    settings = get_settings()
    admins = await db[settings.collection_admins].find().sort("created_at", -1).to_list(length=None)
    return [_admin_to_public(admin) for admin in admins]


@router.get("/{admin_id}", response_model=AdminPublic)
async def get_admin(
    admin_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: dict = Depends(require_super_admin),
) -> AdminPublic:
    admin = await _get_admin_or_404(db, admin_id)
    return _admin_to_public(admin)


@router.post("", response_model=AdminPublic, status_code=status.HTTP_201_CREATED)
async def create_admin(
    payload: AdminCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_super_admin: dict = Depends(require_super_admin),
) -> AdminPublic:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    normalized_email = payload.email.lower()

    await _ensure_email_available(db, normalized_email)

    admin_doc = {
        "_id": str(uuid4()),
        "name": payload.name,
        "email": normalized_email,
        "hashed_password": hash_password(payload.password),
        "role": payload.role,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "created_by": current_super_admin["_id"],
        "updated_by": current_super_admin["_id"],
    }

    await db[settings.collection_admins].insert_one(admin_doc)
    return _admin_to_public(admin_doc)


@router.put("/{admin_id}", response_model=AdminPublic)
async def update_admin(
    admin_id: str,
    payload: AdminUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_super_admin: dict = Depends(require_super_admin),
) -> AdminPublic:
    settings = get_settings()
    existing_admin = await _get_admin_or_404(db, admin_id)
    updates = payload.model_dump(exclude_none=True)

    if not updates:
        return _admin_to_public(existing_admin)

    normalized_email = updates.get("email")
    if normalized_email is not None:
        normalized_email = normalized_email.lower()
        await _ensure_email_available(db, normalized_email, excluded_admin_id=admin_id)
        updates["email"] = normalized_email

    if "password" in updates:
        updates["hashed_password"] = hash_password(updates.pop("password"))

    next_role = updates.get("role")
    next_is_active = updates.get("is_active")
    await _ensure_not_last_active_super_admin(db, existing_admin, next_role=next_role, next_is_active=next_is_active)

    if existing_admin["_id"] == current_super_admin["_id"]:
        if updates.get("role") == "admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Super admin cannot demote themselves",
            )
        if updates.get("is_active") is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Super admin cannot deactivate themselves",
            )

    updates["updated_at"] = datetime.now(timezone.utc)
    updates["updated_by"] = current_super_admin["_id"]

    await db[settings.collection_admins].update_one({"_id": admin_id}, {"$set": updates})
    updated_admin = await _get_admin_or_404(db, admin_id)
    return _admin_to_public(updated_admin)


@router.patch("/{admin_id}/deactivate", response_model=AdminPublic)
async def deactivate_admin(
    admin_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_super_admin: dict = Depends(require_super_admin),
) -> AdminPublic:
    settings = get_settings()
    existing_admin = await _get_admin_or_404(db, admin_id)

    if existing_admin["_id"] == current_super_admin["_id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin cannot deactivate themselves",
        )

    await _ensure_not_last_active_super_admin(db, existing_admin, next_is_active=False)

    await db[settings.collection_admins].update_one(
        {"_id": admin_id},
        {
            "$set": {
                "is_active": False,
                "updated_at": datetime.now(timezone.utc),
                "updated_by": current_super_admin["_id"],
            }
        },
    )
    updated_admin = await _get_admin_or_404(db, admin_id)
    return _admin_to_public(updated_admin)


@router.delete("/{admin_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin(
    admin_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_super_admin: dict = Depends(require_super_admin),
) -> None:
    settings = get_settings()
    existing_admin = await _get_admin_or_404(db, admin_id)

    if existing_admin["_id"] == current_super_admin["_id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin cannot delete themselves",
        )

    await _ensure_not_last_active_super_admin(db, existing_admin, next_is_active=False)

    result = await db[settings.collection_admins].delete_one({"_id": admin_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")
