"""Per-brand calibration fixtures (DATA only). Register new brands here."""
from . import mg_maroc, technopark

# name → fixture module. Adding a brand = adding a fixture + an entry here.
REGISTRY = {
    "mg": mg_maroc,
    "mg_maroc": mg_maroc,
    "technopark": technopark,
}


def get(name):
    key = name.strip().lower()
    if key not in REGISTRY:
        raise SystemExit(f"[fixtures] marque inconnue: {name!r}. Connues: {sorted(set(REGISTRY))}")
    return REGISTRY[key]
