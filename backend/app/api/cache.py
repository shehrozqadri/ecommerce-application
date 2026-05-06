"""HTTP caching utilities for API responses."""

from functools import wraps
from fastapi import Response
from typing import Callable, Any


def cache_response(max_age: int = 300):
    """
    Decorator to add Cache-Control headers to API responses.
    
    Args:
        max_age: Cache duration in seconds (default 5 minutes for dynamic content)
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            result = await func(*args, **kwargs)
            
            # If result is a Response object, add headers directly
            if isinstance(result, Response):
                result.headers["Cache-Control"] = f"public, max-age={max_age}"
                return result
            
            # Otherwise return as-is (FastAPI will handle Response wrapping)
            return result
        return wrapper
    return decorator


# Common cache durations
CACHE_PRODUCTS = 300  # 5 minutes - products don't change frequently
CACHE_SEARCH = 60    # 1 minute - search results are more dynamic
CACHE_SUGGEST = 300  # 5 minutes - suggestions are relatively stable
