"""
verify_analysis.py — Clarity Engine Production v1.0 Verification Script

Tests:
  1. validate_scores() correctly identifies passing and failing score integrity.
  2. _enforce_risk() correctly derives narrative_risk from scores.
  3. _validate() raises ValueError on score mismatch (triggering retry logic).
  4. _validate() raises ValueError when required fields are missing.
  5. _normalise() promotes legacy nested subscores to flat schema.
  6. Full SYSTEM_PROMPT structure is correct (BASE + CONTRACT are both present).
  7. Retry system prompts are distinct from the main one and from each other.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.brand_analysis_service import (
    _validate_scores,
    _enforce_risk,
    _validate,
    _normalise,
    REQUIRED_FIELDS,
    SYSTEM_PROMPT,
    _RETRY2_SYSTEM_PROMPT,
    _RETRY3_SYSTEM_PROMPT,
    _BASE_SYSTEM_PROMPT,
    _STRICT_OUTPUT_CONTRACT,
    _RETRY2_OVERRIDE,
    _RETRY3_OVERRIDE,
)

PASS = "[PASS]"
FAIL = "[FAIL]"
results = []


def check(name: str, condition: bool, detail: str = ""):
    status = PASS if condition else FAIL
    msg = f"{status} {name}"
    if detail:
        msg += f"\n   -> {detail}"
    print(msg)
    results.append(condition)


# ── 1. Score integrity — valid case ──────────────────────────────────────────
valid_data = {
    "clarity_score": 82,
    "sub_clarity": 17, "sub_alignment": 16, "sub_focus": 18,
    "sub_tone": 15, "sub_narrative_contribution": 16,
    "narrative_risk": "faible",
    "points_forts": ["A", "B"], "points_faibles": ["C", "D"],
    "recommandations": ["E", "F"],
    "rewritten_message": "Rewritten text here.",
}
check("validate_scores — passing (82 == 17+16+18+15+16)", _validate_scores(valid_data))

# ── 2. Score integrity — failing case ────────────────────────────────────────
bad_score_data = dict(valid_data, clarity_score=99)
check("validate_scores — failing (99 != 82)", not _validate_scores(bad_score_data))

# ── 3. _validate raises ValueError on score mismatch ─────────────────────────
try:
    _validate(bad_score_data)
    check("_validate raises ValueError on score mismatch", False, "No exception raised!")
except ValueError as e:
    check("_validate raises ValueError on score mismatch", True, str(e))

# ── 4. _validate raises ValueError on missing fields ─────────────────────────
incomplete = {"clarity_score": 82, "narrative_risk": "faible"}
try:
    _validate(incomplete)
    check("_validate raises ValueError on missing fields", False, "No exception raised!")
except ValueError as e:
    check("_validate raises ValueError on missing fields", True, str(e))

# ── 5. _validate raises ValueError on invalid narrative_risk ─────────────────
bad_risk = dict(valid_data, narrative_risk="unknown")
try:
    _validate(bad_risk)
    check("_validate raises ValueError on invalid narrative_risk", False, "No exception raised!")
except ValueError as e:
    check("_validate raises ValueError on invalid narrative_risk", True, str(e))

# ── 6. _enforce_risk — score < 50 → élevé ────────────────────────────────────
low = dict(valid_data, clarity_score=40, sub_clarity=8, sub_alignment=8, sub_focus=8, sub_tone=8, sub_narrative_contribution=8)
_enforce_risk(low)
check("_enforce_risk: score<50 → élevé", low["narrative_risk"] == "élevé", low["narrative_risk"])

# ── 7. _enforce_risk — sub-score ≤ 7 → élevé ─────────────────────────────────
critical_sub = dict(valid_data, sub_clarity=7)
_enforce_risk(critical_sub)
check("_enforce_risk: sub_score≤7 → élevé", critical_sub["narrative_risk"] == "élevé", critical_sub["narrative_risk"])

# ── 8. _enforce_risk — score 50–74 → modéré ──────────────────────────────────
mid = dict(valid_data, clarity_score=65, sub_clarity=13, sub_alignment=13, sub_focus=13, sub_tone=13, sub_narrative_contribution=13)
_enforce_risk(mid)
check("_enforce_risk: score 50–74 → modéré", mid["narrative_risk"] == "modéré", mid["narrative_risk"])

# ── 9. _enforce_risk — score ≥ 75, all subs ≥ 12 → faible ───────────────────
high = dict(valid_data)
_enforce_risk(high)
check("_enforce_risk: score≥75, all subs≥12 → faible", high["narrative_risk"] == "faible", high["narrative_risk"])

# ── 10. _normalise promotes legacy nested subscores ──────────────────────────
legacy = {
    "clarity_score": 80,
    "subscores": {
        "clarity": 16, "alignment": 16, "focus": 16, "tone": 16, "narrative_contribution": 16
    },
    "narrative_risk": "faible",
    "points_forts": ["A"], "points_faibles": ["B"],
    "recommandations": ["C"], "rewritten_message": "text",
}
normalised = _normalise(legacy)
check(
    "_normalise promotes legacy nested subscores to flat schema",
    normalised.get("sub_clarity") == 16 and "subscores" not in normalised,
    f"sub_clarity={normalised.get('sub_clarity')}, subscores key present={('subscores' in normalised)}"
)

# ── 11. REQUIRED_FIELDS includes rewritten_message ───────────────────────────
check(
    "REQUIRED_FIELDS includes 'rewritten_message'",
    "rewritten_message" in REQUIRED_FIELDS,
    f"REQUIRED_FIELDS = {REQUIRED_FIELDS}"
)

# ── 12. SYSTEM_PROMPT contains BASE and CONTRACT sections ────────────────────
check(
    "SYSTEM_PROMPT contains BASE section",
    "Clarté linguistique" in SYSTEM_PROMPT and "Contribution narrative" in SYSTEM_PROMPT,
)
check(
    "SYSTEM_PROMPT contains STRICT OUTPUT CONTRACT",
    "STRICT OUTPUT CONTRACT" in SYSTEM_PROMPT and "SELF-CHECK BEFORE OUTPUT" in SYSTEM_PROMPT,
)

# ── 13. Retry prompts are distinct ───────────────────────────────────────────
check(
    "Retry 2 system prompt differs from main system prompt",
    SYSTEM_PROMPT != _RETRY2_SYSTEM_PROMPT,
)
check(
    "Retry 3 system prompt differs from Retry 2 system prompt",
    _RETRY2_SYSTEM_PROMPT != _RETRY3_SYSTEM_PROMPT,
)

# ── 14. Retry 2 contains the reinforce-format override ───────────────────────
check(
    "Retry 2 system prompt contains format-reinforce instructions",
    "COULD NOT BE PARSED AS VALID JSON" in _RETRY2_SYSTEM_PROMPT,
)

# ── 15. Retry 3 contains the explicit schema example ─────────────────────────
check(
    "Retry 3 system prompt contains explicit schema example",
    "FAILED JSON VALIDATION TWICE" in _RETRY3_SYSTEM_PROMPT and "rewritten_message" in _RETRY3_SYSTEM_PROMPT,
)

# ── 16. Retry overrides do NOT contain the STRICT OUTPUT CONTRACT ─────────────
check(
    "Retry 2 system prompt does NOT contain STRICT OUTPUT CONTRACT section",
    "STRICT OUTPUT CONTRACT" not in _RETRY2_SYSTEM_PROMPT,
)
check(
    "Retry 3 system prompt does NOT contain STRICT OUTPUT CONTRACT section",
    "STRICT OUTPUT CONTRACT" not in _RETRY3_SYSTEM_PROMPT,
)

# ── Summary ───────────────────────────────────────────────────────────────────
print()
total = len(results)
passed = sum(results)
failed = total - passed
print(f"{'='*50}")
print(f"Results: {passed}/{total} passed  |  {failed} failed")
if failed == 0:
    print("[OK] All checks passed -- Production v1.0 integration verified!")
else:
    print("[WARN] Some checks failed -- review above output.")
    sys.exit(1)
