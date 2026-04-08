"""AC-505: Harness mutation surface tests.

Tests typed mutation specs, parsing from architect output, versioned
persistence, gate evaluation, and prompt-assembly application.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

# ---------------------------------------------------------------------------
# Mutation spec model
# ---------------------------------------------------------------------------


class TestMutationSpec:
    def test_create_prompt_fragment(self) -> None:
        from autocontext.harness.mutations.spec import HarnessMutation, MutationType

        m = HarnessMutation(
            mutation_type=MutationType.PROMPT_FRAGMENT,
            target_role="competitor",
            content="Always verify edge cases before submitting",
            rationale="Edge cases caused 3 consecutive rollbacks",
        )
        assert m.mutation_type == MutationType.PROMPT_FRAGMENT
        assert m.target_role == "competitor"

    def test_create_context_policy(self) -> None:
        from autocontext.harness.mutations.spec import HarnessMutation, MutationType

        m = HarnessMutation(
            mutation_type=MutationType.CONTEXT_POLICY,
            component="trajectory",
            content="include_last_5",
            rationale="Full trajectory too verbose",
        )
        assert m.mutation_type == MutationType.CONTEXT_POLICY
        assert m.component == "trajectory"

    def test_create_completion_check(self) -> None:
        from autocontext.harness.mutations.spec import HarnessMutation, MutationType

        m = HarnessMutation(
            mutation_type=MutationType.COMPLETION_CHECK,
            content="Verify output contains valid JSON strategy",
            rationale="Invalid JSON caused 5 parse failures",
        )
        assert m.mutation_type == MutationType.COMPLETION_CHECK

    def test_create_tool_instruction(self) -> None:
        from autocontext.harness.mutations.spec import HarnessMutation, MutationType

        m = HarnessMutation(
            mutation_type=MutationType.TOOL_INSTRUCTION,
            tool_name="score_calculator",
            content="When using score_calculator, always pass normalized values",
            rationale="Raw values caused score overflow",
        )
        assert m.mutation_type == MutationType.TOOL_INSTRUCTION

    def test_to_dict_roundtrip(self) -> None:
        from autocontext.harness.mutations.spec import HarnessMutation, MutationType

        m = HarnessMutation(
            mutation_type=MutationType.PROMPT_FRAGMENT,
            target_role="analyst",
            content="Focus on root causes, not symptoms",
            rationale="Shallow analysis",
        )
        d = m.to_dict()
        restored = HarnessMutation.from_dict(d)
        assert restored.mutation_type == m.mutation_type
        assert restored.target_role == m.target_role
        assert restored.content == m.content

    def test_mutation_has_id(self) -> None:
        from autocontext.harness.mutations.spec import HarnessMutation, MutationType

        m = HarnessMutation(
            mutation_type=MutationType.PROMPT_FRAGMENT,
            content="test",
        )
        assert m.mutation_id
        assert isinstance(m.mutation_id, str)


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------


class TestMutationParser:
    def test_parse_mutations_from_architect_output(self) -> None:
        from autocontext.harness.mutations.parser import parse_mutations

        content = """Here is my analysis.

<!-- MUTATIONS_START -->
{"mutations": [
  {"type": "prompt_fragment", "target_role": "competitor", "content": "Check edge cases", "rationale": "rollbacks"},
  {"type": "completion_check", "content": "Verify JSON output", "rationale": "parse failures"}
]}
<!-- MUTATIONS_END -->

