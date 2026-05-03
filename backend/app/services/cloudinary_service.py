import cloudinary
import cloudinary.uploader
from fastapi import HTTPException, UploadFile, status
from urllib.parse import parse_qs, urlparse

from app.core.config import get_settings


def _configure_cloudinary() -> None:
    settings = get_settings()

    if settings.cloudinary_url:
        cloudinary.config(cloudinary_url=settings.cloudinary_url, secure=True)
        return

    if not (settings.cloudinary_cloud_name and settings.cloudinary_api_key and settings.cloudinary_api_secret):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cloudinary is not configured. Set CLOUDINARY credentials in env.",
        )

    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )


def _normalize_google_drive_url(url: str) -> str:
    parsed = urlparse(url)
    hostname = (parsed.hostname or "").lower()

    if hostname not in {"drive.google.com", "www.drive.google.com", "docs.google.com", "www.docs.google.com"}:
        return url

    path_parts = [part for part in parsed.path.split("/") if part]
    file_id = ""

    if "file" in path_parts and "d" in path_parts:
        try:
            file_id = path_parts[path_parts.index("d") + 1]
        except (IndexError, ValueError):
            file_id = ""

    if not file_id:
        query = parse_qs(parsed.query)
        file_id = (query.get("id") or [""])[0]

    if not file_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Google Drive link. Use a shareable file link.",
        )

    return f"https://drive.google.com/uc?export=download&id={file_id}"


async def upload_image_to_cloudinary(file: UploadFile, folder: str = "ruhab-studio/products") -> dict:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only image files are allowed")

    _configure_cloudinary()

    try:
        upload_result = cloudinary.uploader.upload(
            file.file,
            folder=folder,
            resource_type="image",
        )
    except Exception as exc:  # noqa: BLE001
        message = str(exc) or "Image upload failed"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message) from exc

    return {
        "url": upload_result.get("secure_url") or upload_result.get("url"),
        "public_id": upload_result.get("public_id", ""),
        "width": upload_result.get("width"),
        "height": upload_result.get("height"),
        "format": upload_result.get("format"),
    }


async def upload_images_to_cloudinary(
    files: list[UploadFile],
    folder: str = "ruhab-studio/products",
) -> list[dict]:
    uploaded: list[dict] = []
    for file in files:
        uploaded.append(await upload_image_to_cloudinary(file=file, folder=folder))
    return uploaded


async def upload_image_url_to_cloudinary(url: str, folder: str = "ruhab-studio/products") -> dict:
    _configure_cloudinary()
    normalized_url = _normalize_google_drive_url(url)

    try:
        upload_result = cloudinary.uploader.upload(
            normalized_url,
            folder=folder,
            resource_type="image",
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to import image from the provided URL",
        ) from exc

    return {
        "url": upload_result.get("secure_url") or upload_result.get("url"),
        "public_id": upload_result.get("public_id", ""),
        "width": upload_result.get("width"),
        "height": upload_result.get("height"),
        "format": upload_result.get("format"),
    }


def delete_images_from_cloudinary(public_ids: list[str]) -> None:
    valid_public_ids = [public_id for public_id in public_ids if public_id]
    if not valid_public_ids:
        return

    _configure_cloudinary()

    for public_id in valid_public_ids:
        cloudinary.uploader.destroy(public_id, resource_type="image")
