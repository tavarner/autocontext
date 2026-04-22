"""Exception → reason-key lookup for Anthropic SDK exceptions."""
from __future__ import annotations

import anthropic

from autocontext.production_traces.taxonomy import (
    ANTHROPIC_ERROR_REASONS,
    AnthropicErrorReasonKey,
)


def map_exception_to_reason(exc: BaseException) -> AnthropicErrorReasonKey:
    name = type(exc).__name__
    return ANTHROPIC_ERROR_REASONS.get(name, "uncategorized")  # type: ignore[return-value]


def is_mapped_class_present(class_name: str) -> bool:
    """Return True if class_name is accessible from the anthropic package (top-level or _exceptions)."""
    if hasattr(anthropic, class_name):
        return True
    try:
        from anthropic import _exceptions  # noqa: PLC0415
        return hasattr(_exceptions, class_name)
    except ImportError:
        return False
