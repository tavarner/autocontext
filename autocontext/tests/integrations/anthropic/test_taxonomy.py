"""Tests for Anthropic exception → reason-key taxonomy mapper (TDD — RED phase)."""
from __future__ import annotations

import pytest

from autocontext.integrations.anthropic._taxonomy import (
    is_mapped_class_present,
    map_exception_to_reason,
)

# All 13 class names from the ANTHROPIC_ERROR_REASONS table.
_ALL_MAPPED_CLASSES = [
    ("RateLimitError", "rateLimited"),
    ("APITimeoutError", "timeout"),
    ("BadRequestError", "badRequest"),
    ("AuthenticationError", "authentication"),
    ("PermissionDeniedError", "permissionDenied"),
    ("NotFoundError", "notFound"),
    ("APIConnectionError", "apiConnection"),
    ("OverloadedError", "overloaded"),
    ("ConflictError", "upstreamError"),
    ("UnprocessableEntityError", "upstreamError"),
    ("InternalServerError", "upstreamError"),
    ("APIStatusError", "upstreamError"),
    ("APIError", "upstreamError"),
]


def test_maps_rate_limit_error() -> None:
    """RateLimitError maps to rateLimited."""
    import anthropic
    exc = anthropic.RateLimitError(
        message="rate limited",
        response=_stub_response(429),
        body=None,
    )
    assert map_exception_to_reason(exc) == "rateLimited"


def test_maps_overloaded_error() -> None:
    """OverloadedError maps to overloaded — the Anthropic-specific key."""
    from anthropic._exceptions import OverloadedError
    exc = OverloadedError(
        message="overloaded",
        response=_stub_response(529),
        body=None,
    )
    assert map_exception_to_reason(exc) == "overloaded"


def test_maps_api_timeout_error() -> None:
    """APITimeoutError maps to timeout."""
    import anthropic
    exc = anthropic.APITimeoutError(request=_stub_request())
    assert map_exception_to_reason(exc) == "timeout"


def test_maps_authentication_error() -> None:
    """AuthenticationError maps to authentication."""
    import anthropic
    exc = anthropic.AuthenticationError(
        message="invalid api key",
        response=_stub_response(401),
        body=None,
    )
    assert map_exception_to_reason(exc) == "authentication"


def test_maps_internal_server_error() -> None:
    """InternalServerError maps to upstreamError."""
    import anthropic
    exc = anthropic.InternalServerError(
        message="internal error",
        response=_stub_response(500),
        body=None,
    )
    assert map_exception_to_reason(exc) == "upstreamError"


def test_unknown_exception_maps_to_uncategorized() -> None:
    """Unknown exception class falls through to uncategorized."""
    exc = ValueError("something unexpected")
    assert map_exception_to_reason(exc) == "uncategorized"


def test_is_mapped_class_present_known_class() -> None:
    """RateLimitError is a real class in the anthropic SDK."""
    assert is_mapped_class_present("RateLimitError") is True


def test_is_mapped_class_present_overloaded_error() -> None:
    """OverloadedError is accessible (may be in _exceptions)."""
    assert is_mapped_class_present("OverloadedError") is True


def test_is_mapped_class_present_fake_class() -> None:
    """Made-up class names return False."""
    assert is_mapped_class_present("FictionalError12345") is False


@pytest.mark.parametrize("class_name,expected_reason", _ALL_MAPPED_CLASSES)
def test_parametrized_all_13_classes(class_name: str, expected_reason: str) -> None:
    """Every class in the taxonomy table maps correctly."""
    cls = _get_anthropic_class(class_name)
    assert cls is not None, f"anthropic.{class_name} not found in SDK"
    exc = _build_exc(class_name, cls)
    assert map_exception_to_reason(exc) == expected_reason


# ---- helpers ----

def _get_anthropic_class(class_name: str):
    """Get class from anthropic, falling back to anthropic._exceptions."""
    import anthropic
    cls = getattr(anthropic, class_name, None)
    if cls is not None:
        return cls
    try:
        from anthropic import _exceptions
        return getattr(_exceptions, class_name, None)
    except ImportError:
        return None


def _stub_response(status_code: int):
    import httpx
    return httpx.Response(
        status_code,
        content=b"",
        request=httpx.Request("GET", "https://api.anthropic.com/v1/messages"),
    )


def _stub_request():
    import httpx
    return httpx.Request("POST", "https://api.anthropic.com/v1/messages")


def _build_exc(class_name: str, cls):
    """Build minimal exception instances for each error class."""
    # Timeout-style errors take (request=...)
    if class_name == "APITimeoutError":
        return cls(request=_stub_request())
    # Connection-style errors take (request=..., message=...)
    if class_name == "APIConnectionError":
        return cls(request=_stub_request(), message="connection refused")
    # Status-based errors take (message=..., response=..., body=None)
    status_map = {
        "RateLimitError": 429,
        "BadRequestError": 400,
        "AuthenticationError": 401,
        "PermissionDeniedError": 403,
        "NotFoundError": 404,
        "ConflictError": 409,
        "UnprocessableEntityError": 422,
        "OverloadedError": 529,
        "InternalServerError": 500,
        "APIStatusError": 400,
        "APIError": 400,
    }
    code = status_map.get(class_name, 400)
    try:
        return cls(message="test error", response=_stub_response(code), body=None)
    except TypeError:
        # Base APIError: needs request not response
        try:
            return cls(message="test error", request=_stub_request(), body=None)
        except TypeError:
            return Exception(f"stub {class_name}")
