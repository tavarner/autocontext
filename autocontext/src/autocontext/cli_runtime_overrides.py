from __future__ import annotations

from typing import Any

from autocontext.config.settings import AppSettings
from autocontext.providers.base import ProviderError

_SOLVE_RUNTIME_PROVIDER_FIELDS = (
    "agent_provider",
    "architect_provider",
    "analyst_provider",
    "competitor_provider",
)


def runtime_timeout_field_for_provider(provider_name: str) -> str | None:
    provider = provider_name.strip().lower()
    if provider == "claude-cli":
        return "claude_timeout"
    if provider == "codex":
        return "codex_timeout"
    if provider in {"pi", "pi-rpc"}:
        return "pi_timeout"
    return None


def _apply_timeout_overrides(
    updates: dict[str, Any],
    *,
    provider_names: list[str],
    timeout: float | None,
) -> None:
    if timeout is None:
        return
    for provider_name in provider_names:
        timeout_field = runtime_timeout_field_for_provider(provider_name)
        if timeout_field is not None:
            updates[timeout_field] = timeout


def solve_runtime_provider_names(settings: AppSettings) -> list[str]:
    providers: list[str] = []
    for field_name in _SOLVE_RUNTIME_PROVIDER_FIELDS:
        value = getattr(settings, field_name, "")
        if not isinstance(value, str):
            continue
        normalized = value.strip().lower()
        if normalized and normalized not in providers:
            providers.append(normalized)
    return providers


def solve_primary_runtime_provider(settings: AppSettings) -> str:
    provider_names = solve_runtime_provider_names(settings)
    for provider_name in provider_names:
        if runtime_timeout_field_for_provider(provider_name) is not None:
            return provider_name
    return settings.agent_provider.strip().lower()


def apply_judge_runtime_overrides(
    settings: AppSettings,
    *,
    provider_name: str = "",
    model: str = "",
    timeout: float | None = None,
) -> AppSettings:
    updates: dict[str, Any] = {}
    if provider_name:
        updates["judge_provider"] = provider_name
    if model:
        updates["judge_model"] = model

    resolved_provider = (provider_name or settings.judge_provider).strip().lower()
    _apply_timeout_overrides(
        updates,
        provider_names=[resolved_provider],
        timeout=timeout,
    )

    if not updates:
        return settings
    return settings.model_copy(update=updates)


def apply_solve_runtime_overrides(
    settings: AppSettings,
    *,
    timeout: float | None = None,
    generation_time_budget_seconds: int | None = None,
) -> AppSettings:
    updates: dict[str, Any] = {}
    _apply_timeout_overrides(
        updates,
        provider_names=solve_runtime_provider_names(settings),
        timeout=timeout,
    )
    if generation_time_budget_seconds is not None:
        updates["generation_time_budget_seconds"] = generation_time_budget_seconds
    if not updates:
        return settings
    return settings.model_copy(update=updates)


def format_runtime_provider_error(
    exc: ProviderError,
    *,
    provider_name: str,
    settings: AppSettings,
) -> str:
    message = str(exc)
    if "timeout" not in message.lower():
        return message

    provider = provider_name.strip().lower()
    timeout_help = {
        "claude-cli": ("Claude CLI", settings.claude_timeout, "AUTOCONTEXT_CLAUDE_TIMEOUT"),
        "codex": ("Codex CLI", settings.codex_timeout, "AUTOCONTEXT_CODEX_TIMEOUT"),
        "pi": ("Pi CLI", settings.pi_timeout, "AUTOCONTEXT_PI_TIMEOUT"),
        "pi-rpc": ("Pi RPC", settings.pi_timeout, "AUTOCONTEXT_PI_TIMEOUT"),
    }
    help_details = timeout_help.get(provider)
    if help_details is None:
        return message

    label, configured_timeout, env_var = help_details
    return (
        f"{label} timed out after {configured_timeout:.0f}s. "
        f"Retry with --timeout <seconds> or set {env_var}. Original error: {message}"
    )
