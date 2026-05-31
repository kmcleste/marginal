"""
Routes each state to the cheapest sufficient extraction tier.
Reads tier hints from state_registry.json; escalates on failure.
"""

from __future__ import annotations

import json
from pathlib import Path

REGISTRY_PATH = Path(__file__).parent.parent / "sources" / "state_registry.json"


def get_tier_hint(state_code: str) -> int:
    registry = json.loads(REGISTRY_PATH.read_text())
    entry = registry.get(state_code, {})
    return entry.get("tierHint", 2)


def is_no_income_tax(state_code: str) -> bool:
    registry = json.loads(REGISTRY_PATH.read_text())
    entry = registry.get(state_code, {})
    return entry.get("noIncomeTax", False)


def escalate_tier(current_tier: int) -> int | None:
    """Return next tier to try, or None if already at max."""
    return current_tier + 1 if current_tier < 4 else None
