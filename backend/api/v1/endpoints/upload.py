"""Media upload endpoint — the single ingress for storefront images.

The frontend (admin product/category forms) uploads each image here and
persists the returned URL into the catalog payloads. **Admin-only** —
anonymous upload floods would land straight on the storage bucket.
"""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from api.deps import get_current_admin_user
from db.models import User
from services.storage import InvalidMediaError, StorageError, media_storage

router = APIRouter(tags=["upload"])


class UploadResponse(BaseModel):
    url: str = Field(description="Public URL of the stored object.")


@router.post(
    "/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload an image to media storage (admin)",
)
async def upload_image(
    file: UploadFile = File(...),
    _admin: User = Depends(get_current_admin_user),
) -> UploadResponse:
    """Store one image file (JPEG/PNG/WebP/GIF/AVIF, ≤ 5 MB) in MinIO."""
    try:
        url = await media_storage.upload_image(file)
    except InvalidMediaError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    except StorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Media storage is temporarily unavailable.",
        ) from exc
    return UploadResponse(url=url)