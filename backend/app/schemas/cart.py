from typing import Optional

from pydantic import BaseModel, Field


class CartItemAdd(BaseModel):
    product_id: str
    quantity: int = Field(ge=1, default=1)
    size: Optional[str] = None
    color: Optional[str] = None


class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=0)


class CartItemPublic(BaseModel):
    product_id: str
    title: str
    price: float
    currency: str
    image_url: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    quantity: int
    subtotal: float


class CartPublic(BaseModel):
    items: list[CartItemPublic]
    total: float
    item_count: int
