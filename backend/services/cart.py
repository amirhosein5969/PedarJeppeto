"""Redis-backed ephemeral shopping cart (Phase 4).

Design
------
- Key: ``cart:{session_id}`` where ``session_id`` is a client-provided
  string/UUID. The charset is strictly validated (``[A-Za-z0-9_-]{8,64}``)
  because it is interpolated into the Redis key — anything else is rejected.
- Value: a small JSON document ``{"v": 1, "items": [{product_id, quantity,
  care_oil_added}, ...]}``. The cart stores **identifiers and flags only** —
  prices are always re-resolved from PostgreSQL (GET /cart and checkout), so
  a stale cart can never lock in a stale price.
- Mutations (add/remove) run inside a Redis ``WATCH``/``MULTI`` transaction
  with retry, so concurrent add/remove calls from the same session cannot
  lose updates (last-write-wins is avoided).
- A 14-day TTL is (re)set on every write; abandoned carts expire.
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from typing import Callable

from redis.asyncio import Redis
from redis.exceptions import WatchError

from core.cache import get_redis

CART_KEY_PREFIX = "cart:"
# Carts expire after 14 days (TTL refreshed on every write).
CART_TTL_SECONDS = 14 * 24 * 60 * 60
# Frontend parity: CartContext MAX_QTY.
MAX_QTY = 20
_MAX_RETRIES = 3

# Client-supplied, interpolated into a Redis key — allow only a safe charset.
_SESSION_ID_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


class CartError(Exception):
    """Base error for cart operations (endpoints map these to HTTP 400)."""


class InvalidSessionError(CartError):
    """The session_id failed validation."""


class CartWriteConflictError(CartError):
    """Concurrent mutations could not be reconciled after retries."""


@dataclass(frozen=True)
class CartLine:
    """One line in a cart: what (product), how much, the oil add-on, and the
    customer's variant selections (Phase 7 wood type + color)."""

    product_id: int
    quantity: int
    care_oil_added: bool
    wood_type: str | None = None
    color: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, raw: dict) -> "CartLine":
        # ``.get`` keeps pre-Phase-7 carts (no variant keys) readable.
        return cls(
            product_id=int(raw["product_id"]),
            quantity=max(1, min(MAX_QTY, int(raw["quantity"]))),
            care_oil_added=bool(raw.get("care_oil_added", False)),
            wood_type=raw.get("wood_type") or None,
            color=raw.get("color") or None,
        )


