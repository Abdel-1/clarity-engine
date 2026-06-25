#!/usr/bin/env python3
"""
Smoke test — confirm the non-thinking flag actually works on deepseek-v4-pro.

Makes two REAL one-shot analysis calls with an identical payload:
  1. THINKING ON   (no extra_body)
  2. THINKING OFF  (extra_body={"thinking": {"type": "disabled"}})
Reports HTTP success + latency for each. If non-thinking is NOT clearly faster,
the 'thinking' field was probably ignored by the API → thinking is still ON.
Don't assume success: this script flags that case (exit 1).

Usage:
    cd clarity-engine/backend
    source venv/bin/activate
    python smoke_thinking.py
"""
import sys
import time
from dotenv import load_dotenv

load_dotenv()
# Generous timeout so the THINKING-ON call doesn't falsely time out at 30 s.
import os
os.environ["DEEPSEEK_TIMEOUT"] = os.environ.get("CALIB_TIMEOUT", "180")

from app.lib.deepseek import _client, _DEEPSEEK_MODEL, _BASE_PARAMS
from app.services.brand_analysis_service import SYSTEM_PROMPT, build_user_payload

_BS = {
    "nom_marque": "Technopark", "role_marque": "Premier hub entrepreneurial au Maroc",
    "master_statement": "Faire grandir l'innovation.", "priorites_strategiques": [],
    "territoires_narratifs": [], "ton_marque": "Inspirant, humain, énergique",
    "lignes_rouges": [], "mots_a_privilegier": [], "mots_a_eviter": [],
    "audiences_cles": [], "contexte_sectoriel": "Innovation, Digital",
}
_MSG = {"titre": "Smoke", "langue": "fr",
        "corps": "Nous sommes Technopark. Et partout au Maroc, nous faisons grandir l'innovation."}
_META = {"audience": "Grand public", "canal": "Institutionnel",
         "objectif": "Affirmer l'identité de marque", "type_prise_parole": "Corporate",
         "auteur": "smoke"}

_USER = build_user_payload(_BS, _MSG, _META)
_MAX_TOKENS = 1200


def _one(extra_body: dict):
    t0 = time.perf_counter()
    resp = _client.chat.completions.create(
        model=_DEEPSEEK_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _USER},
        ],
        max_tokens=_MAX_TOKENS,
        response_format={"type": "json_object"},
        timeout=180,
        extra_body=extra_body,
        **_BASE_PARAMS,
    )
    dt = time.perf_counter() - t0
    choice = resp.choices[0]
    return dt, len(choice.message.content or ""), choice.finish_reason


def main() -> None:
    print(f"Model: {_DEEPSEEK_MODEL}   max_tokens={_MAX_TOKENS}\n")

    try:
        t_on, n_on, fr_on = _one({})
        print(f"THINKING ON   : 200 OK · {t_on:6.2f}s · {n_on} chars · finish={fr_on}")
    except Exception as exc:
        print(f"THINKING ON   : FAILED · {exc}")
        sys.exit(2)

    try:
        t_off, n_off, fr_off = _one({"thinking": {"type": "disabled"}})
        print(f"THINKING OFF  : 200 OK · {t_off:6.2f}s · {n_off} chars · finish={fr_off}")
    except Exception as exc:
        print(f"THINKING OFF  : FAILED · {exc}")
        print("  → the API REJECTED extra_body={'thinking': {'type': 'disabled'}}.")
        print("    The field is wrong for this account/model — do NOT ship it as-is.")
        sys.exit(2)

    drop = (t_on - t_off) / t_on * 100 if t_on else 0.0
    print(f"\nLatency drop (off vs on): {drop:+.1f}%")
    if t_off < t_on * 0.7:
        print("OK ✓  Non-thinking is clearly faster — the flag is honored.")
        sys.exit(0)
    print("WARNING ⚠️  Non-thinking is NOT clearly faster → the 'thinking' field was")
    print("           probably IGNORED silently and thinking is still ON.")
    print("           Do NOT assume success; verify the correct DeepSeek parameter.")
    sys.exit(1)


if __name__ == "__main__":
    main()
