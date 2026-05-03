from pydantic import BaseModel, HttpUrl
from typing import Optional


class UploadedImageResponse(BaseModel):
    url: str
    public_id: str
    width: Optional[int] = None
    height: Optional[int] = None
    format: Optional[str] = None


class ImportImageRequest(BaseModel):
    url: HttpUrl