class CartService:
    """Async cart store on top of Redis."""

    def __init__(self, redis: Redis | None = None) -> None:
        self._redis = redis or get_redis()

    # -- internals -----------------------------------------------------------

    def validate_session(self, session_id: str) -> str:
        """Validate a client session id and return its Redis key.

        Raises :class:`InvalidSessionError` on a malformed id (endpoints map
        that to HTTP 400). Public because endpoint layers use it up front.
        """
        sid = (session_id or "").strip()
        if not _SESSION_ID_RE.match(sid):
            raise InvalidSessionError(
                "Invalid session_id: use 8-64 characters of [A-Za-z0-9_-]."
            )
        return f"{CART_KEY_PREFIX}{sid}"

    def _key(self, session_id: str) -> str:
        return self.validate_session(session_id)

    @staticmethod
    def _parse(raw: str | None) -> list[CartLine]:
        """Decode the stored JSON defensively; malformed entries are dropped."""
        if not raw:
            return []
        try:
            doc = json.loads(raw)
        except json.JSONDecodeError:
            return []
        items = doc.get("items", []) if isinstance(doc, dict) else doc
        if not isinstance(items, list):
            return []
        lines: list[CartLine] = []
        for entry in items:
            if not isinstance(entry, dict):
                continue
            try:
                lines.append(CartLine.from_dict(entry))
            except (KeyError, TypeError, ValueError):
                continue
        return lines

    @staticmethod
    def _encode(lines: list[CartLine]) -> str:
        return json.dumps({"v": 1, "items": [line.to_dict() for line in lines]})

    async def _mutate(
        self, session_id: str, mutate: Callable[[list[CartLine]], list[CartLine]]
    ) -> list[CartLine]:
        """Read-modify-write under WATCH, retrying on concurrent writers."""
        key = self._key(session_id)
        for _ in range(_MAX_RETRIES):
            pipe = self._redis.pipeline(transaction=True)
            try:
                await pipe.watch(key)
                raw = await pipe.get(key)
                new_lines = mutate(self._parse(raw))
                pipe.multi()
                pipe.set(key, self._encode(new_lines), ex=CART_TTL_SECONDS)
                await pipe.execute()
                return new_lines
            except WatchError:
                await pipe.unwatch()
                continue
        raise CartWriteConflictError("Cart is busy; please try again.")

    # -- public API -----------------------------------------------------------

    async def get_lines(self, session_id: str) -> list[CartLine]:
        """Return the stored lines (empty list when the cart is empty)."""
        return self._parse(await self._redis.get(self._key(session_id)))

    async def add_item(
        self,
        session_id: str,
        product_id: int,
        quantity: int,
        care_oil_added: bool,
        wood_type: str | None = None,
        color: str | None = None,
    ) -> CartLine:
        """Add a line (or merge into an existing one); qty capped at MAX_QTY.

        On a merge the incoming variant wins only when it is non-empty, so a
        bare re-add never wipes a previously chosen wood/color.
        """
        qty = max(1, min(MAX_QTY, int(quantity)))

        def _apply(lines: list[CartLine]) -> list[CartLine]:
            for i, line in enumerate(lines):
                if line.product_id == product_id:
                    lines[i] = CartLine(
                        product_id=product_id,
                        quantity=min(MAX_QTY, line.quantity + qty),
                        care_oil_added=line.care_oil_added or care_oil_added,
                        wood_type=wood_type or line.wood_type,
                        color=color or line.color,
                    )
                    return lines
            lines.append(
                CartLine(
                    product_id=product_id,
                    quantity=qty,
                    care_oil_added=care_oil_added,
                    wood_type=wood_type,
                    color=color,
                )
            )
            return lines

        new_lines = await self._mutate(session_id, _apply)
        return next(line for line in new_lines if line.product_id == product_id)

    async def set_line(
        self,
        session_id: str,
        product_id: int,
        quantity: int,
        care_oil_added: bool,
        wood_type: str | None = None,
        color: str | None = None,
    ) -> CartLine | None:
        """Upsert a line with an **absolute** quantity (storefront qty stepper
        + oil toggle). The storefront echoes the line's current variant values
        back so a tweak never clears them. Returns the resulting line."""
        qty = max(1, min(MAX_QTY, int(quantity)))

        def _apply(lines: list[CartLine]) -> list[CartLine]:
            # When the caller omits a variant (None) and a line already exists,
            # keep the stored value; otherwise store exactly what was given.
            existing = next((l for l in lines if l.product_id == product_id), None)
            new_line = CartLine(
                product_id=product_id,
                quantity=qty,
                care_oil_added=care_oil_added,
                wood_type=wood_type if wood_type is not None else (existing.wood_type if existing else None),
                color=color if color is not None else (existing.color if existing else None),
            )
            if existing is not None:
                lines[lines.index(existing)] = new_line
            else:
                lines.append(new_line)
            return lines

        new_lines = await self._mutate(session_id, _apply)
        return next(line for line in new_lines if line.product_id == product_id)

    async def remove_item(self, session_id: str, product_id: int) -> bool:
        """Drop a line. Returns True when the line actually existed."""
        removed = False

        def _apply(lines: list[CartLine]) -> list[CartLine]:
            nonlocal removed
            filtered = [line for line in lines if line.product_id != product_id]
            removed = len(filtered) != len(lines)
            return filtered

        await self._mutate(session_id, _apply)
        return removed

    async def clear(self, session_id: str) -> None:
        """Delete the cart key (idempotent)."""
        await self._redis.delete(self._key(session_id))


# Shared application-wide instance (lazy Redis connection).
cart_service = CartService()