Other text here."""

        mutations = parse_mutations(content)
        assert len(mutations) == 2
        assert mutations[0].mutation_type.value == "prompt_fragment"
        assert mutations[1].mutation_type.value == "completion_check"

    def test_parse_returns_empty_for_no_markers(self) -> None:
        from autocontext.harness.mutations.parser import parse_mutations

        assert parse_mutations("No mutations here.") == []

    def test_parse_handles_malformed_json(self) -> None:
        from autocontext.harness.mutations.parser import parse_mutations

        content = "<!-- MUTATIONS_START -->\nnot json\n<!-- MUTATIONS_END -->"
        assert parse_mutations(content) == []

    def test_parse_skips_invalid_entries(self) -> None:
        from autocontext.harness.mutations.parser import parse_mutations

        content = """<!-- MUTATIONS_START -->
{"mutations": [
  {"type": "prompt_fragment", "content": "valid", "rationale": "ok"},
  {"type": "bogus_type", "content": "invalid"},
  {"content": "missing type"}
]}
<!-- MUTATIONS_END -->"""

        mutations = parse_mutations(content)
        assert len(mutations) == 1  # only the valid one


# ---------------------------------------------------------------------------
# Store
# ---------------------------------------------------------------------------


class TestMutationStore:
    def test_save_and_load(self) -> None:
        from autocontext.harness.mutations.spec import HarnessMutation, MutationType
        from autocontext.harness.mutations.store import MutationStore

        with tempfile.TemporaryDirectory() as tmp:
            store = MutationStore(root=Path(tmp))
            m = HarnessMutation(
                mutation_type=MutationType.PROMPT_FRAGMENT,
                content="test mutation",
                rationale="testing",
            )
            store.save("test_scenario", [m])
            loaded = store.load("test_scenario")
            assert len(loaded) == 1
            assert loaded[0].content == "test mutation"

    def test_load_returns_empty_for_missing(self) -> None:
        from autocontext.harness.mutations.store import MutationStore

        with tempfile.TemporaryDirectory() as tmp:
            store = MutationStore(root=Path(tmp))
            assert store.load("nonexistent") == []

    def test_versions_are_preserved(self) -> None:
        from autocontext.harness.mutations.spec import HarnessMutation, MutationType
        from autocontext.harness.mutations.store import MutationStore

        with tempfile.TemporaryDirectory() as tmp:
            store = MutationStore(root=Path(tmp))
            m1 = HarnessMutation(mutation_type=MutationType.PROMPT_FRAGMENT, content="v1")
            store.save("s", [m1])
            m2 = HarnessMutation(mutation_type=MutationType.PROMPT_FRAGMENT, content="v2")
            store.save("s", [m2])
            versions = store.list_versions("s")
            assert len(versions) >= 2

    def test_rollback_restores_previous(self) -> None:
        from autocontext.harness.mutations.spec import HarnessMutation, MutationType
        from autocontext.harness.mutations.store import MutationStore

        with tempfile.TemporaryDirectory() as tmp:
            store = MutationStore(root=Path(tmp))
            m1 = HarnessMutation(mutation_type=MutationType.PROMPT_FRAGMENT, content="original")
            store.save("s", [m1])
            m2 = HarnessMutation(mutation_type=MutationType.PROMPT_FRAGMENT, content="updated")
            store.save("s", [m2])
            store.rollback("s")
            loaded = store.load("s")
            assert loaded[0].content == "original"


# ---------------------------------------------------------------------------
# Gate
# ---------------------------------------------------------------------------


class TestMutationGate:
    def test_approve_valid_mutation(self) -> None:
        from autocontext.harness.mutations.gate import evaluate_mutation
        from autocontext.harness.mutations.spec import HarnessMutation, MutationType

        m = HarnessMutation(
            mutation_type=MutationType.PROMPT_FRAGMENT,
            target_role="competitor",
            content="Focus on defense parameters",
            rationale="Low defense scores",
        )
        result = evaluate_mutation(m)
        assert result.approved
        assert result.reason

    def test_reject_empty_content(self) -> None:
        from autocontext.harness.mutations.gate import evaluate_mutation
        from autocontext.harness.mutations.spec import HarnessMutation, MutationType

        m = HarnessMutation(
            mutation_type=MutationType.PROMPT_FRAGMENT,
            content="",
            rationale="empty",
        )
        result = evaluate_mutation(m)
        assert not result.approved

    def test_reject_oversized_content(self) -> None:
        from autocontext.harness.mutations.gate import evaluate_mutation
        from autocontext.harness.mutations.spec import HarnessMutation, MutationType

        m = HarnessMutation(
            mutation_type=MutationType.PROMPT_FRAGMENT,
            content="x" * 10_001,
            rationale="huge",
        )
        result = evaluate_mutation(m)
        assert not result.approved


# ---------------------------------------------------------------------------
# Applier
# ---------------------------------------------------------------------------


class TestMutationApplier:
    def test_apply_prompt_fragment_to_role(self) -> None:
        from autocontext.harness.mutations.applier import apply_mutations
        from autocontext.harness.mutations.spec import HarnessMutation, MutationType

        mutations = [
            HarnessMutation(
                mutation_type=MutationType.PROMPT_FRAGMENT,
                target_role="competitor",
                content="Always check edge cases",
            ),
        ]
        base_prompts = {"competitor": "Base prompt.", "analyst": "Analyst base."}
        result = apply_mutations(base_prompts, mutations)
        assert "Always check edge cases" in result["competitor"]
        assert result["analyst"] == "Analyst base."  # unchanged

    def test_apply_multiple_fragments(self) -> None:
        from autocontext.harness.mutations.applier import apply_mutations
        from autocontext.harness.mutations.spec import HarnessMutation, MutationType

        mutations = [
            HarnessMutation(mutation_type=MutationType.PROMPT_FRAGMENT, target_role="analyst", content="Fragment 1"),
            HarnessMutation(mutation_type=MutationType.PROMPT_FRAGMENT, target_role="analyst", content="Fragment 2"),
        ]
        result = apply_mutations({"analyst": "Base."}, mutations)
        assert "Fragment 1" in result["analyst"]
        assert "Fragment 2" in result["analyst"]

    def test_apply_skips_non_prompt_mutations(self) -> None:
        from autocontext.harness.mutations.applier import apply_mutations
        from autocontext.harness.mutations.spec import HarnessMutation, MutationType

        mutations = [
            HarnessMutation(mutation_type=MutationType.COMPLETION_CHECK, content="check JSON"),
            HarnessMutation(mutation_type=MutationType.CONTEXT_POLICY, content="include_last_5"),
        ]
        result = apply_mutations({"competitor": "Base."}, mutations)
        assert result["competitor"] == "Base."  # non-prompt mutations don't modify prompts

    def test_apply_empty_mutations(self) -> None:
        from autocontext.harness.mutations.applier import apply_mutations

        result = apply_mutations({"competitor": "Base."}, [])
        assert result["competitor"] == "Base."

    def test_get_active_completion_checks(self) -> None:
        from autocontext.harness.mutations.applier import get_active_completion_checks
        from autocontext.harness.mutations.spec import HarnessMutation, MutationType

        mutations = [
            HarnessMutation(mutation_type=MutationType.PROMPT_FRAGMENT, content="prompt"),
            HarnessMutation(mutation_type=MutationType.COMPLETION_CHECK, content="Check A"),
            HarnessMutation(mutation_type=MutationType.COMPLETION_CHECK, content="Check B"),
        ]
        checks = get_active_completion_checks(mutations)
        assert len(checks) == 2
        assert checks[0] == "Check A"
