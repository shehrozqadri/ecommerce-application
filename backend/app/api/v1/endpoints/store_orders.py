import hashlib
import hmac
import json
from base64 import b64encode
from datetime import datetime, timezone
from typing import Optional
from urllib import error as urlerror
from urllib import request as urlrequest
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user, get_current_user_optional, get_db
from app.core.config import get_settings
from app.schemas.order import (
    GuestOrderCreate,
    OrderCreate,
    OrderPublic,
    RazorpayCreateOrderRequest,
    RazorpayCreateOrderResponse,
    RazorpayVerifyPaymentRequest,
    RazorpayVerifyPaymentResponse,
)

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


def _get_razorpay_credentials() -> tuple[str, str]:
    settings = get_settings()
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Online payments are not configured",
        )
    return settings.razorpay_key_id, settings.razorpay_key_secret


def _create_razorpay_order(amount: int, currency: str, receipt: str, customer_email: str) -> dict:
    key_id, key_secret = _get_razorpay_credentials()
    auth_header = b64encode(f"{key_id}:{key_secret}".encode("utf-8")).decode("utf-8")

    body = json.dumps(
        {
            "amount": amount,
            "currency": currency,
            "receipt": receipt,
            "notes": {
                "source": "ruhab-store",
                "customer_email": customer_email or "",
            },
        }
    ).encode("utf-8")

    req = urlrequest.Request(
        "https://api.razorpay.com/v1/orders",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Basic {auth_header}",
        },
        method="POST",
    )

    try:
        with urlrequest.urlopen(req, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urlerror.HTTPError as exc:
        if exc.code == status.HTTP_401_UNAUTHORIZED:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Razorpay authentication failed") from exc
        if exc.code == status.HTTP_400_BAD_REQUEST:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to create payment order") from exc
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to create payment order") from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to create payment order") from exc


async def _get_user_order_items(db: AsyncIOMotorDatabase, user_id: str) -> tuple[list[dict], float, str]:
    cart = await db["carts"].find_one({"user_id": user_id})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cart is empty")

    items = cart["items"]
    total = round(sum(item["subtotal"] for item in items), 2)
    currency = items[0].get("currency", "INR") if items else "INR"
    return items, total, currency


async def _get_guest_order_items(
    db: AsyncIOMotorDatabase,
    items_payload: list,
) -> tuple[list[dict], float, str]:
    settings = get_settings()
    if not items_payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cart is empty")

    order_items: list[dict] = []

    for item in items_payload:
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
    currency = order_items[0].get("currency", "INR") if order_items else "INR"
    return order_items, total, currency


def _build_order_doc(
    *,
    items: list[dict],
    shipping_address: dict,
    payment_method: str,
    total: float,
    currency: str,
    notes: Optional[str],
    user_id: Optional[str] = None,
    customer_email: Optional[str] = None,
    payment_details: Optional[dict] = None,
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "_id": str(uuid4()),
        "user_id": user_id,
        "customer_email": customer_email,
        "items": items,
        "shipping_address": shipping_address,
        "payment_method": payment_method,
        "payment_details": payment_details,
        "status": "pending",
        "total": total,
        "currency": currency,
        "notes": notes,
        "created_at": now,
        "updated_at": now,
    }


