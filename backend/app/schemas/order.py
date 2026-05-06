from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ShippingAddress(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=6, max_length=20)
    address_line1: str = Field(min_length=5, max_length=200)
    address_line2: Optional[str] = Field(default=None, max_length=200)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    pincode: str = Field(min_length=4, max_length=12)
    country: str = Field(default="India", max_length=80)


class OrderCreate(BaseModel):
    shipping_address: ShippingAddress
    payment_method: str = Field(default="cod", pattern="^(cod|prepaid)$")
    notes: Optional[str] = Field(default=None, max_length=500)


OrderStatus = Literal["pending", "processing", "shipped", "delivered", "cancelled"]


class AdminOrderStatusUpdate(BaseModel):
    status: OrderStatus


class GuestOrderItemCreate(BaseModel):
    product_id: str
    quantity: int = Field(ge=1, default=1)
    size: Optional[str] = None
    color: Optional[str] = None


class GuestOrderCreate(BaseModel):
    customer_email: EmailStr
    items: list[GuestOrderItemCreate] = Field(min_length=1)
    shipping_address: ShippingAddress
    payment_method: str = Field(default="cod", pattern="^(cod|prepaid)$")
    notes: Optional[str] = Field(default=None, max_length=500)


class RazorpayCreateOrderRequest(BaseModel):
    shipping_address: ShippingAddress
    customer_email: Optional[EmailStr] = None
    items: list[GuestOrderItemCreate] = Field(default_factory=list)
    notes: Optional[str] = Field(default=None, max_length=500)
    amount: Optional[int] = Field(default=None, ge=100)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    receipt: Optional[str] = Field(default=None, max_length=80)


class RazorpayCreateOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    receipt: str


class RazorpayVerifyPaymentRequest(BaseModel):
    razorpay_payment_id: str = Field(min_length=1)
    razorpay_order_id: str = Field(min_length=1)
    razorpay_signature: str = Field(min_length=1)


class RazorpayVerifyPaymentResponse(BaseModel):
    success: bool
    order: "OrderPublic"


class OrderItemPublic(BaseModel):
    product_id: str
    title: str
    price: float
    currency: str
    image_url: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    quantity: int
    subtotal: float


class OrderPublic(BaseModel):
    id: str
    user_id: Optional[str] = None
    customer_email: Optional[str] = None
    items: list[OrderItemPublic]
    shipping_address: ShippingAddress
    payment_method: str
    status: str
    total: float
    currency: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


RazorpayVerifyPaymentResponse.model_rebuild()
