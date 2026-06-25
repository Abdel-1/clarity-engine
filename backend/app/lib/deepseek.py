"""
app/lib/deepseek.py — Clarity Engine DeepSeek Client
─────────────────────────────────────────────────────
Reusable OpenAI-compatible client pointed at the DeepSeek API.

Usage:
    from app.lib.deepseek import call_deepseek

    raw_json = call_deepseek(
        system="You are ...",
        user="Evaluate this message: ...",
    )
    data = json.loads(raw_json)

Contract:
- Always sends temperature=0, top_p=1, response_format=json_object.
- max_tokens defaults to 4096 (enough for full extraction JSON).
  Callers can override by passing max_tokens=N.
- Timeout: DEEPSEEK_TIMEOUT env var seconds (default 90) — overridable per process.
- Model: DEEPSEEK_MODEL env var (default "deepseek-v4-pro"). On 4xx
  "model not found", falls back to "deepseek-v4-flash" with a warning.
- Raises RuntimeError on API errors so callers can retry cleanly.
- The DEEPSEEK_API_KEY is read ONCE at import time from the server-side
  Settings object — it is never surfaced to the front end.
"""

import logging
import os

from openai import OpenAI, NotFoundError, BadRequestError
from app.core.config import settings

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

_DEEPSEEK_BASE_URL = "https://api.deepseek.com"

# Primary model — overridable via DEEPSEEK_MODEL env var.
# "deepseek-v4-pro" is the current production model on api.deepseek.com.
# Do NOT substitute deepseek-chat / deepseek-reasoner: those aliases were
# retired on 2026-07-24 and now route to V4-Flash, not V4-Pro.
_DEEPSEEK_MODEL         = os.environ.get("DEEPSEEK_MODEL", "deepseek-v4-pro")
_DEEPSEEK_FALLBACK      = "deepseek-v4-flash"   # used only when primary 404s

_BASE_PARAMS = {
    "temperature": 0,
    "top_p":       1,
}

# Default max_tokens — generous enough for full Brand System JSON extraction.
# Analysis responses are shorter but 4096 is well within budget.
_DEFAULT_MAX_TOKENS = 4096

# Thinking mode: deepseek-v4-pro emits a long hidden reasoning trace before the
# first token, which dominates latency. We disable it (response is direct) — the
# schema's per-subscore "reasoning" field already supplies the rationale, so the
# hidden chain-of-thought is redundant. Sent via extra_body on every call.
# Set DEEPSEEK_THINKING=on to re-enable (used by the smoke test and the
# before/after latency measurement); default = disabled.
_THINKING_DISABLED = os.environ.get("DEEPSEEK_THINKING", "off").strip().lower() != "on"
_THINKING_EXTRA = {"thinking": {"type": "disabled"}} if _THINKING_DISABLED else {}

# ─────────────────────────────────────────────────────────────────────────────
# Client — instantiated once, shared across requests
# Per-call timeout is set from DEEPSEEK_TIMEOUT env var (default 30 s).
# ─────────────────────────────────────────────────────────────────────────────

_client = OpenAI(
    api_key=settings.DEEPSEEK_API_KEY,
    base_url=_DEEPSEEK_BASE_URL,
    timeout=30.0,
)


# ─────────────────────────────────────────────────────────────────────────────
# Internal helper
# ─────────────────────────────────────────────────────────────────────────────

def _is_model_not_found(exc: Exception) -> bool:
    """Return True when the error indicates the requested model doesn't exist."""
    if isinstance(exc, NotFoundError):
        return True
    if isinstance(exc, BadRequestError):
        msg = str(exc).lower()
        return "model" in msg and ("not found" in msg or "does not exist" in msg)
    return False


def _usage_dict(response) -> dict | None:
    """Extract {prompt_tokens, completion_tokens, total_tokens} from a response, or None."""
    usage = getattr(response, "usage", None)
    if not usage:
        return None
    return {
        "prompt_tokens":     getattr(usage, "prompt_tokens", 0) or 0,
        "completion_tokens": getattr(usage, "completion_tokens", 0) or 0,
        "total_tokens":      getattr(usage, "total_tokens", 0) or 0,
    }


