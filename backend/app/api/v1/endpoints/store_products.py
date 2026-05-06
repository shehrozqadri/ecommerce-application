from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import OperationFailure

from app.api.deps import get_db
from app.core.config import get_settings
from app.schemas.product import ProductPublic
from app.api.cache import CACHE_PRODUCTS, CACHE_SEARCH, CACHE_SUGGEST

router = APIRouter(prefix="/store/products", tags=["Store Products"])


def _normalize_images(raw: list) -> list[dict]:
    out: list[dict] = []
    for img in raw or []:
        if isinstance(img, str):
            out.append({"url": img, "public_id": ""})
        elif isinstance(img, dict) and img.get("url"):
            out.append({
                "url": img["url"],
                "public_id": img.get("public_id", ""),
                "width": img.get("width"),
                "height": img.get("height"),
                "format": img.get("format"),
            })
    return out


def _to_public(doc: dict) -> ProductPublic:
    return ProductPublic(
        id=str(doc["_id"]),
        title=doc["title"],
        description=doc["description"],
        price=doc["price"],
        currency=doc.get("currency", "INR"),
        category=doc["category"],
        subcategory=doc.get("subcategory"),
        brand=doc.get("brand"),
        stock=doc["stock"],
        images=_normalize_images(doc.get("images", [])),
        sizes=doc.get("sizes", []),
        colors=doc.get("colors", []),
        tags=doc.get("tags", []),
        is_active=doc.get("is_active", True),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
        created_by=doc["created_by"],
        updated_by=doc["updated_by"],
    )


def _build_filters(
    category: Optional[str],
    min_price: Optional[float],
    max_price: Optional[float],
    in_stock: Optional[bool],
) -> dict:
    query: dict = {"is_active": True}

    if category:
        query["category"] = {"$regex": f"^{category}$", "$options": "i"}
    if min_price is not None or max_price is not None:
        price_filter: dict = {}
        if min_price is not None:
            price_filter["$gte"] = min_price
        if max_price is not None:
            price_filter["$lte"] = max_price
        query["price"] = price_filter
    if in_stock is True:
        query["stock"] = {"$gt": 0}
    elif in_stock is False:
        query["stock"] = 0

    return query


def _query_variants(term: str) -> list[str]:
    q = term.strip()
    if not q:
        return []

    variants = {q}
    if q.endswith("s") and len(q) > 3:
        variants.add(q[:-1])
    elif len(q) > 2:
        variants.add(f"{q}s")

    return [v for v in variants if v]


@router.get("", response_model=list[ProductPublic])
async def list_products(
    q: Optional[str] = Query(default=None, description="Search by title/description"),
    category: Optional[str] = Query(default=None),
    min_price: Optional[float] = Query(default=None, ge=0),
    max_price: Optional[float] = Query(default=None, ge=0),
    in_stock: Optional[bool] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=24, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[ProductPublic]:
    settings = get_settings()
    filters = _build_filters(category, min_price, max_price, in_stock)
    products = db[settings.collection_products]

    docs: list[dict]
    if q:
        search_query = q.strip()
        try:
            pipeline = [
                {
                    "$search": {
                        "index": "default",
                        "compound": {
                            "should": [
                                {
                                    "autocomplete": {
                                        "query": search_query,
                                        "path": "title",
                                        "fuzzy": {"maxEdits": 1},
                                    }
                                },
                                {
                                    "autocomplete": {
                                        "query": search_query,
                                        "path": "category",
                                        "fuzzy": {"maxEdits": 1},
                                    }
                                },
                                {
                                    "autocomplete": {
                                        "query": search_query,
                                        "path": "tags",
                                        "fuzzy": {"maxEdits": 1},
                                    }
                                },
                                {
                                    "autocomplete": {
                                        "query": search_query,
                                        "path": "brand",
                                        "fuzzy": {"maxEdits": 1},
                                    }
                                },
                                {
                                    "autocomplete": {
                                        "query": search_query,
                                        "path": "subcategory",
                                        "fuzzy": {"maxEdits": 1},
                                    }
                                },
                                {
                                    "text": {
                                        "query": search_query,
                                        "path": ["description"],
                                        "fuzzy": {"maxEdits": 1},
                                    }
                                },
                            ],
                            "minimumShouldMatch": 1,
                        },
                    }
                },
                {"$match": filters},
                {"$addFields": {"_score": {"$meta": "searchScore"}}},
                {"$sort": {"_score": -1, "created_at": -1}},
                {"$skip": skip},
                {"$limit": limit},
            ]
            docs = await products.aggregate(pipeline).to_list(length=limit)
        except OperationFailure:
            docs = []

        if not docs:
            variants = _query_variants(search_query)
            regex_conditions = []
            for term in variants:
                regex_conditions.extend([
                    {"title": {"$regex": term, "$options": "i"}},
                    {"description": {"$regex": term, "$options": "i"}},
                    {"tags": {"$regex": term, "$options": "i"}},
                    {"category": {"$regex": term, "$options": "i"}},
                    {"subcategory": {"$regex": term, "$options": "i"}},
                    {"brand": {"$regex": term, "$options": "i"}},
                ])

            fallback_query = {**filters, "$or": regex_conditions}
            docs = await products.find(fallback_query).skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)
    else:
        docs = await products.find(filters).skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)

    result = [_to_public(d) for d in docs]
    # Note: Response object with cache headers is set in middleware/after response if needed
    # Client-side caching is handled by Vercel/CDN
    return result


