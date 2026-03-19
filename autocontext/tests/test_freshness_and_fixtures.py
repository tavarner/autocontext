"""Tests for AC-326 + AC-328: evidence freshness/decay and friction→regression fixtures.

AC-326: EvidenceFreshness, FreshnessPolicy, apply_freshness_decay, detect_stale_context
AC-328: RegressionFixture, generate_fixtures_from_friction, FixtureStore
"""

from __future__ import annotations

from pathlib import Path

# ===========================================================================
# AC-326: EvidenceFreshness
# ===========================================================================


class TestEvidenceFreshness:
    def test_construction(self) -> None:
        from autocontext.knowledge.evidence_freshness import EvidenceFreshness

        f = EvidenceFreshness(
            item_id="lesson-1",
            support_count=3,
            last_validated_gen=5,
            confidence=0.85,
            created_at_gen=1,
        )
        assert f.support_count == 3
        assert f.confidence == 0.85

    def test_age(self) -> None:
        from autocontext.knowledge.evidence_freshness import EvidenceFreshness

        f = EvidenceFreshness(item_id="x", support_count=1, last_validated_gen=3, confidence=0.9, created_at_gen=1)
        assert f.age(current_gen=8) == 5  # 8 - 3

    def test_roundtrip(self) -> None:
        from autocontext.knowledge.evidence_freshness import EvidenceFreshness

        f = EvidenceFreshness(item_id="y", support_count=2, last_validated_gen=4, confidence=0.7, created_at_gen=2)
        d = f.to_dict()
        restored = EvidenceFreshness.from_dict(d)
        assert restored.item_id == "y"
        assert restored.last_validated_gen == 4


# ===========================================================================
# AC-326: FreshnessPolicy + apply_freshness_decay
# ===========================================================================


class TestFreshnessPolicy:
    def test_defaults(self) -> None:
        from autocontext.knowledge.evidence_freshness import FreshnessPolicy

        p = FreshnessPolicy()
        assert p.max_age_gens > 0
        assert p.min_confidence > 0

    def test_custom(self) -> None:
        from autocontext.knowledge.evidence_freshness import FreshnessPolicy

        p = FreshnessPolicy(max_age_gens=5, min_confidence=0.6, min_support=2)
        assert p.max_age_gens == 5


class TestApplyFreshnessDecay:
    def test_fresh_items_kept(self) -> None:
        from autocontext.knowledge.evidence_freshness import (
            EvidenceFreshness,
            FreshnessPolicy,
            apply_freshness_decay,
        )

        items = [
            EvidenceFreshness("a", support_count=3, last_validated_gen=9, confidence=0.9, created_at_gen=1),
            EvidenceFreshness("b", support_count=2, last_validated_gen=8, confidence=0.8, created_at_gen=2),
        ]
        policy = FreshnessPolicy(max_age_gens=5, min_confidence=0.5, min_support=1)
        active, stale = apply_freshness_decay(items, current_gen=10, policy=policy)
        assert len(active) == 2
        assert len(stale) == 0

    def test_old_items_decayed(self) -> None:
        from autocontext.knowledge.evidence_freshness import (
            EvidenceFreshness,
            FreshnessPolicy,
            apply_freshness_decay,
        )

        items = [
            EvidenceFreshness("fresh", support_count=3, last_validated_gen=9, confidence=0.9, created_at_gen=1),
            EvidenceFreshness("stale", support_count=1, last_validated_gen=2, confidence=0.4, created_at_gen=1),
        ]
        policy = FreshnessPolicy(max_age_gens=5, min_confidence=0.5, min_support=1)
        active, stale = apply_freshness_decay(items, current_gen=10, policy=policy)
        assert len(active) == 1
        assert len(stale) == 1
        assert stale[0].item_id == "stale"

    def test_low_support_decayed(self) -> None:
        from autocontext.knowledge.evidence_freshness import (
            EvidenceFreshness,
            FreshnessPolicy,
            apply_freshness_decay,
        )

        items = [
            EvidenceFreshness("weak", support_count=0, last_validated_gen=9, confidence=0.3, created_at_gen=9),
        ]
        policy = FreshnessPolicy(min_confidence=0.5, min_support=1)
        active, stale = apply_freshness_decay(items, current_gen=10, policy=policy)
        assert len(stale) == 1


