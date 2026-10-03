"""Layer-2 validation: does the plan make sense for THIS timeline?
Mirrors frontend/src/ai/validate.ts - keep the two in sync."""
from .schema import Plan


def validate_plan(plan: Plan, timeline: dict) -> dict[int, list[str]]:
    """Returns {op_index: [errors]} for every op that does not fit the timeline."""
    clips = {c["id"]: c for c in timeline.get("clips", [])}
    limit = max(timeline.get("durationSec", 0), 1) * 2  # generous upper bound
    errors: dict[int, list[str]] = {}

    for i, o in enumerate(plan.ops):
        errs: list[str] = []
        clip_id = getattr(o, "clipId", None)
        if clip_id is not None and clip_id not in clips:
            errs.append(f'clipId "{clip_id}" does not exist')
        start = getattr(o, "startSec", None)
        if start is not None and start > limit:
            errs.append(f"startSec {start} is beyond the timeline")

        c = clips.get(clip_id) if clip_id else None
        if o.op == "trim" and c and o.durationSec > c["durationSec"] + 0.01:
            errs.append(f"durationSec {o.durationSec} exceeds clip length {c['durationSec']}")
        if o.op == "cutStart" and c and o.seconds >= c["durationSec"]:
            errs.append(f"seconds {o.seconds} must be less than clip length {c['durationSec']}")
        if o.op == "editText" and c and c.get("type") != "text":
            errs.append(f'clip "{clip_id}" is a {c.get("type")} clip, not text')
        if o.op == "removeRange":
            dur = timeline.get("durationSec", 0)
            if o.fromSec >= dur:
                errs.append(f"fromSec {o.fromSec} is at or past the end of the timeline ({dur}s)")
            if o.toSec > dur + 0.05:
                errs.append(f"toSec {o.toSec} is past the end of the timeline ({dur}s)")
            if o.fromSec <= 0.01 and o.toSec >= dur - 0.01:
                errs.append("removeRange would delete the entire timeline")
        if o.op == "addTransition":
            a, b = clips.get(o.fromClipId), clips.get(o.toClipId)
            if not a:
                errs.append(f'fromClipId "{o.fromClipId}" does not exist')
            if not b:
                errs.append(f'toClipId "{o.toClipId}" does not exist')
            if a and b and a["trackId"] != b["trackId"]:
                errs.append("clips must be on the same track")
            if a and b and abs(a["startSec"] + a["durationSec"] - b["startSec"]) > 0.2:
                errs.append("clips must be adjacent (end of first = start of second)")

        if errs:
            errors[i] = errs
    return errors


def format_errors(plan: Plan, errors: dict[int, list[str]]) -> list[str]:
    return [f"ops[{i}] ({plan.ops[i].op}): {e}" for i, errs in errors.items() for e in errs]
