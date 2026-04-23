"""Pure policy helpers for browser exploration."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any
from urllib.parse import urlparse

from autocontext.integrations.browser.contract.types import BrowserAction, BrowserSessionConfig
from autocontext.integrations.browser.validate import validate_browser_action, validate_browser_session_config

if TYPE_CHECKING:
    from autocontext.config.settings import AppSettings

INTERNAL_ALLOWED_URLS = {"about:blank"}


@dataclass(frozen=True, slots=True)
class BrowserPolicyDecision:
    allowed: bool
    reason: str
    matched_domain: str | None = None


def normalize_browser_allowed_domains(domains: str | list[str]) -> list[str]:
    raw = domains if isinstance(domains, list) else domains.split(",")
    normalized: list[str] = []
    seen: set[str] = set()
    for item in raw:
        domain = item.strip().lower()
        if not domain or domain in seen:
            continue
        seen.add(domain)
        normalized.append(domain)
    return normalized


def build_default_browser_session_config(
    *,
    allowed_domains: list[str] | None = None,
    profile_mode: str = "ephemeral",
    allow_auth: bool = False,
    allow_uploads: bool = False,
    allow_downloads: bool = False,
    capture_screenshots: bool = True,
    headless: bool = True,
    downloads_root: str | None = None,
    uploads_root: str | None = None,
) -> BrowserSessionConfig:
    return validate_browser_session_config({
        "schemaVersion": "1.0",
        "profileMode": profile_mode,
        "allowedDomains": allowed_domains or [],
        "allowAuth": allow_auth,
        "allowUploads": allow_uploads,
        "allowDownloads": allow_downloads,
        "captureScreenshots": capture_screenshots,
        "headless": headless,
        "downloadsRoot": downloads_root,
        "uploadsRoot": uploads_root,
    })


def resolve_browser_session_config(settings: AppSettings) -> BrowserSessionConfig:
    return build_default_browser_session_config(
        allowed_domains=normalize_browser_allowed_domains(settings.browser_allowed_domains),
        profile_mode=settings.browser_profile_mode,
        allow_auth=settings.browser_allow_auth,
        allow_uploads=settings.browser_allow_uploads,
        allow_downloads=settings.browser_allow_downloads,
        capture_screenshots=settings.browser_capture_screenshots,
        headless=settings.browser_headless,
        downloads_root=settings.browser_downloads_root or None,
        uploads_root=settings.browser_uploads_root or None,
    )


def evaluate_browser_action_policy(
    config: BrowserSessionConfig,
    action: BrowserAction | dict[str, Any],
) -> BrowserPolicyDecision:
    parsed_action = validate_browser_action(action) if isinstance(action, dict) else action
    if parsed_action.type == "navigate":
        url = str(parsed_action.params.url)
        if url in INTERNAL_ALLOWED_URLS:
            return BrowserPolicyDecision(allowed=True, reason="allowed")
        target = _parse_navigation_target(url)
        if target is None:
            return BrowserPolicyDecision(allowed=False, reason="invalid_url")
        hostname, inline_credentials = target
        if inline_credentials and not config.allowAuth:
            return BrowserPolicyDecision(allowed=False, reason="auth_blocked")
        for allowed_domain in config.allowedDomains:
            if _matches_allowed_domain(hostname, str(allowed_domain)):
                return BrowserPolicyDecision(
                    allowed=True,
                    reason="allowed",
                    matched_domain=str(allowed_domain),
                )
        return BrowserPolicyDecision(allowed=False, reason="domain_not_allowed")
    if parsed_action.type == "fill":
        field_kind = parsed_action.params.fieldKind
        if field_kind == "password" and not config.allowAuth:
            return BrowserPolicyDecision(allowed=False, reason="auth_blocked")
    return BrowserPolicyDecision(allowed=True, reason="allowed")


def _parse_navigation_target(url: str) -> tuple[str, bool] | None:
    try:
        parsed = urlparse(url)
    except ValueError:
        return None
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return None
    inline_credentials = bool(parsed.username or parsed.password)
    return parsed.hostname.lower(), inline_credentials


def _matches_allowed_domain(hostname: str, allowed_domain: str) -> bool:
    if allowed_domain.startswith("*."):
        suffix = allowed_domain[2:]
        return len(hostname) > len(suffix) and hostname.endswith(f".{suffix}")
    return hostname == allowed_domain
