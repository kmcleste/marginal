"""
Structural sanity checks run after extraction.
These catch schema-level issues that the Pydantic model alone won't catch
(e.g., rates that are technically valid but suspiciously high/low).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..models.tax_schema import StateTaxData, BracketSchedule


@dataclass
class SanityResult:
    state_code: str
    passed: bool
    failures: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


MAX_RATE = 0.15          # No US state has income tax > ~13.3%; flag above 15%
MIN_STD_DEDUCTION = 0   # Some states have no standard deduction (valid)
MAX_STD_DEDUCTION = 35000


def check_brackets(schedule: BracketSchedule, label: str) -> list[str]:
    issues = []
    for i, b in enumerate(schedule.brackets):
        if b.rate > MAX_RATE:
            issues.append(f"{label} bracket[{i}] rate {b.rate:.4f} exceeds {MAX_RATE:.0%}")
        if b.rate < 0:
            issues.append(f"{label} bracket[{i}] rate {b.rate} is negative")
    if schedule.standard_deduction > MAX_STD_DEDUCTION:
        issues.append(f"{label} standard deduction {schedule.standard_deduction} seems too large")
    return issues


def run_sanity_checks(data: StateTaxData) -> SanityResult:
    failures = []
    warnings = []

    if data.flat_rate is not None and data.flat_rate > MAX_RATE:
        failures.append(f"Flat rate {data.flat_rate:.4f} exceeds {MAX_RATE:.0%}")

    if data.single:
        failures.extend(check_brackets(data.single, "single"))

    if data.mfj:
        failures.extend(check_brackets(data.mfj, "mfj"))

    if data.capital_gains_rate is not None and data.capital_gains_rate > 0.10:
        warnings.append(f"Capital gains rate {data.capital_gains_rate:.4f} is high; verify")

    return SanityResult(
        state_code=data.state_code,
        passed=len(failures) == 0,
        failures=failures,
        warnings=warnings,
    )
