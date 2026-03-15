"""Aggregate analysis pipeline runner (AC-258 + AC-257).

Orchestrates the full pipeline: load facets → cluster → correlate →
persist correlation → generate issues/probes → dedup → persist.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from autocontext.analytics.clustering import PatternClusterer
from autocontext.analytics.correlation import (
    CorrelationResult,
    CorrelationStore,
    ReleaseContext,
    SignalCorrelator,
)
from autocontext.analytics.issue_generator import (
    IssueCandidate,
    IssueGenerator,
    ProbeCandidate,
    ThresholdConfig,
)
from autocontext.analytics.issue_store import IssueStore
from autocontext.analytics.store import FacetStore


@dataclass(slots=True)
class AggregateResult:
    """Result of a full aggregate analysis pipeline run."""

    correlation: CorrelationResult
    issues: list[IssueCandidate] = field(default_factory=list)
    probes: list[ProbeCandidate] = field(default_factory=list)


class AggregateRunner:
    """Runs the full aggregate analysis pipeline end-to-end."""

    def __init__(
        self,
        facet_store: FacetStore,
        correlation_store: CorrelationStore,
        issue_store: IssueStore,
    ) -> None:
        self._facet_store = facet_store
        self._correlation_store = correlation_store
        self._issue_store = issue_store

    def run(
        self,
        release_context: list[ReleaseContext] | None = None,
        threshold_config: ThresholdConfig | None = None,
    ) -> AggregateResult:
        releases = release_context or []
        config = threshold_config or ThresholdConfig()

        # 1. Load all facets
        facets = self._facet_store.list_facets()

        # 2. Cluster friction and delight
        clusterer = PatternClusterer()
        friction_clusters = clusterer.cluster_friction(facets)
        delight_clusters = clusterer.cluster_delight(facets)
        all_clusters = friction_clusters + delight_clusters

        # 3. Correlate
        correlator = SignalCorrelator()
        correlation = correlator.correlate(facets, all_clusters, releases)

        # 4. Persist correlation
        self._correlation_store.persist(correlation)

        # 5. Generate issues/probes
        generator = IssueGenerator(config)
        candidates, probes = generator.generate(all_clusters, correlation)

        # 6. Dedup by signal type (cluster IDs are non-deterministic across runs)
        new_issues: list[IssueCandidate] = []
        for candidate in candidates:
            # Extract primary signal type from title pattern "Recurring <type> across ..."
            signal_type = candidate.title.split(" across ")[0].replace("Recurring ", "")
            if not self._issue_store.has_issue_for_signal_type(signal_type):
                self._issue_store.persist_issue(candidate)
                new_issues.append(candidate)

        new_probes: list[ProbeCandidate] = []
        for probe in probes:
            if not self._issue_store.has_probe_for_signal_type(probe.target_friction_type):
                self._issue_store.persist_probe(probe)
                new_probes.append(probe)

        return AggregateResult(
            correlation=correlation,
            issues=new_issues,
            probes=new_probes,
        )
