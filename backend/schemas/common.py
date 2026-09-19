"""Shared schema building blocks."""

from typing import Annotated

from pydantic import StringConstraints

#: An absolute http(s) object URL (MinIO/CDN). The storefront only ever
#: stores absolute URLs — relative paths are rejected at the API boundary.
ImageHttpUrl = Annotated[
    str,
    StringConstraints(pattern=r"^https?://[^\s]+$", min_length=8, max_length=512),
]