def _create(model: str, messages: list, max_tokens: int) -> tuple[str, dict | None]:
    """Make one API call and return (stripped content, token usage | None)."""
    timeout = float(settings.DEEPSEEK_TIMEOUT)
    response = _client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
        timeout=timeout,
        extra_body=_THINKING_EXTRA,
        **_BASE_PARAMS,
    )
    usage = _usage_dict(response)
    choice = response.choices[0]
    content = choice.message.content
    finish_reason = choice.finish_reason or "unknown"

    if finish_reason == "length":
        raise RuntimeError(
            f"DeepSeek truncated its response (finish_reason=length). "
            f"Try reducing input size or increasing max_tokens (current={max_tokens})."
        )

    if not content:
        raise RuntimeError(
            f"DeepSeek returned an empty response. Finish reason: {finish_reason}"
        )

    # Safety strip — json_object mode should never wrap, but belt-and-suspenders.
    content = content.strip()
    if content.startswith("```"):
        lines = content.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        content = "\n".join(lines).strip()

    return content, usage


# ─────────────────────────────────────────────────────────────────────────────
# Public interface
# ─────────────────────────────────────────────────────────────────────────────

def call_deepseek_messages(
    messages: list[dict],
    max_tokens: int = _DEFAULT_MAX_TOKENS,
    return_usage: bool = False,
):
    """
    Send an arbitrary messages list to DeepSeek (multi-turn capable).

    This is the low-level entry point.  Use it when the caller needs to inject
    an assistant turn (e.g. the bad response) before the repair user message.

    Args:
        messages:     Full OpenAI-style messages list (role/content dicts).
        max_tokens:   Token budget for the response (default 4096).
        return_usage: When True, return (content, usage_dict|None) instead of content.

    Raises:
        RuntimeError: wraps any OpenAI/network/API error with a clean message.
    """
    def _run(model):
        return _create(model, messages, max_tokens)

    try:
        content, usage = _run(_DEEPSEEK_MODEL)
    except RuntimeError:
        raise
    except Exception as exc:
        if _is_model_not_found(exc):
            logger.warning(
                "DeepSeek model %r not found (%s). "
                "Falling back to %r. Set DEEPSEEK_MODEL env var to suppress this.",
                _DEEPSEEK_MODEL, exc, _DEEPSEEK_FALLBACK,
            )
            try:
                content, usage = _run(_DEEPSEEK_FALLBACK)
            except RuntimeError:
                raise
            except Exception as fb_exc:
                raise RuntimeError(
                    f"DeepSeek fallback ({_DEEPSEEK_FALLBACK}) also failed: {fb_exc}"
                ) from fb_exc
        else:
            raise RuntimeError(f"DeepSeek API error: {exc}") from exc

    return (content, usage) if return_usage else content


def call_deepseek(
    system: str,
    user: str,
    max_tokens: int = _DEFAULT_MAX_TOKENS,
    return_usage: bool = False,
):
    """
    Convenience wrapper for the common single-turn (system + user) case.

    When return_usage=True, returns (content, usage_dict|None).

    Raises:
        RuntimeError: wraps any OpenAI/network/API error with a clean message.
    """
    return call_deepseek_messages(
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        max_tokens=max_tokens,
        return_usage=return_usage,
    )


def stream_analyze(
    system: str,
    user: str,
    max_tokens: int = _DEFAULT_MAX_TOKENS,
    usage_out: dict | None = None,
):
    """
    Stream a single-turn (system + user) call token-by-token (generator).

    Yields raw text deltas as they arrive — same model, same params, same
    non-thinking + json_object + temperature 0 as the non-streamed path. The
    caller accumulates the full string then parses/validates it identically to
    today; streaming changes only delivery, never the final output.

    If `usage_out` (a dict) is provided, it is populated in place with the final
    token usage ({prompt_tokens, completion_tokens, total_tokens}) when the
    provider returns it (requires stream_options.include_usage support).

    Raises:
        RuntimeError: wraps any OpenAI/network/API error so the caller can fall
        back to the classic non-streamed call.
    """
    timeout = float(settings.DEEPSEEK_TIMEOUT)
    try:
        stream = _client.chat.completions.create(
            model=_DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": user},
            ],
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
            timeout=timeout,
            stream=True,
            stream_options={"include_usage": True},
            extra_body=_THINKING_EXTRA,
            **_BASE_PARAMS,
        )
        for chunk in stream:
            # The final usage chunk arrives with empty choices and usage set.
            if usage_out is not None:
                u = _usage_dict(chunk)
                if u:
                    usage_out.update(u)
            if not chunk.choices:
                continue
            piece = getattr(chunk.choices[0].delta, "content", None)
            if piece:
                yield piece
    except Exception as exc:
        raise RuntimeError(f"DeepSeek streaming error: {exc}") from exc
