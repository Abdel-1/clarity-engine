#!/usr/bin/env python3
"""
scripts/check_deepseek.py
─────────────────────────
Minimal smoke-test for the DeepSeek API connection.

Usage (from repo root, with venv active):
    cd clarity-engine/backend
    python ../../scripts/check_deepseek.py

Prints the effective model name, the HTTP finish_reason, and the raw
JSON response so you can confirm:
  - The API key is valid
  - The requested model (deepseek-v4-pro by default) is reachable
  - json_object mode is honoured
  - The 30-second timeout is in place

Set DEEPSEEK_MODEL env var to test a different model:
    DEEPSEEK_MODEL=deepseek-v4-flash python ../../scripts/check_deepseek.py
"""

import json
import os
import sys
import time

# ── Allow running from clarity-engine/backend without installing the package ──
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from openai import OpenAI

# ── Config ────────────────────────────────────────────────────────────────────
API_KEY   = os.environ.get("DEEPSEEK_API_KEY", "")
BASE_URL  = "https://api.deepseek.com"
MODEL     = os.environ.get("DEEPSEEK_MODEL", "deepseek-v4-pro")
TIMEOUT   = 30.0

if not API_KEY:
    # Try loading from the backend .env
    env_path = os.path.join(os.path.dirname(__file__), "..", "backend", ".env")
    if os.path.exists(env_path):
        for line in open(env_path):
            line = line.strip()
            if line.startswith("DEEPSEEK_API_KEY="):
                API_KEY = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

if not API_KEY:
    print("ERROR: DEEPSEEK_API_KEY not set and not found in backend/.env")
    sys.exit(1)

# ── Client ────────────────────────────────────────────────────────────────────
client = OpenAI(api_key=API_KEY, base_url=BASE_URL, timeout=TIMEOUT)

SYSTEM = "You are a JSON-only assistant. Output only valid JSON, nothing else."
USER   = 'Return this exact JSON: {"status": "ok", "model_check": true}'

# ── Call ──────────────────────────────────────────────────────────────────────
print(f"DeepSeek smoke-test")
print(f"  Base URL : {BASE_URL}")
print(f"  Model    : {MODEL}")
print(f"  Timeout  : {TIMEOUT}s")
print(f"  API key  : {API_KEY[:8]}…{API_KEY[-4:]}")
print()

t0 = time.time()
try:
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user",   "content": USER},
        ],
        max_tokens=64,
        temperature=0,
        top_p=1,
        response_format={"type": "json_object"},
    )
    elapsed = time.time() - t0

    choice        = response.choices[0]
    content       = choice.message.content or ""
    finish_reason = choice.finish_reason or "unknown"

    print(f"  Status        : OK  ({elapsed:.2f}s)")
    print(f"  Model used    : {response.model}")
    print(f"  Finish reason : {finish_reason}")
    print(f"  Raw content   : {content}")
    print()

    # Validate JSON
    try:
        parsed = json.loads(content)
        print(f"  JSON valid    : YES → {parsed}")
    except json.JSONDecodeError as e:
        print(f"  JSON valid    : NO  → parse error: {e}")
        sys.exit(2)

    if finish_reason == "length":
        print("  WARNING: response was truncated (finish_reason=length)")
        sys.exit(3)

    print()
    print("All checks passed.")

except Exception as exc:
    elapsed = time.time() - t0
    print(f"  FAILED ({elapsed:.2f}s): {exc}")
    sys.exit(1)
