from fastapi import APIRouter

from app.api.v1.endpoints.admin_admins import router as admin_admins_router
from app.api.v1.endpoints.admin_auth import router as admin_auth_router
from app.api.v1.endpoints.admin_media import router as admin_media_router
from app.api.v1.endpoints.admin_orders import router as admin_orders_router
from app.api.v1.endpoints.admin_products import router as admin_products_router
from app.api.v1.endpoints.user_auth import router as user_auth_router
from app.api.v1.endpoints.store_products import router as store_products_router
from app.api.v1.endpoints.store_cart import router as store_cart_router
from app.api.v1.endpoints.store_orders import router as store_orders_router

api_router = APIRouter()
api_router.include_router(admin_admins_router)
api_router.include_router(admin_auth_router)
api_router.include_router(admin_media_router)
api_router.include_router(admin_orders_router)
api_router.include_router(admin_products_router)
api_router.include_router(user_auth_router)
api_router.include_router(store_products_router)
api_router.include_router(store_cart_router)
api_router.include_router(store_orders_router)
