"""Master v1 API router — the single aggregation point for /api/v1.

New resource routers are included here only; main.py stays wiring-free.
"""

from fastapi import APIRouter

from api.v1.endpoints import (
    analytics,
    auth,
    cart,
    categories,
    notifications,
    orders,
    products,
    promotions,
    settings,
    upload,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(upload.router)
api_router.include_router(categories.router)
api_router.include_router(products.router)
api_router.include_router(cart.router)
api_router.include_router(promotions.router)
api_router.include_router(orders.router)
api_router.include_router(settings.router)
api_router.include_router(users.router)
api_router.include_router(analytics.router)
api_router.include_router(notifications.router)