from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user, get_db
from app.core.config import get_settings
from app.schemas.cart import CartItemAdd, CartItemUpdate, CartItemPublic, CartPublic

router = APIRouter(prefix="/store/cart", tags=["Store Cart"])


async def _get_cart_doc(user_id: str, db: AsyncIOMotorDatabase, settings) -> dict:
    cart = await db["carts"].find_one({"user_id": user_id})
    if not cart:
        cart = {"user_id": user_id, "items": []}
    return cart


def _build_cart_public(cart: dict) -> CartPublic:
    items = [CartItemPublic(**item) for item in cart.get("items", [])]
    total = sum(i.subtotal for i in items)
    return CartPublic(items=items, total=round(total, 2), item_count=sum(i.quantity for i in items))


@router.get("", response_model=CartPublic)
async def get_cart(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> CartPublic:
    settings = get_settings()
    cart = await _get_cart_doc(current_user["_id"], db, settings)
    return _build_cart_public(cart)


@router.post("", response_model=CartPublic, status_code=status.HTTP_200_OK)
async def add_to_cart(
    payload: CartItemAdd,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> CartPublic:
    settings = get_settings()

    product = await db[settings.collection_products].find_one({"_id": payload.product_id, "is_active": True})
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if product["stock"] < payload.quantity:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient stock")

    image_url = None
    images = product.get("images", [])
    if images:
        first = images[0]
        image_url = first.get("url") if isinstance(first, dict) else first

    cart = await _get_cart_doc(current_user["_id"], db, settings)
    items: list[dict] = cart.get("items", [])

    # Find existing item (same product + size + color)
    existing_idx = next(
        (i for i, item in enumerate(items)
         if item["product_id"] == payload.product_id
         and item.get("size") == payload.size
         and item.get("color") == payload.color),
        None,
    )

    if existing_idx is not None:
        items[existing_idx]["quantity"] += payload.quantity
        items[existing_idx]["subtotal"] = round(items[existing_idx]["quantity"] * product["price"], 2)
    else:
        items.append({
            "product_id": payload.product_id,
            "title": product["title"],
            "price": product["price"],
            "currency": product.get("currency", "INR"),
            "image_url": image_url,
            "size": payload.size,
            "color": payload.color,
            "quantity": payload.quantity,
            "subtotal": round(payload.quantity * product["price"], 2),
        })

    await db["carts"].update_one(
        {"user_id": current_user["_id"]},
        {"$set": {"items": items}},
        upsert=True,
    )
    cart["items"] = items
    return _build_cart_public(cart)


@router.patch("/{product_id}", response_model=CartPublic)
async def update_cart_item(
    product_id: str,
    payload: CartItemUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> CartPublic:
    settings = get_settings()
    cart = await _get_cart_doc(current_user["_id"], db, settings)
    items: list[dict] = cart.get("items", [])

    if payload.quantity == 0:
        items = [i for i in items if i["product_id"] != product_id]
    else:
        for item in items:
            if item["product_id"] == product_id:
                item["quantity"] = payload.quantity
                item["subtotal"] = round(payload.quantity * item["price"], 2)
                break

    await db["carts"].update_one(
        {"user_id": current_user["_id"]},
        {"$set": {"items": items}},
        upsert=True,
    )
    cart["items"] = items
    return _build_cart_public(cart)


@router.delete("/{product_id}", response_model=CartPublic)
async def remove_from_cart(
    product_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> CartPublic:
    settings = get_settings()
    cart = await _get_cart_doc(current_user["_id"], db, settings)
    items = [i for i in cart.get("items", []) if i["product_id"] != product_id]
    await db["carts"].update_one(
        {"user_id": current_user["_id"]},
        {"$set": {"items": items}},
        upsert=True,
    )
    cart["items"] = items
    return _build_cart_public(cart)


@router.delete("", response_model=CartPublic)
async def clear_cart(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> CartPublic:
    await db["carts"].update_one(
        {"user_id": current_user["_id"]},
        {"$set": {"items": []}},
        upsert=True,
    )
    return CartPublic(items=[], total=0.0, item_count=0)
