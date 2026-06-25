"""
Central narrative-risk normalisation.

Storage/display has historically mixed English ("Low/Medium/High") and French
("faible/modéré/élevé") values. This module is the single source of truth that
maps any of them to the canonical English keys used across the API.
(French *display* labels remain the frontend's responsibility.)
"""

RISK_CANONICAL = ("Low", "Medium", "High")

_ALIASES = {
    "low": "Low", "faible": "Low",
    "medium": "Medium", "modere": "Medium",
    "high": "High", "eleve": "High",
}


def normalize_risk(value) -> str | None:
    """Map any stored/legacy risk value to canonical Low/Medium/High (or None)."""
    if not value:
        return None
    key = str(value).strip().lower().replace("é", "e")
    return _ALIASES.get(key)


def empty_risk_distribution() -> dict:
    """A zeroed distribution with the canonical keys."""
    return {k: 0 for k in RISK_CANONICAL}


def risk_distribution(values) -> dict:
    """Count an iterable of (possibly legacy) risk values into canonical buckets."""
    dist = empty_risk_distribution()
    for v in values:
        k = normalize_risk(v)
        if k:
            dist[k] += 1
    return dist
