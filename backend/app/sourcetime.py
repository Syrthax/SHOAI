"""Convert removeRange ops given in ORIGINAL-video time into current-timeline time.

After cuts, a single source video is split into pieces; each piece knows which part of the source it
shows (sourceStartSec). A source range maps to zero or more timeline ranges: parts that were already
removed simply have no timeline position, so nothing is cut twice."""
from .schema import Plan, RemoveRange


def _pieces(timeline: dict) -> list[dict] | None:
    """Video pieces of the single source video, or None if source time is ambiguous."""
    clips = [c for c in timeline.get("clips", []) if c.get("type") == "video"] or \
            [c for c in timeline.get("clips", []) if c.get("type") == "audio"]
    names = {c.get("name") for c in clips}
    if len(names) != 1 or any((c.get("speed") or 1) != 1 for c in clips):
        return None
    return clips


def source_to_timeline(timeline: dict, a: float, b: float) -> list[tuple[float, float]] | None:
    pieces = _pieces(timeline)
    if pieces is None:
        return None
    out = []
    for c in pieces:
        ss = c.get("sourceStartSec", 0.0)
        lo, hi = max(a, ss), min(b, ss + c["durationSec"])
        if hi - lo > 0.01:
            out.append((round(c["startSec"] + lo - ss, 3), round(c["startSec"] + hi - ss, 3)))
    return out


def resolve_source_times(plan: Plan, timeline: dict) -> list[str]:
    """Rewrite source-time removeRange ops in place. Returns notes about ranges already gone."""
    notes, ops = [], []
    for o in plan.ops:
        if not (isinstance(o, RemoveRange) and o.timeBase == "source"):
            ops.append(o)
            continue
        spans = source_to_timeline(timeline, o.fromSec, o.toSec)
        if spans is None:  # several sources / speed changes: treat as timeline time
            ops.append(o.model_copy(update={"timeBase": "timeline"}))
            continue
        if not spans:
            notes.append(f"{o.fromSec:g}s-{o.toSec:g}s of the original video is already removed")
        for x, y in spans:
            ops.append(RemoveRange(op="removeRange", fromSec=x, toSec=y, transition=o.transition,
                                   sourceFromSec=o.fromSec, sourceToSec=o.toSec))
    # Apply later ranges first so earlier timeline times stay valid.
    rr = sorted([o for o in ops if isinstance(o, RemoveRange)], key=lambda o: -o.fromSec)
    it = iter(rr)
    plan.ops = [next(it) if isinstance(o, RemoveRange) else o for o in ops]
    return notes
