"""Reusable world-state abstraction for stateful scenario families (AC-265).

Provides a shared state contract for richer task families such as
orchestration, negotiation, and debugging scenarios. Supports entities,
resources, hidden variables, dependency graphs, state transitions and
diffs, with utilities for evaluation, inspection, and replay.

Compatible with the canonical event model (AC-262) via to_event_payload().
"""

from __future__ import annotations

import copy
import json
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class WorldEntity:
    """An entity in the world state (agent, service, task, etc.)."""

    entity_id: str
    entity_type: str
    name: str
    properties: dict[str, Any]
    status: str  # active, inactive, blocked, completed, failed

    def to_dict(self) -> dict[str, Any]:
        return {
            "entity_id": self.entity_id,
            "entity_type": self.entity_type,
            "name": self.name,
            "properties": self.properties,
            "status": self.status,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> WorldEntity:
        return cls(
            entity_id=data["entity_id"],
            entity_type=data["entity_type"],
            name=data.get("name", ""),
            properties=data.get("properties", {}),
            status=data.get("status", "active"),
        )


@dataclass(slots=True)
class WorldResource:
    """A quantifiable resource in the world."""

    resource_id: str
    resource_type: str
    name: str
    quantity: float
    capacity: float | None
    owner_entity_id: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "resource_id": self.resource_id,
            "resource_type": self.resource_type,
            "name": self.name,
            "quantity": self.quantity,
            "capacity": self.capacity,
            "owner_entity_id": self.owner_entity_id,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> WorldResource:
        return cls(
            resource_id=data["resource_id"],
            resource_type=data["resource_type"],
            name=data.get("name", ""),
            quantity=data.get("quantity", 0.0),
            capacity=data.get("capacity"),
            owner_entity_id=data.get("owner_entity_id"),
        )


@dataclass(slots=True)
class DependencyEdge:
    """A dependency between entities.

    Types: requires, blocks, produces, consumes.
    """

    source_entity_id: str
    target_entity_id: str
    dependency_type: str
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_entity_id": self.source_entity_id,
            "target_entity_id": self.target_entity_id,
            "dependency_type": self.dependency_type,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> DependencyEdge:
        return cls(
            source_entity_id=data["source_entity_id"],
            target_entity_id=data["target_entity_id"],
            dependency_type=data["dependency_type"],
            metadata=data.get("metadata", {}),
        )


@dataclass(slots=True)
class HiddenVariable:
    """A hidden variable that may be revealed during play."""

    variable_id: str
    name: str
    value: Any
    revealed: bool
    reveal_condition: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "variable_id": self.variable_id,
            "name": self.name,
            "value": self.value,
            "revealed": self.revealed,
            "reveal_condition": self.reveal_condition,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> HiddenVariable:
        return cls(
            variable_id=data["variable_id"],
            name=data.get("name", ""),
            value=data.get("value"),
            revealed=data.get("revealed", False),
            reveal_condition=data.get("reveal_condition", ""),
        )


@dataclass(slots=True)
class StateDelta:
    """A single change within a state transition.

    Delta types: entity_created, entity_updated, entity_removed,
    resource_changed, variable_revealed, dependency_added, dependency_removed.
    """

    delta_type: str
    target_id: str
    field: str | None
    old_value: Any
    new_value: Any

    def to_dict(self) -> dict[str, Any]:
        return {
            "delta_type": self.delta_type,
            "target_id": self.target_id,
            "field": self.field,
            "old_value": self.old_value,
            "new_value": self.new_value,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> StateDelta:
        return cls(
            delta_type=data["delta_type"],
            target_id=data["target_id"],
            field=data.get("field"),
            old_value=data.get("old_value"),
            new_value=data.get("new_value"),
        )


@dataclass(slots=True)
class StateTransition:
    """A transition that changes world state."""

    transition_id: str
    timestamp: str
    action: str
    actor_entity_id: str
    changes: list[StateDelta]
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "transition_id": self.transition_id,
            "timestamp": self.timestamp,
            "action": self.action,
            "actor_entity_id": self.actor_entity_id,
            "changes": [c.to_dict() for c in self.changes],
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> StateTransition:
        return cls(
            transition_id=data["transition_id"],
            timestamp=data.get("timestamp", ""),
            action=data.get("action", ""),
            actor_entity_id=data.get("actor_entity_id", ""),
            changes=[StateDelta.from_dict(c) for c in data.get("changes", [])],
            metadata=data.get("metadata", {}),
        )


@dataclass(slots=True)
class WorldState:
    """A snapshot of the entire world at a point in time."""

    state_id: str
    scenario_name: str
    step_index: int
    entities: list[WorldEntity]
    resources: list[WorldResource]
    dependencies: list[DependencyEdge]
    hidden_variables: list[HiddenVariable]
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "state_id": self.state_id,
            "scenario_name": self.scenario_name,
            "step_index": self.step_index,
            "entities": [e.to_dict() for e in self.entities],
            "resources": [r.to_dict() for r in self.resources],
            "dependencies": [d.to_dict() for d in self.dependencies],
            "hidden_variables": [v.to_dict() for v in self.hidden_variables],
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> WorldState:
        return cls(
            state_id=data["state_id"],
            scenario_name=data.get("scenario_name", ""),
            step_index=data.get("step_index", 0),
            entities=[WorldEntity.from_dict(e) for e in data.get("entities", [])],
            resources=[WorldResource.from_dict(r) for r in data.get("resources", [])],
            dependencies=[DependencyEdge.from_dict(d) for d in data.get("dependencies", [])],
            hidden_variables=[HiddenVariable.from_dict(v) for v in data.get("hidden_variables", [])],
            metadata=data.get("metadata", {}),
        )


class WorldStateManager:
    """Manages world state, applies transitions, and produces diffs."""

    def __init__(self, initial_state: WorldState) -> None:
        self._state = copy.deepcopy(initial_state)
        self._entity_map: dict[str, WorldEntity] = {
            e.entity_id: e for e in self._state.entities
        }
        self._resource_map: dict[str, WorldResource] = {
            r.resource_id: r for r in self._state.resources
        }

    def snapshot(self) -> WorldState:
        """Return a deep copy of the current state with a new ID."""
        snap = copy.deepcopy(self._state)
        snap.state_id = f"ws-{uuid.uuid4().hex[:8]}"  # type: ignore[misc]
        return snap

    def get_entity(self, entity_id: str) -> WorldEntity | None:
        return self._entity_map.get(entity_id)

    def get_resource(self, resource_id: str) -> WorldResource | None:
        return self._resource_map.get(resource_id)

    def apply_transition(self, transition: StateTransition) -> WorldState:
        """Apply a state transition, returning the new state."""
        for delta in transition.changes:
            self._apply_delta(delta)

        self._state.step_index += 1  # type: ignore[misc]
        self._sync_collections()
        return self.snapshot()

    def diff(self, state_a: WorldState, state_b: WorldState) -> list[StateDelta]:
        """Compute deltas between two world states."""
        deltas: list[StateDelta] = []

        # Entity property diffs
        a_entities = {e.entity_id: e for e in state_a.entities}
        b_entities = {e.entity_id: e for e in state_b.entities}

        for eid, b_ent in b_entities.items():
            a_ent = a_entities.get(eid)
            if a_ent is None:
                deltas.append(StateDelta(
                    delta_type="entity_created", target_id=eid,
                    field=None, old_value=None, new_value=b_ent.to_dict(),
                ))
                continue
            # Check property changes
            for key in set(a_ent.properties) | set(b_ent.properties):
                old_val = a_ent.properties.get(key)
                new_val = b_ent.properties.get(key)
                if old_val != new_val:
                    deltas.append(StateDelta(
                        delta_type="entity_updated", target_id=eid,
                        field=key, old_value=old_val, new_value=new_val,
                    ))
            # Check status change
            if a_ent.status != b_ent.status:
                deltas.append(StateDelta(
                    delta_type="entity_updated", target_id=eid,
                    field="status", old_value=a_ent.status, new_value=b_ent.status,
                ))

        for eid in set(a_entities) - set(b_entities):
            deltas.append(StateDelta(
                delta_type="entity_removed", target_id=eid,
                field=None, old_value=a_entities[eid].to_dict(), new_value=None,
            ))

        # Resource diffs
        a_resources = {r.resource_id: r for r in state_a.resources}
        b_resources = {r.resource_id: r for r in state_b.resources}

        for rid in set(a_resources) | set(b_resources):
            a_res = a_resources.get(rid)
            b_res = b_resources.get(rid)
            if a_res is not None and b_res is not None:
                if a_res.quantity != b_res.quantity:
                    deltas.append(StateDelta(
                        delta_type="resource_changed", target_id=rid,
                        field="quantity", old_value=a_res.quantity,
                        new_value=b_res.quantity,
                    ))

        return deltas

    def to_event_payload(self) -> dict[str, Any]:
        """Convert current state to a payload compatible with the canonical event model."""
        return self._state.to_dict()

    # --- private ---

    def _apply_delta(self, delta: StateDelta) -> None:
        dt = delta.delta_type

        if dt == "entity_updated":
            entity = self._entity_map.get(delta.target_id)
            if entity is not None and delta.field is not None:
                if delta.field == "status":
                    entity.status = delta.new_value  # type: ignore[misc]
                else:
                    entity.properties[delta.field] = delta.new_value

        elif dt == "entity_created":
            if isinstance(delta.new_value, dict):
                new_entity = WorldEntity.from_dict(delta.new_value)
                self._entity_map[new_entity.entity_id] = new_entity

        elif dt == "entity_removed":
            self._entity_map.pop(delta.target_id, None)

        elif dt == "resource_changed":
            resource = self._resource_map.get(delta.target_id)
            if resource is not None and delta.field == "quantity":
                resource.quantity = delta.new_value  # type: ignore[misc]

        elif dt == "variable_revealed":
            for var in self._state.hidden_variables:
                if var.variable_id == delta.target_id:
                    var.revealed = True  # type: ignore[misc]
                    break

        elif dt == "dependency_added":
            if isinstance(delta.new_value, dict):
                self._state.dependencies.append(DependencyEdge.from_dict(delta.new_value))

        elif dt == "dependency_removed":
            if isinstance(delta.old_value, dict):
                src = delta.old_value.get("source_entity_id")
                tgt = delta.old_value.get("target_entity_id")
                self._state.dependencies = [  # type: ignore[misc]
                    d for d in self._state.dependencies
                    if not (d.source_entity_id == src and d.target_entity_id == tgt)
                ]

    def _sync_collections(self) -> None:
        """Sync internal maps back to state lists."""
        self._state.entities = list(self._entity_map.values())  # type: ignore[misc]
        self._state.resources = list(self._resource_map.values())  # type: ignore[misc]


class WorldStateStore:
    """Persists world state snapshots as JSON files."""

    def __init__(self, root: Path) -> None:
        self._dir = root / "world_states"
        self._dir.mkdir(parents=True, exist_ok=True)

    def persist(self, state: WorldState) -> Path:
        path = self._dir / f"{state.state_id}.json"
        path.write_text(json.dumps(state.to_dict(), indent=2), encoding="utf-8")
        return path

    def load(self, state_id: str) -> WorldState | None:
        path = self._dir / f"{state_id}.json"
        if not path.exists():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        return WorldState.from_dict(data)

    def list_states(self) -> list[WorldState]:
        results: list[WorldState] = []
        for path in sorted(self._dir.glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            results.append(WorldState.from_dict(data))
        return results
