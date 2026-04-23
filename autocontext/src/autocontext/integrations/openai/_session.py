"""Re-export of the shared session contextvar.

Kept for backward compatibility with existing internal imports. New
integrations should import directly from
``autocontext.integrations._shared``.
"""
from autocontext.integrations._shared.session import (
    autocontext_session,
    current_session,
)

__all__ = ["autocontext_session", "current_session"]
