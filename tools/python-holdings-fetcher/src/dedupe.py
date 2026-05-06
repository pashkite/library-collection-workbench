from __future__ import annotations

from collections.abc import Iterable


def dedupe_holdings(rows: Iterable[dict]) -> tuple[list[dict], int]:
    seen: set[str] = set()
    deduped: list[dict] = []
    skipped = 0

    for row in rows:
        key = str(row.get("dedupeKey") or "")
        if not key:
            skipped += 1
            continue
        if key in seen:
            skipped += 1
            continue
        seen.add(key)
        deduped.append(row)

    return deduped, skipped
