"""
brand_extractor_service.py — Clarity Engine Brand Extraction v1
────────────────────────────────────────────────────────────────
Extracts structured brand fields from raw document text using DeepSeek.

Schema (v1):
  nom_marque, role_marque, master_statement, priorites_strategiques,
  territoires_narratifs, ton_marque, lignes_rouges, mots_a_privilegier,
  mots_a_eviter, audiences_cles, contexte_sectoriel, champs_manquants

The prompt is versioned in app/prompts/brand_system_extraction_prompt.py.
"""
import json
from typing import Any

from app.lib.deepseek import call_deepseek
from app.prompts.brand_system_extraction_prompt import (
    EXTRACTION_SYSTEM_PROMPT,
    EXTRACTION_VERSION,
)

# ─────────────────────────────────────────────────────────────────────────────
# Schema definition
# ─────────────────────────────────────────────────────────────────────────────

# Fields that must be plain strings
_STRING_FIELDS = [
    "nom_marque",
    "role_marque",
    "master_statement",
    "ton_marque",
    "contexte_sectoriel",
]

# Fields that must be arrays of strings
_ARRAY_FIELDS = [
    "priorites_strategiques",
    "territoires_narratifs",
    "lignes_rouges",
    "mots_a_privilegier",
    "mots_a_eviter",
    "audiences_cles",
    "champs_manquants",
]

_ALL_FIELDS = _STRING_FIELDS + _ARRAY_FIELDS

# ─────────────────────────────────────────────────────────────────────────────
# Validation & coercion
# ─────────────────────────────────────────────────────────────────────────────

def _coerce(raw: dict) -> dict:
    """
    Coerce the LLM output to the exact schema.
    - String fields: stringify if needed, default to ""
    - Array fields:  listify if needed (split strings by newline), default to []
    Does not raise — invalid values become safe defaults.
    """
    result: dict[str, Any] = {}

    for field in _STRING_FIELDS:
        val = raw.get(field, "")
        if isinstance(val, list):
            val = "\n".join(str(v) for v in val)
        result[field] = str(val) if val is not None else ""

    for field in _ARRAY_FIELDS:
        val = raw.get(field, [])
        if isinstance(val, str):
            # Model returned a string — split into list items
            val = [v.strip() for v in val.splitlines() if v.strip()]
        elif not isinstance(val, list):
            val = []
        result[field] = [str(item) for item in val]

    return result


def _validate(data: dict) -> None:
    """
    Raise ValueError if any required key is missing or has the wrong type.
    """
    missing_keys = [f for f in _ALL_FIELDS if f not in data]
    if missing_keys:
        raise ValueError(f"Missing keys in LLM response: {missing_keys}")

    for f in _STRING_FIELDS:
        if not isinstance(data[f], str):
            raise ValueError(f"Field '{f}' must be a string, got {type(data[f])}")

    for f in _ARRAY_FIELDS:
        if not isinstance(data[f], list):
            raise ValueError(f"Field '{f}' must be a list, got {type(data[f])}")


# ─────────────────────────────────────────────────────────────────────────────
# Repair prompt (single retry)
# ─────────────────────────────────────────────────────────────────────────────

_REPAIR_SUFFIX = """

---
Le JSON précédent était invalide ou incomplet.
Renvoie UNIQUEMENT un objet JSON valide respectant le schéma exact spécifié.
Tous les champs doivent être présents. Chaînes vides "" et tableaux vides [] si absent.
Pas de texte avant ni après."""


# ─────────────────────────────────────────────────────────────────────────────
# Public interface
# ─────────────────────────────────────────────────────────────────────────────

def extract_brand_fields(combined_text: str) -> dict:
    """
    Send combined document text to DeepSeek and extract structured brand fields.

    Returns a dict matching the v1 schema (all keys guaranteed present).
    Includes 'champs_manquants' listing fields the model left empty.
    Also returns 'extraction_version' for traceability.

    Raises:
        ValueError: if both attempts (initial + repair) fail to produce valid JSON.
    """
    # ── Input trimming ───────────────────────────────────────────────────────
    # Keep at most 20K chars (≈ 5K tokens) of the document.
    # Brand system data is almost always in the first/last pages.
    # Sending 80K chars is 4× slower for no accuracy gain on structured docs.
    MAX_CHARS = 20_000
    if len(combined_text) > MAX_CHARS:
        half = MAX_CHARS // 2
        combined_text = (
            combined_text[:half]
            + "\n\n[... section centrale omise ...]\n\n"
            + combined_text[-half:]
        )

    user_content = f"=== DOCUMENT(S) DE MARQUE ===\n\n{combined_text}"

    # Extraction output budget — a full brand system JSON is ~800-1500 tokens.
    # 1600 covers the largest real outputs with headroom while capping runaway
    # generation. (Was 8192.)
    EXTRACTION_MAX_TOKENS = 1600

    # ── Attempt 1: direct call ──────────────────────────────────────────────
    raw_text = ""
    try:
        raw_text = call_deepseek(
            system=EXTRACTION_SYSTEM_PROMPT,
            user=user_content,
            max_tokens=EXTRACTION_MAX_TOKENS,
        )
        data = json.loads(raw_text)
        data = _coerce(data)
        _validate(data)
        data["extraction_version"] = EXTRACTION_VERSION
        return data
    except Exception:
        pass  # fall through to repair attempt

    # ── Attempt 2: repair (ask model to fix its own JSON) ───────────────────
    repair_user = user_content + _REPAIR_SUFFIX
    try:
        raw_text = call_deepseek(
            system=EXTRACTION_SYSTEM_PROMPT,
            user=repair_user,
            max_tokens=EXTRACTION_MAX_TOKENS,
        )
        data = json.loads(raw_text)
        data = _coerce(data)
        _validate(data)
        data["extraction_version"] = EXTRACTION_VERSION
        return data
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Brand extraction failed: LLM returned invalid JSON after repair attempt. "
            f"Error: {exc}. Raw: {raw_text[:300]}"
        )
    except Exception as exc:
        raise ValueError(f"Brand extraction failed after repair: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# Field name mapping (new schema → legacy DB column names)
# Used by the route to persist data into the BrandSystem model.
# ─────────────────────────────────────────────────────────────────────────────

def map_to_db_fields(extracted: dict) -> dict:
    """
    Map the v1 extraction schema to the BrandSystem DB column names.
    Array fields are joined as bullet lists for storage.
    """
    def join_list(lst: list) -> str:
        return "\n".join(f"- {item}" for item in lst) if lst else ""

    return {
        "brand_name":      extracted.get("nom_marque", ""),
        "brand_role":      extracted.get("role_marque", ""),
        "master_statement": extracted.get("master_statement", ""),
        "priorities":      join_list(extracted.get("priorites_strategiques", [])),
        "territories":     join_list(extracted.get("territoires_narratifs", [])),
        "tone":            extracted.get("ton_marque", ""),
        "red_lines":       join_list(extracted.get("lignes_rouges", [])),
        "words_preferred": join_list(extracted.get("mots_a_privilegier", [])),
        "words_avoid":     join_list(extracted.get("mots_a_eviter", [])),
        "audiences":       join_list(extracted.get("audiences_cles", [])),
        "sector":          extracted.get("contexte_sectoriel", ""),
    }
