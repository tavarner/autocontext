"""Browser exploration contract, settings, and policy helpers."""

from autocontext.integrations.browser.policy import (
    BrowserPolicyDecision,
    build_default_browser_session_config,
    evaluate_browser_action_policy,
    normalize_browser_allowed_domains,
    resolve_browser_session_config,
)
from autocontext.integrations.browser.validate import (
    validate_browser_action,
    validate_browser_action_dict,
    validate_browser_audit_event,
    validate_browser_audit_event_dict,
    validate_browser_session_config,
    validate_browser_session_config_dict,
    validate_browser_snapshot,
    validate_browser_snapshot_dict,
)

__all__ = [
    "BrowserPolicyDecision",
    "build_default_browser_session_config",
    "evaluate_browser_action_policy",
    "normalize_browser_allowed_domains",
    "resolve_browser_session_config",
    "validate_browser_action",
    "validate_browser_action_dict",
    "validate_browser_audit_event",
    "validate_browser_audit_event_dict",
    "validate_browser_session_config",
    "validate_browser_session_config_dict",
    "validate_browser_snapshot",
    "validate_browser_snapshot_dict",
]
