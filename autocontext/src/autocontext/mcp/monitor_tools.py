"""MCP tool implementations — monitor_tools (extracted from tools.py, AC-482)."""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Any

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    pass


def autocontext_create_monitor(
    name: str,
    condition_type: str,
    params_json: str = "{}",
    scope: str = "global",
) -> dict[str, Any]:
    """Create a new monitor condition."""
    from autocontext.monitor.engine import get_engine
    from autocontext.monitor.types import ConditionType, MonitorCondition, make_id

    engine = get_engine()
    cid = make_id()
    params = json.loads(params_json) if isinstance(params_json, str) else params_json
    cond = MonitorCondition(
        id=cid,
        name=name,
        condition_type=ConditionType(condition_type),
        params=params,
        scope=scope,
    )
    engine.create_condition(cond)
    return {"id": cid, "name": name, "condition_type": condition_type, "scope": scope}


def autocontext_list_monitors(
    scope: str | None = None,
    active_only: bool = True,
) -> list[dict[str, Any]]:
    """List monitor conditions."""
    from autocontext.monitor.engine import get_engine

    engine = get_engine()
    return engine._sqlite.list_monitor_conditions(active_only=active_only, scope=scope)


def autocontext_delete_monitor(condition_id: str) -> dict[str, Any]:
    """Deactivate a monitor condition."""
    from autocontext.monitor.engine import get_engine

    engine = get_engine()
    found = engine._sqlite.deactivate_monitor_condition(condition_id)
    return {"deleted": found, "condition_id": condition_id}


def autocontext_list_monitor_alerts(
    condition_id: str | None = None,
    scope: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """List monitor alerts."""
    from autocontext.monitor.engine import get_engine

    engine = get_engine()
    return engine._sqlite.list_monitor_alerts(condition_id=condition_id, scope=scope, limit=limit)


def autocontext_wait_for_monitor(
    condition_id: str,
    timeout_seconds: float = 30.0,
) -> dict[str, Any]:
    """Wait for a monitor condition to fire."""
    from autocontext.monitor.engine import get_engine

    engine = get_engine()
    fired = engine.wait_for_alert(condition_id, timeout=timeout_seconds)
    alert = None
    if fired:
        alerts = engine._sqlite.list_monitor_alerts(condition_id=condition_id, limit=1)
        if alerts:
            alert = alerts[0]
    return {"fired": fired, "alert": alert}
