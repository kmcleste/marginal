"""
Generates a human-readable diff of tax data changes between two years.
Used to populate the body of the annual update PR.
"""

from __future__ import annotations

import json
from pathlib import Path


def load_states(path: str) -> dict:
    return json.loads(Path(path).read_text())


def format_rate(val) -> str:
    if isinstance(val, float):
        return f"{val:.4f} ({val * 100:.2f}%)"
    return str(val)


def diff_states(old: dict, new: dict) -> str:
    lines = ["# Tax Data Diff\n"]
    all_states = sorted(set(old.keys()) | set(new.keys()) - {"_meta"})

    added = [s for s in all_states if s not in old and s != "_meta"]
    removed = [s for s in all_states if s not in new and s != "_meta"]
    changed = []

    for state in all_states:
        if state in ("_meta",) or state not in old or state not in new:
            continue
        if old[state] != new[state]:
            changed.append(state)

    if added:
        lines.append(f"## Added States: {', '.join(added)}\n")
    if removed:
        lines.append(f"## Removed States: {', '.join(removed)}\n")

    if changed:
        lines.append("## Changed States\n")
        for state in changed:
            lines.append(f"### {state}\n")
            o, n = old[state], new[state]

            def show_diff(key, old_val, new_val, indent=""):
                if old_val != new_val:
                    lines.append(f"{indent}- **{key}:** `{format_rate(old_val)}` → `{format_rate(new_val)}`")

            for key in set(o.keys()) | set(n.keys()):
                show_diff(key, o.get(key), n.get(key))
            lines.append("")

    if not added and not removed and not changed:
        lines.append("_No changes detected._\n")

    return "\n".join(lines)


def generate_diff_report(old_path: str, new_path: str, output_path: str):
    old = load_states(old_path)
    new = load_states(new_path)
    report = diff_states(old, new)
    Path(output_path).write_text(report)
    print(f"Diff report written to {output_path}")


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 4:
        print("Usage: diff_reporter.py <old.json> <new.json> --output <out.md>")
        sys.exit(1)
    generate_diff_report(sys.argv[1], sys.argv[2], sys.argv[4])
