"""Shared service-layer error types (Phase 4).

Service code raises these; endpoint layers map them to HTTP responses
(``CheckoutError.status_code`` -> the 4xx status). Keeping the base class
here (rather than in one consumer) avoids a circular import between
``services.promotion`` and ``services.order``.
"""


class CheckoutError(Exception):
    """A checkout/business rule failed; ``status_code`` drives the 4xx."""

    status_code = 400

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message