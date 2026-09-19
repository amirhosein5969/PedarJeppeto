"""Async MinIO (S3-compatible) object storage service.

Design notes
------------
- Built on **aioboto3** so the request path stays fully async (binding
  convention #1 in AGENT.md).
- Every operation opens its own client through ``async with`` (the
  documented aioboto3 pattern — the client manages its own connection
  lifecycle and must be closed when the operation completes).
- Objects are written under a per-domain folder (``products/``) with a
  **UUID4 filename** so two uploads can never collide, regardless of the
  original client-side filename (which is never trusted).
- Only a strict content-type allowlist is accepted, with the extension
  derived from the *server-side* type — the client's extension is ignored.
"""

import json
import uuid

import aioboto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import UploadFile

from core.config import get_settings

#: Hard cap for a single upload (bytes) — matches the storefront's 5 MB limit.
MAX_UPLOAD_BYTES = 5 * 1024 * 1024

#: Allowed content types → stored extension (server-side truth).
_ALLOWED_IMAGE_TYPES: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif",
}


class StorageError(Exception):
    """Unexpected storage failure (MinIO unreachable, auth, network…).

    Endpoints map this to HTTP 502 — a client retry may succeed.
    """


class InvalidMediaError(StorageError):
    """The uploaded file itself is unacceptable (type/size/empty).

    Endpoints map this to HTTP 400.
    """


class MediaStorage:
    """Async uploads of storefront media to MinIO."""

    def __init__(self) -> None:
        self._settings = get_settings()

    # -- internals ---------------------------------------------------------
    def _s3(self):
        """Open a new S3 client bound to the configured MinIO endpoint."""
        session = aioboto3.Session()
        return session.client(
            "s3",
            endpoint_url=self._settings.s3_endpoint_url,
            aws_access_key_id=self._settings.s3_access_key_id,
            aws_secret_access_key=self._settings.s3_secret_access_key,
            region_name=self._settings.s3_region,
        )

    def _public_base_url(self) -> str:
        """Base URL under which uploaded objects are publicly reachable.

        Built from ``MEDIA_PUBLIC_URL`` (the host the *browser* can
        resolve), **not** from ``S3_ENDPOINT_URL`` (the internal host the
        backend uses). In Docker that means the client receives
        ``http://localhost:9000/{bucket}/...`` instead of the unresolvable
        ``http://minio:9000/{bucket}/...``.
        """
        host = self._settings.media_public_url.strip() or self._settings.s3_endpoint_url
        return f"{host.rstrip('/')}/{self._settings.s3_bucket}"

    # -- public API ----------------------------------------------------------
    async def ensure_bucket(self) -> None:
        """Create the media bucket if it does not exist yet.

        Safe to call concurrently: the race between two ``create_bucket``
        calls is tolerated (MinIO returns ``BucketAlreadyOwnedByYou`` /
        ``BucketAlreadyExists``, which we swallow).

        A freshly created bucket also gets a **public-read** policy: the
        storefront hotlinks media URLs directly (see AGENT.md §3), so
        objects must be anonymously readable.
        """
        bucket = self._settings.s3_bucket
        policy = json.dumps(
            {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Principal": {"AWS": ["*"]},
                        "Action": ["s3:GetObject"],
                        "Resource": [f"arn:aws:s3:::{bucket}/*"],
                    }
                ],
            }
        )
        try:
            async with self._s3() as s3:
                try:
                    await s3.create_bucket(Bucket=bucket)
                except ClientError as exc:
                    code = exc.response.get("Error", {}).get("Code", "")
                    if code not in {"BucketAlreadyOwnedByYou", "BucketAlreadyExists"}:
                        raise StorageError(
                            f"Could not ensure bucket {bucket!r}: {exc}"
                        ) from exc
                    return  # already exists — leave its policy untouched
                await s3.put_bucket_policy(Bucket=bucket, Policy=policy)
        except StorageError:
            raise
        except (ClientError, BotoCoreError, OSError) as exc:
            raise StorageError(f"Could not ensure bucket {bucket!r}: {exc}") from exc

    async def upload_image(self, file: UploadFile) -> str:
        """Validate and store an uploaded image; return its public URL.

        Raises
        ------
        InvalidMediaError
            Unsupported content type, empty body, or size > 5 MB.
        StorageError
            MinIO failure (endpoint down, credentials rejected, …).
        """
        content_type = (file.content_type or "").lower().split(";")[0].strip()
        extension = _ALLOWED_IMAGE_TYPES.get(content_type)
        if extension is None:
            raise InvalidMediaError(
                "Unsupported image type. Allowed: JPEG, PNG, WebP, GIF, AVIF."
            )

        data = await file.read()
        if not data:
            raise InvalidMediaError("The uploaded file is empty.")
        if len(data) > MAX_UPLOAD_BYTES:
            raise InvalidMediaError(
                f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit."
            )

        key = f"products/{uuid.uuid4().hex}{extension}"
        try:
            await self.ensure_bucket()
            async with self._s3() as s3:
                await s3.put_object(
                    Bucket=self._settings.s3_bucket,
                    Key=key,
                    Body=data,
                    ContentType=content_type,
                )
        except StorageError:
            raise
        except (ClientError, BotoCoreError, OSError) as exc:
            raise StorageError(f"Upload to object storage failed: {exc}") from exc

        return f"{self._public_base_url()}/{key}"


#: Process-wide singleton for the API layer.
media_storage = MediaStorage()