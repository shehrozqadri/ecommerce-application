from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_admin, get_db
from app.core.config import get_settings
from app.schemas.order import AdminOrderStatusUpdate, OrderPublic

router = APIRouter(prefix="/admin/orders", tags=["Admin Orders"])


def _order_to_public(doc: dict) -> OrderPublic:
    return OrderPublic(
        id=str(doc["_id"]),
        user_id=doc.get("user_id"),
        customer_email=doc.get("customer_email"),
        items=doc.get("items", []),
        shipping_address=doc["shipping_address"],
        payment_method=doc.get("payment_method", "cod"),
        status=doc.get("status", "pending"),
        total=doc.get("total", 0),
        currency=doc.get("currency", "INR"),
        notes=doc.get("notes"),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


@router.get("", response_model=list[OrderPublic])
async def list_orders(
    q: Optional[str] = Query(default=None, description="Search by order id, email, name, phone"),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    payment_method: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: dict = Depends(get_current_admin),
) -> list[OrderPublic]:
    settings = get_settings()
    query: dict = {}

    if status_filter and status_filter != "all":
        query["status"] = status_filter

    if payment_method and payment_method != "all":
        query["payment_method"] = payment_method

    if q:
        regex_query = {"$regex": q, "$options": "i"}
        query["$or"] = [
            {"_id": regex_query},
            {"customer_email": regex_query},
            {"shipping_address.full_name": regex_query},
            {"shipping_address.phone": regex_query},
        ]

    cursor = (
        db[settings.collection_orders]
        .find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    return [_order_to_public(doc) for doc in docs]


@router.get("/{order_id}", response_model=OrderPublic)
async def get_order(
    order_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: dict = Depends(get_current_admin),
) -> OrderPublic:
    settings = get_settings()
    order = await db[settings.collection_orders].find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return _order_to_public(order)


@router.patch("/{order_id}/status", response_model=OrderPublic)
async def update_order_status(
    order_id: str,
    payload: AdminOrderStatusUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: dict = Depends(get_current_admin),
) -> OrderPublic:
    settings = get_settings()
    existing = await db[settings.collection_orders].find_one({"_id": order_id})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    await db[settings.collection_orders].update_one(
        {"_id": order_id},
        {
            "$set": {
                "status": payload.status,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    updated = await db[settings.collection_orders].find_one({"_id": order_id})
    return _order_to_public(updated)
