import logging
import os
import re
from openai import OpenAI
from pydantic import ValidationError
from dotenv import load_dotenv

from .schema import Plan, Rejected
from .prompt import SYSTEM_PROMPT, build_user_message
from .validate import validate_plan, format_errors
from .sourcetime import resolve_source_times

load_dotenv()

log = logging.getLogger("uvicorn.error")
MODEL = os.getenv("FEATHERLESS_MODEL", "Qwen/Qwen2.5-72B-Instruct")
_client: OpenAI | None = None


class PlanError(Exception):
    pass


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        key = os.getenv("FEATHERLESS_API_KEY", "")
        if not key or key == "your_key_here":
            raise RuntimeError("FEATHERLESS_API_KEY is not set - add it to backend/.env")
        # Fail fast instead of hanging the UI on "Planning..." when the provider stalls.
        _client = OpenAI(base_url=os.getenv("FEATHERLESS_BASE_URL", "https://api.featherless.ai/v1"), api_key=key,
                         timeout=60, max_retries=1)
    return _client


def _extract_json(text: str) -> str:
    text = re.sub(r"```(?:json)?", "", text).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in model output")
    return text[start : end + 1]


def with_cut_points(timeline: dict) -> dict:
    """Add cutPointsSec: times where two pieces of the same source meet on a track (earlier cuts)."""
    by_track: dict[str, list[dict]] = {}
    for c in timeline.get("clips", []):
        by_track.setdefault(c["trackId"], []).append(c)
    cuts = set()
    for cs in by_track.values():
        cs = sorted(cs, key=lambda c: c["startSec"])
        for a, b in zip(cs, cs[1:]):
            if a.get("type") in ("video", "audio") and a.get("name") == b.get("name") \
                    and abs(a["startSec"] + a["durationSec"] - b["startSec"]) < 0.05:
                cuts.add(round(b["startSec"], 2))
    return {**timeline, "cutPointsSec": sorted(cuts)}


def make_plan(request: str, timeline: dict, previous_plan: dict | None = None,
              validation_errors: list[str] | None = None, history: list[dict] | None = None) -> tuple[Plan, int]:
    """Layer 1: returns (plan, repairCount). Up to 2 retries, feeding Pydantic errors back to the model."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": build_user_message(request, timeline, previous_plan, validation_errors, history)},
    ]
    last_error = "unknown"
    for attempt in range(3):
        resp = _get_client().chat.completions.create(
            model=MODEL, messages=messages, temperature=0.1, max_tokens=900
        )
        text = resp.choices[0].message.content or ""
        try:
            return Plan.model_validate_json(_extract_json(text)), attempt
        except (ValidationError, ValueError) as e:
            last_error = str(e)[:800]
            log.warning("plan attempt %d invalid: %s | output: %.300s", attempt + 1, last_error[:300], text)
            messages += [
                {"role": "assistant", "content": text},
                {"role": "user", "content": f"Your JSON was invalid. Return ONLY corrected JSON. Errors: {last_error}"},
            ]
    raise PlanError(last_error)


def make_validated_plan(request: str, timeline: dict, previous_plan: dict | None = None,
                        history: list[dict] | None = None) -> tuple[Plan, int, list[Rejected]]:
    """Layers 1 + 2: shape-valid plan, one semantic repair, then drop any op that is still invalid.
    Returns (plan with only valid ops, repairCount, rejected ops with reasons)."""
    timeline = with_cut_points(timeline)
    plan, repairs = make_plan(request, timeline, previous_plan, history=history)
    if plan.unsupportedReason:
        return plan, repairs, []
    notes = resolve_source_times(plan, timeline)

    errors = validate_plan(plan, timeline)
    if errors:
        plan, more = make_plan(request, timeline, plan.model_dump(), format_errors(plan, errors), history)
        repairs += 1 + more
        if plan.unsupportedReason:
            return plan, repairs, []
        notes = resolve_source_times(plan, timeline)
        errors = validate_plan(plan, timeline)

    rejected = [Rejected(op=plan.ops[i].model_dump(), reason="; ".join(errs)) for i, errs in errors.items()]
    plan.ops = [o for i, o in enumerate(plan.ops) if i not in errors]
    if notes and not plan.ops and not plan.reply:  # everything asked for was already cut
        plan.reply = "Nothing more to cut: " + "; ".join(notes) + "."
    elif notes:
        plan.reply = ((plan.reply + " ") if plan.reply else "") + "Note: " + "; ".join(notes) + "."
    return plan, repairs, rejected
