"""Tests for AC-280: generated revise_output actually revises instead of no-op.

Covers: build_revision_prompt (pure function), generated revise_output template,
ImprovementLoop unchanged_output prevention.
"""

from __future__ import annotations

# ===========================================================================
# build_revision_prompt — pure function tests
# ===========================================================================


class TestBuildRevisionPrompt:
    def test_includes_original_output(self) -> None:
        from autocontext.scenarios.agent_task import AgentTaskResult
        from autocontext.scenarios.custom.agent_task_revision import build_revision_prompt

        result = AgentTaskResult(
            score=0.65, reasoning="Good structure but lacks depth",
            dimension_scores={"accuracy": 0.8, "depth": 0.4},
        )
        prompt = build_revision_prompt(
            original_output="A brief analysis of the topic.",
            judge_result=result,
            task_prompt="Write a deep analysis.",
        )
        assert "A brief analysis of the topic." in prompt

    def test_includes_judge_reasoning(self) -> None:
        from autocontext.scenarios.agent_task import AgentTaskResult
        from autocontext.scenarios.custom.agent_task_revision import build_revision_prompt

        result = AgentTaskResult(
            score=0.5, reasoning="Missing concrete examples",
            dimension_scores={},
        )
        prompt = build_revision_prompt(
            original_output="Some output",
            judge_result=result,
            task_prompt="Write with examples.",
        )
        assert "Missing concrete examples" in prompt

    def test_includes_weak_dimensions(self) -> None:
        from autocontext.scenarios.agent_task import AgentTaskResult
        from autocontext.scenarios.custom.agent_task_revision import build_revision_prompt

        result = AgentTaskResult(
            score=0.6,
            reasoning="Weak on depth and evidence",
            dimension_scores={"clarity": 0.9, "depth": 0.3, "evidence": 0.4},
        )
        prompt = build_revision_prompt(
            original_output="output",
            judge_result=result,
            task_prompt="Task prompt.",
        )
        # Should mention weak dimensions (< 0.7)
        assert "depth" in prompt.lower()
        assert "evidence" in prompt.lower()

    def test_includes_revision_prompt_when_provided(self) -> None:
        from autocontext.scenarios.agent_task import AgentTaskResult
        from autocontext.scenarios.custom.agent_task_revision import build_revision_prompt

        result = AgentTaskResult(score=0.7, reasoning="ok", dimension_scores={})
        prompt = build_revision_prompt(
            original_output="output",
            judge_result=result,
            task_prompt="Task.",
            revision_prompt="Focus on improving citations and evidence.",
        )
        assert "improving citations and evidence" in prompt

    def test_includes_task_prompt_when_no_revision_prompt(self) -> None:
        from autocontext.scenarios.agent_task import AgentTaskResult
        from autocontext.scenarios.custom.agent_task_revision import build_revision_prompt

        result = AgentTaskResult(score=0.5, reasoning="weak", dimension_scores={})
        prompt = build_revision_prompt(
            original_output="output",
            judge_result=result,
            task_prompt="Analyze drug interactions for safety.",
        )
        assert "drug interactions" in prompt.lower()

    def test_includes_score(self) -> None:
        from autocontext.scenarios.agent_task import AgentTaskResult
        from autocontext.scenarios.custom.agent_task_revision import build_revision_prompt

        result = AgentTaskResult(score=0.42, reasoning="needs work", dimension_scores={})
        prompt = build_revision_prompt(
            original_output="output",
            judge_result=result,
            task_prompt="Task.",
        )
        assert "0.42" in prompt

    def test_no_weak_dimensions_when_all_high(self) -> None:
        from autocontext.scenarios.agent_task import AgentTaskResult
        from autocontext.scenarios.custom.agent_task_revision import build_revision_prompt

        result = AgentTaskResult(
            score=0.85,
            reasoning="Good overall",
            dimension_scores={"clarity": 0.9, "depth": 0.85, "evidence": 0.8},
        )
        prompt = build_revision_prompt(
            original_output="output",
            judge_result=result,
            task_prompt="Task.",
        )
        # No "## Weak Dimensions" section should appear when all scores >= 0.7
        assert "## Weak Dimensions" not in prompt


# ===========================================================================
# Generated revise_output should NOT be a no-op
# ===========================================================================


class TestGeneratedReviseOutputTemplate:
    def test_generated_code_has_provider_call_in_revise_output(self) -> None:
        """The generated revise_output method should contain provider.complete()."""
        from autocontext.scenarios.custom.agent_task_codegen import generate_agent_task_class
        from autocontext.scenarios.custom.agent_task_spec import AgentTaskSpec

        spec = AgentTaskSpec(
            task_prompt="Write an essay.",
            judge_rubric="Evaluate essay quality.",
            max_rounds=3,
            revision_prompt="Improve depth and examples.",
        )
        source = generate_agent_task_class(spec, "essay_task")

        # The generated revise_output should call build_revision_prompt
        assert "build_revision_prompt" in source
        # Should call provider.complete
        assert "provider.complete" in source or "complete(" in source

    def test_generated_code_single_round_still_noop(self) -> None:
        """When max_rounds=1 and no revision_prompt, revise_output should still no-op."""
        from autocontext.scenarios.custom.agent_task_codegen import generate_agent_task_class
        from autocontext.scenarios.custom.agent_task_spec import AgentTaskSpec

        spec = AgentTaskSpec(
            task_prompt="Write a haiku.",
            judge_rubric="Evaluate haiku.",
            max_rounds=1,
            revision_prompt=None,
        )
        source = generate_agent_task_class(spec, "haiku_task")
        # Should still have the early-return guard for single-round no-revision tasks
        assert "return output" in source

    def test_generated_revise_output_imports_revision_module(self) -> None:
        """Generated code should import build_revision_prompt."""
        from autocontext.scenarios.custom.agent_task_codegen import generate_agent_task_class
        from autocontext.scenarios.custom.agent_task_spec import AgentTaskSpec

        spec = AgentTaskSpec(
            task_prompt="Analyze data.",
            judge_rubric="Evaluate analysis.",
            max_rounds=5,
        )
        source = generate_agent_task_class(spec, "analysis_task")
        assert "agent_task_revision" in source or "build_revision_prompt" in source
