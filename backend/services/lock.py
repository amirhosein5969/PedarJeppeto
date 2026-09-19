"""Redis distributed lock to guard checkout against double-submit (Phase 4.5).

Two concurrent ``POST /orders`` for the same cart would otherwise both read a
non-empty cart and both commit (a double order). The lock serializes them:
the first requester acquires it, the rest are rejected **immediately** with a
409 before doing any work.

Implementation
--------------
* Acquire = ``SET key token NX EX 10`` (atomic "set if not exists" with a
  10-second TTL) — the modern, race-free form of ``SETNX`` + expiry.
* The TTL is a crash safety net: if a worker dies mid-checkout the lock
  self-expires rather than wedging the cart forever.
* Release = a tiny Lua compare-and-delete so we only ever delete *our own*
  token (never a lock that a later request re-acquired after our TTL lapsed).

The lock is released in a ``finally`` by the endpoint, so a failed checkout
lets the client retry immediately and a successful one is still safe (the cart
was cleared, so a re-submit sees an empty cart).
"""

from __future__ import annotations

import uuid

from core.cache import get_redis

LOCK_PREFIX = "checkout:lock:"
LOCK_TTL_SECONDS = 10

# Compare-and-delete: only release the lock if we still own it.
_RELEASE_LUA = """
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
else
    return 0
end
"""


class CheckoutLock:
    """A short-lived, token-guarded distributed lock backed by Redis."""

    def __init__(self, ttl: int = LOCK_TTL_SECONDS) -> None:
        self._ttl = ttl

    def _key(self, identifier: str) -> str:
        return f"{LOCK_PREFIX}{identifier}"

    async def acquire(self, identifier: str) -> str | None:
        """Try to take the lock. Returns a token, or ``None`` if held."""
        token = uuid.uuid4().hex
        ok = await get_redis().set(
            self._key(identifier), token, nx=True, ex=self._ttl
        )
        return token if ok else None

    async def release(self, identifier: str, token: str) -> None:
        """Release the lock only if we still hold it (best-effort)."""
        try:
            await get_redis().eval(_RELEASE_LUA, 1, self._key(identifier), token)
        except Exception:
            pass  # release failure is non-fatal; the TTL will clear it


#: Process-wide singleton for the API layer.
checkout_lock = CheckoutLock()