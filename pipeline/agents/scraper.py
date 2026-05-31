"""
Tier 1–2 extractor: structured API / clean HTML scrape.
Tier 1: known clean sources (Tax Foundation JSON, flat-rate states).
Tier 2: DOM scrape + regex normalization of clean HTML tables.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import httpx
from bs4 import BeautifulSoup


@dataclass
class ScrapeResult:
    url: str
    html: str
    tier: int
    success: bool
    error: str | None = None


def fetch_url(url: str, timeout: int = 30) -> ScrapeResult:
    try:
        r = httpx.get(url, timeout=timeout, follow_redirects=True, headers={
            "User-Agent": "Mozilla/5.0 (compatible; WealthKit-TaxPipeline/1.0)"
        })
        r.raise_for_status()
        return ScrapeResult(url=url, html=r.text, tier=2, success=True)
    except Exception as e:
        return ScrapeResult(url=url, html="", tier=2, success=False, error=str(e))


def extract_bracket_tables(html: str) -> list[list[list[str]]]:
    """Best-effort extraction of tabular data from HTML. Returns list of tables."""
    soup = BeautifulSoup(html, "html.parser")
    tables = []
    for table in soup.find_all("table"):
        rows = []
        for tr in table.find_all("tr"):
            row = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
            if row:
                rows.append(row)
        if rows:
            tables.append(rows)
    return tables


def normalize_rate(raw: str) -> float | None:
    """Parse '4.75%' or '0.0475' into 0.0475."""
    raw = raw.strip().rstrip("%")
    try:
        val = float(raw)
        return val / 100 if val > 1 else val
    except ValueError:
        return None


def normalize_dollar(raw: str) -> float | None:
    """Parse '$10,000' or '10000' into 10000.0."""
    cleaned = re.sub(r"[$,\s]", "", raw)
    try:
        return float(cleaned)
    except ValueError:
        return None
