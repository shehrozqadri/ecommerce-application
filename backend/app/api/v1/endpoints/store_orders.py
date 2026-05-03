from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user, get_db
from app.core.config import get_settings
from app.schemas.order import GuestOrderCreate, OrderCreate, OrderPublic

router = APIRouter(prefix="/store/orders", tags=["Store Orders"])


def _to_public(doc: dict) -> OrderPublic:
    return OrderPublic(
        id=str(doc["_id"]),
        user_id=doc.get("user_id"),
        customer_email=doc.get("customer_email"),
        items=doc["items"],
        shipping_address=doc["shipping_address"],
        payment_method=doc["payment_method"],
        status=doc["status"],
        total=doc["total"],
        currency=doc.get("currency", "INR"),
        notes=doc.get("notes"),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


@router.post("", response_model=OrderPublic, status_code=status.HTTP_201_CREATED)
async def place_order(
    payload: OrderCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> OrderPublic:
    settings = get_settings()

    # Fetch user's cart
    cart = await db["carts"].find_one({"user_id": current_user["_id"]})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cart is empty")

    items = cart["items"]
    total = round(sum(item["subtotal"] for item in items), 2)

    now = datetime.now(timezone.utc)
    order_doc = {
        "_id": str(uuid4()),
        "user_id": current_user["_id"],
        "items": items,
        "shipping_address": payload.shipping_address.model_dump(),
        "payment_method": payload.payment_method,
        "status": "pending",
        "total": total,
        "currency": items[0].get("currency", "INR") if items else "INR",
        "notes": payload.notes,
        "created_at": now,
        "updated_at": now,
    }

    await db[settings.collection_orders].insert_one(order_doc)

    # Clear cart after order placed
    await db["carts"].update_one({"user_id": current_user["_id"]}, {"$set": {"items": []}})

    return _to_public(order_doc)


@router.post("/guest", response_model=OrderPublic, status_code=status.HTTP_201_CREATED)
async def place_guest_order(
    payload: GuestOrderCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> OrderPublic:
    settings = get_settings()
    order_items: list[dict] = []

    for item in payload.items:
        product = await db[settings.collection_products].find_one({"_id": item.product_id, "is_active": True})
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product not found: {item.product_id}",
            )

        image_url = None
        if product.get("images"):
            first = product["images"][0]
            image_url = first.get("url") if isinstance(first, dict) else first

        quantity = max(1, int(item.quantity))
        order_items.append(
            {
                "product_id": item.product_id,
                "title": product["title"],
                "price": product["price"],
                "currency": product.get("currency", "INR"),
                "image_url": image_url,
                "size": item.size,
                "color": item.color,
                "quantity": quantity,
                "subtotal": round(quantity * product["price"], 2),
            }
        )

    total = round(sum(item["subtotal"] for item in order_items), 2)
    now = datetime.now(timezone.utc)
    order_doc = {
        "_id": str(uuid4()),
        "user_id": None,
        "customer_email": payload.customer_email,
        "items": order_items,
        "shipping_address": payload.shipping_address.model_dump(),
        "payment_method": payload.payment_method,
        "status": "pending",
        "total": total,
        "currency": order_items[0].get("currency", "INR") if order_items else "INR",
        "notes": payload.notes,
        "created_at": now,
        "updated_at": now,
    }

    await db[settings.collection_orders].insert_one(order_doc)
    return _to_public(order_doc)


@router.get("", response_model=list[OrderPublic])
async def list_orders(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> list[OrderPublic]:
    settings = get_settings()
    cursor = db[settings.collection_orders].find({"user_id": current_user["_id"]}).sort("created_at", -1)
    docs = await cursor.to_list(length=50)
    return [_to_public(d) for d in docs]


@router.get("/{order_id}", response_model=OrderPublic)
async def get_order(
    order_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> OrderPublic:
    settings = get_settings()
    doc = await db[settings.collection_orders].find_one({"_id": order_id, "user_id": current_user["_id"]})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return _to_public(doc)