@router.post("", response_model=OrderPublic, status_code=status.HTTP_201_CREATED)
async def place_order(
    payload: OrderCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> OrderPublic:
    settings = get_settings()
    items, total, currency = await _get_user_order_items(db, current_user["_id"])
    order_doc = _build_order_doc(
        user_id=current_user["_id"],
        items=items,
        shipping_address=payload.shipping_address.model_dump(),
        payment_method=payload.payment_method,
        total=total,
        currency=currency,
        notes=payload.notes,
    )

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
    order_items, total, currency = await _get_guest_order_items(db, payload.items)
    order_doc = _build_order_doc(
        customer_email=payload.customer_email,
        items=order_items,
        shipping_address=payload.shipping_address.model_dump(),
        payment_method=payload.payment_method,
        total=total,
        currency=currency,
        notes=payload.notes,
    )

    await db[settings.collection_orders].insert_one(order_doc)
    return _to_public(order_doc)


@router.post("/create-order", response_model=RazorpayCreateOrderResponse)
async def create_razorpay_order(
    payload: RazorpayCreateOrderRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
) -> RazorpayCreateOrderResponse:
    settings = get_settings()

    if current_user:
        items, total, currency = await _get_user_order_items(db, current_user["_id"])
        customer_email = current_user.get("email") or payload.customer_email
        user_id = current_user["_id"]
    else:
        if not payload.customer_email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is required for guest checkout")
        items, total, currency = await _get_guest_order_items(db, payload.items)
        customer_email = payload.customer_email
        user_id = None

    amount = int(round(total * 100))
    if amount < 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Minimum amount is 100 paise")

    receipt = (payload.receipt or f"rcpt_{uuid4().hex[:20]}")[:80]

    created = _create_razorpay_order(
        amount=amount,
        currency=(payload.currency or currency or "INR").upper(),
        receipt=receipt,
        customer_email=customer_email or "",
    )

    now = datetime.now(timezone.utc)
    await db[settings.collection_payment_attempts].insert_one(
        {
            "_id": str(uuid4()),
            "user_id": user_id,
            "customer_email": customer_email,
            "items": items,
            "shipping_address": payload.shipping_address.model_dump(),
            "notes": payload.notes,
            "total": total,
            "amount": amount,
            "currency": created.get("currency", currency or "INR"),
            "receipt": created["receipt"],
            "razorpay_order_id": created["id"],
            "status": "created",
            "created_at": now,
            "updated_at": now,
        }
    )

    return RazorpayCreateOrderResponse(
        order_id=created["id"],
        amount=created["amount"],
        currency=created["currency"],
        receipt=created["receipt"],
    )


@router.post("/verify-payment", response_model=RazorpayVerifyPaymentResponse)
async def verify_razorpay_payment(
    payload: RazorpayVerifyPaymentRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
) -> RazorpayVerifyPaymentResponse:
    settings = get_settings()
    if not settings.razorpay_key_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Online payments are not configured",
        )

    attempt = await db[settings.collection_payment_attempts].find_one({"razorpay_order_id": payload.razorpay_order_id})
    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment order not found")

    if attempt.get("user_id") and current_user and attempt["user_id"] != current_user["_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Payment does not belong to this user")

    expected_signature = hmac.new(
        settings.razorpay_key_secret.encode("utf-8"),
        f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, payload.razorpay_signature):
        await db[settings.collection_payment_attempts].update_one(
            {"_id": attempt["_id"]},
            {"$set": {"status": "signature_mismatch", "updated_at": datetime.now(timezone.utc)}},
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payment signature")

    existing_order_id = attempt.get("order_id")
    if existing_order_id:
        existing_order = await db[settings.collection_orders].find_one({"_id": existing_order_id})
        if existing_order:
            return RazorpayVerifyPaymentResponse(success=True, order=_to_public(existing_order))

    order_doc = _build_order_doc(
        user_id=attempt.get("user_id"),
        customer_email=attempt.get("customer_email"),
        items=attempt["items"],
        shipping_address=attempt["shipping_address"],
        payment_method="prepaid",
        total=attempt["total"],
        currency=attempt.get("currency", "INR"),
        notes=attempt.get("notes"),
        payment_details={
            "provider": "razorpay",
            "razorpay_order_id": payload.razorpay_order_id,
            "razorpay_payment_id": payload.razorpay_payment_id,
            "razorpay_signature": payload.razorpay_signature,
            "verified_at": datetime.now(timezone.utc),
        },
    )

    await db[settings.collection_orders].insert_one(order_doc)

    if attempt.get("user_id"):
        await db["carts"].update_one({"user_id": attempt["user_id"]}, {"$set": {"items": []}})

    await db[settings.collection_payment_attempts].update_one(
        {"_id": attempt["_id"]},
        {
            "$set": {
                "status": "verified",
                "order_id": order_doc["_id"],
                "razorpay_payment_id": payload.razorpay_payment_id,
                "razorpay_signature": payload.razorpay_signature,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    return RazorpayVerifyPaymentResponse(success=True, order=_to_public(order_doc))


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
