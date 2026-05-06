from functools import lru_cache
from typing import List, Optional, Union

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = Field(default="ruhab-studio-api", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    app_debug: bool = Field(default=True, alias="APP_DEBUG")
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    api_prefix: str = Field(default="/api/v1", alias="API_PREFIX")

    cors_origins: List[str] = Field(default_factory=lambda: ["http://localhost:3000"], alias="CORS_ORIGINS")

    jwt_secret_key: str = Field(alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_access_token_expire_minutes: int = Field(default=30, alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES")

    mongodb_uri: str = Field(alias="MONGODB_URI")
    mongodb_db_name: str = Field(alias="MONGODB_DB_NAME")

    media_storage_provider: str = Field(default="cloudinary", alias="MEDIA_STORAGE_PROVIDER")
    cloudinary_cloud_name: Optional[str] = Field(default=None, alias="CLOUDINARY_CLOUD_NAME")
    cloudinary_api_key: Optional[str] = Field(default=None, alias="CLOUDINARY_API_KEY")
    cloudinary_api_secret: Optional[str] = Field(default=None, alias="CLOUDINARY_API_SECRET")
    cloudinary_url: Optional[str] = Field(default=None, alias="CLOUDINARY_URL")

    collection_products: str = Field(default="products", alias="COLLECTION_PRODUCTS")
    collection_users: str = Field(default="users", alias="COLLECTION_USERS")
    collection_orders: str = Field(default="orders", alias="COLLECTION_ORDERS")
    collection_admins: str = Field(default="admins", alias="COLLECTION_ADMINS")
    collection_product_reviews: str = Field(default="product_reviews", alias="COLLECTION_PRODUCT_REVIEWS")
    collection_shipping_addresses: str = Field(default="shipping_addresses", alias="COLLECTION_SHIPPING_ADDRESSES")

    initial_admin_name: str = Field(default="Super Admin", alias="INITIAL_ADMIN_NAME")
    initial_admin_email: str = Field(default="admin@ruhabstudio.com", alias="INITIAL_ADMIN_EMAIL")
    initial_admin_password: str = Field(default="change-this-password", alias="INITIAL_ADMIN_PASSWORD")

    @model_validator(mode="before")
    @classmethod
    def strip_string_values(cls, data):
        if isinstance(data, dict):
            return {k: (v.strip() if isinstance(v, str) else v) for k, v in data.items()}
        return data

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Union[str, list[str]]) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
