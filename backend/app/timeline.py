"""In-memory timeline used by the CLI to preview plans without the browser.
Mirrors what frontend/src/editor/applyPlan.ts does to the real Elah timeline."""
import copy
import itertools

from .schema import Op

TEXT_TRACK = "text"
_ids = itertools.count(1)


def apply_ops(timeline: dict, ops: list[Op]) -> dict:
    """Returns a NEW timeline with ops applied; the input is never mutated."""
    tl = copy.deepcopy(timeline)
    clips = {c["id"]: c for c in tl["clips"]}
    tl.setdefault("transitions", [])

    for o in ops:
        c = clips.get(getattr(o, "clipId", None) or "")
        if o.op == "cutStart" and c:
            # Ripple: later clips on the same track shift left so no gap opens up.
            end = c["startSec"] + c["durationSec"]
            for other in tl["clips"]:
                if other is not c and other["trackId"] == c["trackId"] and other["startSec"] >= end - 0.01:
                    other["startSec"] = round(other["startSec"] - o.seconds, 3)
            c["durationSec"] = round(c["durationSec"] - o.seconds, 3)
        elif o.op == "removeRange":
            remove_range(tl, o.fromSec, o.toSec)
            clips = {x["id"]: x for x in tl["clips"]}
        elif o.op == "trim" and c:
            c["startSec"], c["durationSec"] = o.startSec, o.durationSec
        elif o.op == "move" and c:
            c["startSec"] = o.startSec
        elif o.op in ("addLowerThird", "addSubtitle"):
            new = {
                "id": f"ai-text-{next(_ids)}", "trackId": TEXT_TRACK, "type": "text",
                "name": f"{'Lower third' if o.op == 'addLowerThird' else 'Subtitle'}: {o.text}",
                "startSec": o.startSec, "durationSec": o.durationSec,
            }
            tl["clips"].append(new)
            clips[new["id"]] = new
        elif o.op == "addTransition":
            tl["transitions"].append({"from": o.fromClipId, "to": o.toClipId,
                                      "kind": o.kind, "durationSec": o.durationSec})

    tl["durationSec"] = max([c["startSec"] + c["durationSec"] for c in tl["clips"]], default=0)
    return tl


def remove_range(tl: dict, a: float, b: float) -> None:
    """Delete [a, b) from every track and ripple later content left (in place)."""
    gap, out = b - a, []
    for c in tl["clips"]:
        s, e = c["startSec"], c["startSec"] + c["durationSec"]
        if e <= a:                              # entirely before
            out.append(c)
        elif s >= b:                            # entirely after -> shift left
            out.append({**c, "startSec": round(s - gap, 3)})
        elif s >= a and e <= b:                 # entirely inside -> gone
            continue
        else:                                   # overlaps: keep the parts outside [a, b)
            if s < a:
                out.append({**c, "durationSec": round(a - s, 3)})
            if e > b:
                out.append({**c, "id": c["id"] + "-r" if s < a else c["id"], "startSec": a, "durationSec": round(e - b, 3)})
    tl["clips"] = out


def render(tl: dict) -> str:
    """Plain-text view of the timeline, grouped by track."""
    lines = [f"Timeline  {tl.get('durationSec', 0):.1f}s @ {tl.get('fps', 30)}fps"]
    tracks: dict[str, list[dict]] = {}
    for c in tl["clips"]:
        tracks.setdefault(c["trackId"], []).append(c)
    for track, cs in tracks.items():
        lines.append(f"  [{track}]")
        for c in sorted(cs, key=lambda c: c["startSec"]):
            end = c["startSec"] + c["durationSec"]
            lines.append(f"    {c['id']:<14} {c['startSec']:6.2f}s -> {end:6.2f}s  {c['type']:<6} {c.get('name', '')}")
    for t in tl.get("transitions", []):
        lines.append(f"  ~ {t['kind']} {t['durationSec']}s: {t['from']} -> {t['to']}")
    return "\n".join(lines)
