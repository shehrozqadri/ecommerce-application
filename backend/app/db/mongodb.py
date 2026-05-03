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
    await database[settings.collection_admins].create_index("email", unique=True)
    await database[settings.collection_admins].create_index([("role", 1), ("is_active", 1)])


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
