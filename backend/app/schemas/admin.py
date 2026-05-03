from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


AdminRole = Literal["admin", "super_admin"]


class AdminCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: AdminRole = "admin"


class AdminUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    role: Optional[AdminRole] = None
    is_active: Optional[bool] = None


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminPublic(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: AdminRole = "admin"
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