@router.get("/autocomplete", response_model=list[str])
@router.get("/suggest", response_model=list[str])
async def suggest_products(
    q: str = Query(..., min_length=1, max_length=80),
    limit: int = Query(default=8, ge=1, le=20),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[str]:
    settings = get_settings()
    term = q.strip()
    if not term:
        return []

    products = db[settings.collection_products]

    try:
        pipeline = [
            {
                "$search": {
                    "index": "default",
                    "compound": {
                        "should": [
                            {"autocomplete": {"query": term, "path": "title", "fuzzy": {"maxEdits": 1}}},
                            {"autocomplete": {"query": term, "path": "category", "fuzzy": {"maxEdits": 1}}},
                            {"autocomplete": {"query": term, "path": "tags", "fuzzy": {"maxEdits": 1}}},
                            {"autocomplete": {"query": term, "path": "brand", "fuzzy": {"maxEdits": 1}}},
                            {"autocomplete": {"query": term, "path": "subcategory", "fuzzy": {"maxEdits": 1}}},
                        ],
                        "minimumShouldMatch": 1,
                    },
                }
            },
            {"$match": {"is_active": True}},
            {"$project": {"title": 1, "category": 1, "subcategory": 1, "brand": 1, "tags": 1}},
            {"$limit": limit * 3},
        ]
        docs = await products.aggregate(pipeline).to_list(length=limit * 3)
    except OperationFailure:
        docs = []

    if not docs:
        variants = _query_variants(term)
        or_conditions = []
        for item in variants:
            or_conditions.extend([
                {"title": {"$regex": item, "$options": "i"}},
                {"tags": {"$regex": item, "$options": "i"}},
                {"category": {"$regex": item, "$options": "i"}},
                {"subcategory": {"$regex": item, "$options": "i"}},
                {"brand": {"$regex": item, "$options": "i"}},
            ])

        docs = await products.find(
            {"is_active": True, "$or": or_conditions},
            {"title": 1, "category": 1, "subcategory": 1, "brand": 1, "tags": 1},
        ).limit(limit * 3).to_list(length=limit * 3)

    seen: set[str] = set()
    suggestions: list[str] = []

    def add_candidate(value: Optional[str]) -> None:
        if not value:
            return
        text = str(value).strip()
        if not text:
            return
        if term.lower() not in text.lower():
            return
        key = text.lower()
        if key in seen:
            return
        seen.add(key)
        suggestions.append(text)

    for doc in docs:
        add_candidate(doc.get("title"))
        add_candidate(doc.get("brand"))
        add_candidate(doc.get("category"))
        add_candidate(doc.get("subcategory"))
        for tag in doc.get("tags") or []:
            add_candidate(tag)

        if len(suggestions) >= limit:
            break

    return suggestions


@router.get("/{product_id}", response_model=ProductPublic)
async def get_product(product_id: str, db: AsyncIOMotorDatabase = Depends(get_db)) -> ProductPublic:
    settings = get_settings()
    doc = await db[settings.collection_products].find_one({"_id": product_id, "is_active": True})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return _to_public(doc)
