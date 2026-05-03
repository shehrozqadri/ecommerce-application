from fastapi import APIRouter, Depends, File, UploadFile

from app.api.deps import get_current_admin
from app.schemas.media import ImportImageRequest, UploadedImageResponse
from app.services.cloudinary_service import (
    upload_image_to_cloudinary,
    upload_image_url_to_cloudinary,
    upload_images_to_cloudinary,
)

router = APIRouter(prefix="/admin/media", tags=["Admin Media"])


@router.post("/upload-image", response_model=UploadedImageResponse)
async def upload_product_image(
    file: UploadFile = File(...),
    _: dict = Depends(get_current_admin),
) -> UploadedImageResponse:
    uploaded = await upload_image_to_cloudinary(file=file)
    return UploadedImageResponse(**uploaded)


@router.post("/upload-images", response_model=list[UploadedImageResponse])
async def upload_product_images(
    files: list[UploadFile] = File(...),
    _: dict = Depends(get_current_admin),
) -> list[UploadedImageResponse]:
    uploaded = await upload_images_to_cloudinary(files=files)
    return [UploadedImageResponse(**item) for item in uploaded]


@router.post("/import-google-drive", response_model=UploadedImageResponse)
async def import_product_image_from_google_drive(
    payload: ImportImageRequest,
    _: dict = Depends(get_current_admin),
) -> UploadedImageResponse:
    uploaded = await upload_image_url_to_cloudinary(url=str(payload.url))
    return UploadedImageResponse(**uploaded)
