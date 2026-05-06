from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional

from app.core.config import get_settings

client: Optional[AsyncIOMotorClient] = None
database: Optional[AsyncIOMotorDatabase] = None


async def connect_to_mongo() -> None:
    global client, database
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri)
    database = client[settings.mongodb_db_name]
    
    # Admin indexes
    await database[settings.collection_admins].create_index("email", unique=True)
    await database[settings.collection_admins].create_index([("role", 1), ("is_active", 1)])
    
    # Product indexes for faster queries and search
    await database[settings.collection_products].create_index("category")
    await database[settings.collection_products].create_index("brand")
    await database[settings.collection_products].create_index("price")
    await database[settings.collection_products].create_index("is_active")
    
    # Text index - skip if already exists (ignore errors)
    try:
        await database[settings.collection_products].create_index([("title", "text"), ("description", "text")])
    except Exception:
        pass  # Index likely already exists
    
    # Order indexes
    await database[settings.collection_orders].create_index("user_id")
    await database[settings.collection_orders].create_index("status")
    await database[settings.collection_orders].create_index("created_at")


async def close_mongo_connection() -> None:
    global client, database
    if client is not None:
        client.close()
    client = None
    database = None


def get_database() -> AsyncIOMotorDatabase:
    if database is None:
        raise RuntimeError("MongoDB is not connected.")
    return database