class TestDetectStaleContext:
    def test_detects_stale(self) -> None:
        from autocontext.knowledge.evidence_freshness import (
            EvidenceFreshness,
            FreshnessPolicy,
            detect_stale_context,
        )

        items = [
            EvidenceFreshness("old", support_count=1, last_validated_gen=1, confidence=0.3, created_at_gen=1),
        ]
        warnings = detect_stale_context(items, current_gen=10, policy=FreshnessPolicy())
        assert len(warnings) > 0
        assert "old" in warnings[0].lower()

    def test_no_warnings_for_fresh(self) -> None:
        from autocontext.knowledge.evidence_freshness import (
            EvidenceFreshness,
            FreshnessPolicy,
            detect_stale_context,
        )

        items = [
            EvidenceFreshness("fresh", support_count=5, last_validated_gen=9, confidence=0.95, created_at_gen=1),
        ]
        warnings = detect_stale_context(items, current_gen=10, policy=FreshnessPolicy())
        assert len(warnings) == 0


# ===========================================================================
# AC-328: RegressionFixture
# ===========================================================================


class TestRegressionFixture:
    def test_construction(self) -> None:
        from autocontext.analytics.regression_fixtures import RegressionFixture

        fix = RegressionFixture(
            fixture_id="fix-1",
            scenario="grid_ctf",
            description="Regression on high-aggression strategies",
            seed=42,
            strategy={"aggression": 0.9},
            expected_min_score=0.6,
            source_evidence=["friction:validation_failure:gen3"],
            confidence=0.8,
        )
        assert fix.fixture_id == "fix-1"
        assert fix.expected_min_score == 0.6

    def test_roundtrip(self) -> None:
        from autocontext.analytics.regression_fixtures import RegressionFixture

        fix = RegressionFixture(
            fixture_id="fix-2", scenario="othello",
            description="Corner control regression",
            seed=100, strategy={"x": 1},
            expected_min_score=0.5,
            source_evidence=["cluster:rollback_pattern"],
            confidence=0.7,
        )
        d = fix.to_dict()
        restored = RegressionFixture.from_dict(d)
        assert restored.fixture_id == "fix-2"
        assert restored.source_evidence == ["cluster:rollback_pattern"]


# ===========================================================================
# AC-328: generate_fixtures_from_friction
# ===========================================================================


class TestGenerateFixturesFromFriction:
    def test_generates_from_clusters(self) -> None:
        from autocontext.analytics.regression_fixtures import generate_fixtures_from_friction

        clusters = [
            {
                "pattern": "validation_failure",
                "count": 3,
                "generations": [2, 4, 6],
                "description": "Repeated validation failures on high aggression",
            },
            {
                "pattern": "rollback",
                "count": 2,
                "generations": [3, 5],
                "description": "Rollbacks after low defense strategies",
            },
        ]
        fixtures = generate_fixtures_from_friction(
            clusters, scenario="grid_ctf", min_occurrences=2,
        )
        assert len(fixtures) >= 1
        assert all(f.scenario == "grid_ctf" for f in fixtures)

    def test_filters_low_count(self) -> None:
        from autocontext.analytics.regression_fixtures import generate_fixtures_from_friction

        clusters = [
            {"pattern": "rare", "count": 1, "generations": [1], "description": "Happened once"},
        ]
        fixtures = generate_fixtures_from_friction(clusters, scenario="test", min_occurrences=2)
        assert len(fixtures) == 0

    def test_empty_clusters(self) -> None:
        from autocontext.analytics.regression_fixtures import generate_fixtures_from_friction

        assert generate_fixtures_from_friction([], scenario="test") == []


# ===========================================================================
# AC-328: FixtureStore
# ===========================================================================


class TestFixtureStore:
    def test_persist_and_load(self, tmp_path: Path) -> None:
        from autocontext.analytics.regression_fixtures import FixtureStore, RegressionFixture

        store = FixtureStore(tmp_path)
        fix = RegressionFixture(
            fixture_id="fix-store", scenario="grid_ctf",
            description="test", seed=1, strategy={},
            expected_min_score=0.5, source_evidence=["ev"],
            confidence=0.8,
        )
        store.persist(fix)
        loaded = store.load("fix-store")
        assert loaded is not None
        assert loaded.scenario == "grid_ctf"

    def test_load_missing(self, tmp_path: Path) -> None:
        from autocontext.analytics.regression_fixtures import FixtureStore

        store = FixtureStore(tmp_path)
        assert store.load("nonexistent") is None

    def test_list_for_scenario(self, tmp_path: Path) -> None:
        from autocontext.analytics.regression_fixtures import FixtureStore, RegressionFixture

        store = FixtureStore(tmp_path)
        store.persist(RegressionFixture("f1", "grid_ctf", "d", 1, {}, 0.5, [], 0.8))
        store.persist(RegressionFixture("f2", "grid_ctf", "d", 2, {}, 0.5, [], 0.8))
        store.persist(RegressionFixture("f3", "othello", "d", 3, {}, 0.5, [], 0.8))

        grid_fixtures = store.list_for_scenario("grid_ctf")
        assert len(grid_fixtures) == 2
