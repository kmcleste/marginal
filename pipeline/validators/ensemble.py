"""
Ensemble validator: compares N extractions for the same state,
applies confidence-weighted acceptance policy.

Comparison is purely programmatic — no LLM in this step.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..models.tax_schema import StateTaxData, ExtractionResult, EnsembleResult


def normalize_for_comparison(data: StateTaxData) -> dict:
    """Round rates to 4 decimal places to avoid float noise."""
    raw = data.model_dump(exclude={"confidence", "notes", "extraction_tier", "source_url"})

    def round_rates(obj):
        if isinstance(obj, dict):
            return {k: round_rates(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [round_rates(x) for x in obj]
        if isinstance(obj, float):
            return round(obj, 4)
        return obj

    return round_rates(raw)


def find_divergent_fields(
    extractions: list[dict],
) -> tuple[list[str], dict[str, list]]:
    """Return which fields disagree and what values were seen."""
    if not extractions:
        return [], {}

    reference = extractions[0]
    divergent: list[str] = []
    candidates: dict[str, list] = {}

    def compare(ref, others, path=""):
        if isinstance(ref, dict):
            for k in ref:
                compare(ref[k], [o.get(k) for o in others], f"{path}.{k}" if path else k)
        elif isinstance(ref, list):
            if any(o != ref for o in others):
                divergent.append(path)
                candidates[path] = [ref] + others
        else:
            if any(o != ref for o in others):
                divergent.append(path)
                candidates[path] = [ref] + others

    compare(reference, extractions[1:])
    return divergent, candidates


def run_ensemble(results: list[ExtractionResult]) -> EnsembleResult:
    successful = [r for r in results if r.success and r.data is not None]
    state_code = results[0].data.state_code if results and results[0].data else "UNKNOWN"

    if not successful:
        return EnsembleResult(
            state_code=state_code,
            accepted=False,
            confidence=0.0,
            requires_human_review=True,
            notes="All extractions failed",
        )

    normalized = [normalize_for_comparison(r.data) for r in successful]  # type: ignore
    divergent, candidates = find_divergent_fields(normalized)

    n = len(successful)
    all_agree = len(divergent) == 0

    # Acceptance policy (PR-7)
    if all_agree:
        tiers_used = {r.extraction_tier for r in successful}
        if len(tiers_used) > 1:
            confidence = 0.95  # multi-tier unanimous
        elif n >= 3:
            confidence = 1.0   # multi-source unanimous
        else:
            confidence = 0.85  # single-source unanimous — spot-check flag
        return EnsembleResult(
            state_code=state_code,
            accepted=True,
            confidence=confidence,
            data=successful[0].data,
            requires_human_review=(confidence < 0.90),
            divergent_fields=[],
        )

    # Majority not unanimous → human review
    return EnsembleResult(
        state_code=state_code,
        accepted=False,
        confidence=0.0,
        requires_human_review=True,
        divergent_fields=divergent,
        candidate_values=candidates,
        notes=f"{len(divergent)} field(s) disagreed across {n} extractions",
    )
