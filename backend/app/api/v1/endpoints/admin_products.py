from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_admin, get_db
from app.core.config import get_settings
from app.schemas.product import ProductCreate, ProductPublic, ProductUpdate
from app.services.cloudinary_service import delete_images_from_cloudinary

router = APIRouter(prefix="/admin/products", tags=["Admin Products"])


def _normalize_product_images(raw_images: list) -> list[dict]:
    normalized_images: list[dict] = []
    for image in raw_images or []:
        if isinstance(image, str):
            normalized_images.append({"url": image, "public_id": ""})
            continue

        if isinstance(image, dict) and image.get("url"):
            normalized_images.append(
                {
                    "url": image["url"],
                    "public_id": image.get("public_id", ""),
                    "width": image.get("width"),
                    "height": image.get("height"),
                    "format": image.get("format"),
                }
            )
    return normalized_images


def _product_to_public(product_doc: dict) -> ProductPublic:
    return ProductPublic(
        id=str(product_doc["_id"]),
        title=product_doc["title"],
        description=product_doc["description"],
        price=product_doc["price"],
        currency=product_doc["currency"],
        category=product_doc["category"],
        subcategory=product_doc.get("subcategory"),
        brand=product_doc.get("brand"),
        stock=product_doc["stock"],
        images=_normalize_product_images(product_doc.get("images", [])),
        sizes=product_doc.get("sizes", []),
        colors=product_doc.get("colors", []),
        tags=product_doc.get("tags", []),
        is_active=product_doc.get("is_active", True),
        created_at=product_doc["created_at"],
        updated_at=product_doc["updated_at"],
        created_by=product_doc["created_by"],
        updated_by=product_doc["updated_by"],
    )


@router.post("", response_model=ProductPublic, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: dict = Depends(get_current_admin),
) -> ProductPublic:
    settings = get_settings()
    now = datetime.now(timezone.utc)

    payload_data = payload.model_dump()
    payload_data["images"] = _normalize_product_images(payload_data.get("images", []))
    product_doc = {
        "_id": str(uuid4()),
        **payload_data,
        "created_at": now,
        "updated_at": now,
        "created_by": current_admin["_id"],
        "updated_by": current_admin["_id"],
    }

    result = await db[settings.collection_products].insert_one(product_doc)
    product_doc["_id"] = result.inserted_id
    return _product_to_public(product_doc)


@router.get("", response_model=list[ProductPublic])
async def list_products(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=1000, ge=1, le=2000),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: dict = Depends(get_current_admin),
) -> list[ProductPublic]:
    settings = get_settings()

    cursor = db[settings.collection_products].find().sort("created_at", -1).skip(skip).limit(limit)
    products = await cursor.to_list(length=limit)
    return [_product_to_public(product) for product in products]


@router.get("/{product_id}", response_model=ProductPublic)
async def get_product(
    product_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: dict = Depends(get_current_admin),
) -> ProductPublic:
    settings = get_settings()

    product = await db[settings.collection_products].find_one({"_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return _product_to_public(product)


@router.put("/{product_id}", response_model=ProductPublic)
async def update_product(
    product_id: str,
    payload: ProductUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: dict = Depends(get_current_admin),
) -> ProductPublic:
    settings = get_settings()

    existing = await db[settings.collection_products].find_one({"_id": product_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")

    updates = payload.model_dump(exclude_none=True)
    if not updates:
        return _product_to_public(existing)

    if "images" in updates:
        existing_images = _normalize_product_images(existing.get("images", []))
        updated_images = _normalize_product_images(updates.get("images", []))

        existing_public_ids = {image.get("public_id") for image in existing_images if image.get("public_id")}
        updated_public_ids = {image.get("public_id") for image in updated_images if image.get("public_id")}
        removed_public_ids = list(existing_public_ids - updated_public_ids)

        delete_images_from_cloudinary(removed_public_ids)
        updates["images"] = updated_images

    updates["updated_at"] = datetime.now(timezone.utc)
    updates["updated_by"] = current_admin["_id"]

    await db[settings.collection_products].update_one({"_id": product_id}, {"$set": updates})
    updated = await db[settings.collection_products].find_one({"_id": product_id})
    return _product_to_public(updated)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: dict = Depends(get_current_admin),
) -> None:
    settings = get_settings()

    existing = await db[settings.collection_products].find_one({"_id": product_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")

    existing_images = _normalize_product_images(existing.get("images", []))
    existing_public_ids = [image.get("public_id", "") for image in existing_images if image.get("public_id")]
    delete_images_from_cloudinary(existing_public_ids)

    result = await db[settings.collection_products].delete_one({"_id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
