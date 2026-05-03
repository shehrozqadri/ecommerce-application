from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ProductImage(BaseModel):
    url: str
    public_id: str = ""
    width: Optional[int] = None
    height: Optional[int] = None
    format: Optional[str] = None


class ProductBase(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(min_length=5, max_length=5000)
    price: float = Field(gt=0)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    category: str = Field(min_length=2, max_length=120)
    subcategory: Optional[str] = Field(default=None, max_length=120)
    brand: Optional[str] = Field(default=None, max_length=120)
    stock: int = Field(ge=0)
    images: list[ProductImage] = Field(default_factory=list)
    sizes: list[str] = Field(default_factory=list)
    colors: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    is_active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=200)
    description: Optional[str] = Field(default=None, min_length=5, max_length=5000)
    price: Optional[float] = Field(default=None, gt=0)
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    category: Optional[str] = Field(default=None, min_length=2, max_length=120)
    subcategory: Optional[str] = Field(default=None, max_length=120)
    brand: Optional[str] = Field(default=None, max_length=120)
    stock: Optional[int] = Field(default=None, ge=0)
    images: Optional[list[ProductImage]] = None
    sizes: Optional[list[str]] = None
    colors: Optional[list[str]] = None
    tags: Optional[list[str]] = None
    is_active: Optional[bool] = None


class ProductPublic(ProductBase):
    id: str
    created_at: datetime
    updated_at: datetime
    created_by: str
    updated_by: str

    model_config = ConfigDict(from_attributes=True)
