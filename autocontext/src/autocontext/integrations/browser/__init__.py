"""Browser exploration contract, settings, and policy helpers."""

from autocontext.integrations.browser.chrome_cdp import ChromeCdpSession, ChromeCdpTransport
from autocontext.integrations.browser.chrome_cdp_discovery import (
    ChromeCdpDiscoveryError,
    ChromeCdpTarget,
    ChromeCdpTargetDiscovery,
    ChromeCdpTargetDiscoveryPort,
    select_chrome_cdp_target,
)
from autocontext.integrations.browser.chrome_cdp_runtime import ChromeCdpRuntime
from autocontext.integrations.browser.chrome_cdp_transport import (
    ChromeCdpTransportError,
    ChromeCdpWebSocketTransport,
)
from autocontext.integrations.browser.evidence import BrowserArtifactPaths, BrowserEvidenceStore
from autocontext.integrations.browser.factory import (
    ConfiguredBrowserRuntime,
    browser_runtime_from_settings,
)
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
    "BrowserArtifactPaths",
    "BrowserEvidenceStore",
    "ConfiguredBrowserRuntime",
    "ChromeCdpDiscoveryError",
    "ChromeCdpSession",
    "ChromeCdpTransport",
    "ChromeCdpRuntime",
    "ChromeCdpTarget",
    "ChromeCdpTargetDiscovery",
    "ChromeCdpTargetDiscoveryPort",
    "ChromeCdpTransportError",
    "ChromeCdpWebSocketTransport",
    "BrowserPolicyDecision",
    "browser_runtime_from_settings",
    "build_default_browser_session_config",
    "evaluate_browser_action_policy",
    "normalize_browser_allowed_domains",
    "resolve_browser_session_config",
    "select_chrome_cdp_target",
    "validate_browser_action",
    "validate_browser_action_dict",
    "validate_browser_audit_event",
    "validate_browser_audit_event_dict",
    "validate_browser_session_config",
    "validate_browser_session_config_dict",
    "validate_browser_snapshot",
    "validate_browser_snapshot_dict",
]
