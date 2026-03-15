"""Persistence for issue and probe candidates (AC-257).

Stores IssueCandidate and ProbeCandidate artifacts as JSON files,
supporting dedup via has_issue_for_cluster.
"""

from __future__ import annotations

import json
from pathlib import Path

from autocontext.analytics.issue_generator import IssueCandidate, ProbeCandidate


class IssueStore:
    """Persists and queries issue/probe candidate artifacts."""

    def __init__(self, root: Path) -> None:
        self._issues_dir = root / "issues"
        self._probes_dir = root / "probes"
        self._issues_dir.mkdir(parents=True, exist_ok=True)
        self._probes_dir.mkdir(parents=True, exist_ok=True)

    def persist_issue(self, candidate: IssueCandidate) -> Path:
        path = self._issues_dir / f"{candidate.candidate_id}.json"
        path.write_text(json.dumps(candidate.to_dict(), indent=2), encoding="utf-8")
        return path

    def persist_probe(self, probe: ProbeCandidate) -> Path:
        path = self._probes_dir / f"{probe.candidate_id}.json"
        path.write_text(json.dumps(probe.to_dict(), indent=2), encoding="utf-8")
        return path

    def load_issue(self, candidate_id: str) -> IssueCandidate | None:
        path = self._issues_dir / f"{candidate_id}.json"
        if not path.exists():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        return IssueCandidate.from_dict(data)

    def load_probe(self, candidate_id: str) -> ProbeCandidate | None:
        path = self._probes_dir / f"{candidate_id}.json"
        if not path.exists():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        return ProbeCandidate.from_dict(data)

    def list_issues(self) -> list[IssueCandidate]:
        results: list[IssueCandidate] = []
        for path in sorted(self._issues_dir.glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            results.append(IssueCandidate.from_dict(data))
        return results

    def list_probes(self) -> list[ProbeCandidate]:
        results: list[ProbeCandidate] = []
        for path in sorted(self._probes_dir.glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            results.append(ProbeCandidate.from_dict(data))
        return results

    def has_issue_for_cluster(self, cluster_id: str) -> bool:
        """Check if any persisted issue references the given cluster."""
        for issue in self.list_issues():
            if cluster_id in issue.source_cluster_ids:
                return True
        return False

    def has_issue_for_signal_type(self, signal_type: str) -> bool:
        """Check if any persisted issue already covers the given friction type."""
        for issue in self.list_issues():
            if signal_type in issue.title:
                return True
        return False

    def has_probe_for_signal_type(self, signal_type: str) -> bool:
        """Check if any persisted probe already covers the given friction type."""
        for probe in self.list_probes():
            if probe.target_friction_type == signal_type:
                return True
        return False
