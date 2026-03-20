"""ASCII banner for autocontext CLI and terminal surfaces.

The banner art uses the figlet 'Colossal' style, chosen for its organic,
flowing character that evokes the iterative convergence at the heart of
autocontext.  Inspired by the energy and composition of Hermes Fly.

Author: greyhaven-ai / autocontext contributors
"""

from __future__ import annotations

from pathlib import Path

BANNER_ART = r"""
                          .                                                 .                             .
                        .o8                                               .o8                           .o8
 .oooo.   oooo  oooo  .o888oo  .ooooo.   .ooooo.   .ooooo.  ooo. .oo.   .o888oo  .ooooo.  oooo    ooo .o888oo
`P  )88b  `888  `888    888   d88' `88b d88' `"Y8 d88' `88b `888P"Y88b    888   d88' `88b  `88b..8P'    888
 .oP"888   888   888    888   888   888 888       888   888  888   888    888   888ooo888    Y888'      888
d8(  888   888   888    888 . 888   888 888   .o8 888   888  888   888    888 . 888    .o  .o8"'88b     888 .
`Y888""8o  `V88V"V8P'   "888" `Y8bod8P' `Y8bod8P' `Y8bod8P' o888o o888o   "888" `Y8bod8P' o88'   888o   "888"
""".strip("\n")

TAGLINE = "closed-loop control plane for agent improvement"

# ── What's new ───────────────────────────────────────────────────────
# Maintain this list when cutting releases.  Each entry is a single
# line shown in the CLI welcome box.  Keep it short — three to five
# items for the *current* version; archive older entries in CHANGELOG.md.

WHATS_NEW: list[str] = [
    "GEPA-inspired ASI/Pareto optimizer wired into improvement loop",
    "Component sensitivity profiling and credit assignment",
    "Pluggable scoring backends with Elo and Glicko support",
    "Novelty exploration and multi-basin playbook branching",
    "Cost-aware loop control and long-run presets",
]


def banner_plain() -> str:
    """Return the full banner as plain text (no ANSI escapes)."""
    return f"{BANNER_ART}\n\n  {TAGLINE}\n"


def print_banner_rich() -> None:
    """Print the banner with Rich styling to the terminal."""
    from rich.console import Console
    from rich.panel import Panel
    from rich.text import Text

    from autocontext import __version__

    console = Console(stderr=True)

    art = Text(BANNER_ART)
    art.stylize("bold cyan")

    console.print()
    console.print(art)
    console.print()
    console.print(f"  [dim]{TAGLINE}[/dim]")
    console.print()

    # ── What's new panel ─────────────────────────────────────────────
    if WHATS_NEW:
        lines = Text()
        for item in WHATS_NEW:
            lines.append("  + ", style="bold green")
            lines.append(f"{item}\n", style="default")

        panel = Panel(
            lines,
            title=f"[bold]What's new in v{__version__}[/bold]",
            title_align="left",
            border_style="dim",
            padding=(0, 1),
        )
        console.print(panel)
        console.print()


def get_banner_path() -> Path:
    """Return the path to the plain-text banner asset file."""
    return Path(__file__).resolve().parent.parent.parent / "assets" / "banner.txt"
