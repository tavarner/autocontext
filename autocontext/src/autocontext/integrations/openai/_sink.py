"""Re-export of the shared sink primitives.

Kept for backward compatibility with existing internal imports within the
``autocontext.integrations.openai`` package. New integrations should import
directly from ``autocontext.integrations._shared``.
"""
from autocontext.integrations._shared.sink import FileSink, TraceSink

__all__ = ["FileSink", "TraceSink"]
