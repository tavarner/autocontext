"""Tests for AC-331: CLI exits should print errors in non-JSON mode.

Verifies that autoctx run prints exceptions to stderr instead of
exiting silently when --json is not passed.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from typer.testing import CliRunner

from autocontext.cli import app

runner = CliRunner()


class TestCliErrorOutput:
    def test_run_error_printed_in_non_json_mode(self) -> None:
        """AC-331: Non-JSON mode should print the error, not exit silently."""
        with (
            patch.dict("autocontext.cli.SCENARIO_REGISTRY", {"test_scenario": object}, clear=True),
            patch(
                "autocontext.scenarios.families.detect_family",
                return_value=None,
            ),
            patch("autocontext.cli._apply_preset_env"),
            patch("autocontext.cli.load_settings", return_value=MagicMock()),
            patch("autocontext.cli._runner", side_effect=RuntimeError("Something broke")),
        ):
            result = runner.invoke(app, ["run", "--scenario", "test_scenario", "--gens", "1"])

        assert result.exit_code == 1
        # The error message should appear somewhere in the output
        combined = (result.stdout or "") + (result.stderr or "") + (result.output or "")
        assert "Something broke" in combined, (
            f"Error message not printed. stdout={result.stdout!r}, stderr={result.stderr!r}"
        )

    def test_run_interrupt_printed_in_non_json_mode(self) -> None:
        """Keyboard interrupts should also produce visible output."""
        with (
            patch.dict("autocontext.cli.SCENARIO_REGISTRY", {"test_scenario": object}, clear=True),
            patch(
                "autocontext.scenarios.families.detect_family",
                return_value=None,
            ),
            patch("autocontext.cli._apply_preset_env"),
            patch("autocontext.cli.load_settings", return_value=MagicMock()),
            patch("autocontext.cli._runner", side_effect=KeyboardInterrupt()),
        ):
            result = runner.invoke(app, ["run", "--scenario", "test_scenario", "--gens", "1"])

        assert result.exit_code == 1
        combined = (result.stdout or "") + (result.stderr or "") + (result.output or "")
        assert "interrupt" in combined.lower(), (
            f"Interrupt message not printed. stdout={result.stdout!r}"
        )

    def test_json_mode_still_writes_to_stderr(self) -> None:
        """JSON mode should continue writing errors to stderr."""
        with (
            patch.dict("autocontext.cli.SCENARIO_REGISTRY", {"test_scenario": object}, clear=True),
            patch(
                "autocontext.scenarios.families.detect_family",
                return_value=None,
            ),
            patch("autocontext.cli._apply_preset_env"),
            patch("autocontext.cli.load_settings", return_value=MagicMock()),
            patch("autocontext.cli._runner", side_effect=RuntimeError("JSON error")),
        ):
            result = runner.invoke(app, ["run", "--scenario", "test_scenario", "--gens", "1", "--json"])

        assert result.exit_code == 1
        combined = (result.stdout or "") + (result.stderr or "") + (result.output or "")
        assert "JSON error" in combined
