"""Elah AI Copilot - command-line version of the request -> plan -> preview -> keep/discard/refine loop.

Interactive:   python cli.py
One-shot:      python cli.py "remove the first 3 seconds" [--json]
Offline test:  python cli.py --plan samples/plan.json        (no LLM call)
Other timeline: --timeline path/to/timeline.json   (same shape the frontend sends)
"""
import argparse
import json
import sys
from pathlib import Path

from app.planner import make_validated_plan, PlanError
from app.schema import Plan, Rejected
from app.timeline import apply_ops, render
from app.validate import validate_plan

HERE = Path(__file__).parent
HELP = """Type an edit request in plain English, or a command:
  /show          print the timeline        /undo   revert the last kept AI edit
  /save FILE     write timeline JSON       /load FILE   load a timeline JSON
  /help          this help                 /quit   exit"""


def plan_from_file(path: str, timeline: dict) -> tuple[Plan, int, list[Rejected]]:
    """Validate a hand-written plan the same way the API does, minus the LLM repair."""
    plan = Plan.model_validate_json(Path(path).read_text())
    errors = validate_plan(plan, timeline)
    rejected = [Rejected(op=plan.ops[i].model_dump(), reason="; ".join(e)) for i, e in errors.items()]
    plan.ops = [o for i, o in enumerate(plan.ops) if i not in errors]
    return plan, 0, rejected


def print_plan(plan: Plan, repairs: int, rejected: list[Rejected], enabled: list[bool]) -> None:
    print(f"\nAI plan: {plan.summary}" + (f"   (auto-repaired x{repairs})" if repairs else ""))
    for i, o in enumerate(plan.ops):
        print(f"  [{'x' if enabled[i] else ' '}] {i + 1}. {json.dumps(o.model_dump())}")
    for r in rejected:
        print(f"  [!] rejected {json.dumps(r.op)}\n      reason: {r.reason}")


def review(plan: Plan, repairs: int, rejected: list[Rejected], timeline: dict) -> tuple[str, dict | str]:
    """Preview loop for one plan. Returns ('keep', new_timeline) | ('discard', None) | ('refine', text)."""
    enabled = [True] * len(plan.ops)
    while True:
        print_plan(plan, repairs, rejected, enabled)
        preview = apply_ops(timeline, [o for o, on in zip(plan.ops, enabled) if on])
        print("\nPREVIEW\n" + render(preview))
        choice = input("\n[k]eep  [d]iscard  [r]efine  [1-9] toggle op > ").strip().lower()
        if choice == "k":
            return "keep", preview
        if choice == "d":
            return "discard", None
        if choice == "r":
            return "refine", input("refine: ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(plan.ops):
            enabled[int(choice) - 1] ^= True


def interactive(timeline: dict, plan_file: str | None) -> None:
    history: list[dict] = []  # snapshots before each kept AI edit -> one-step undo
    print(render(timeline) + "\n\n" + HELP)
    while True:
        try:
            text = input("\nyou > ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return
        if not text:
            continue
        cmd, _, arg = text.partition(" ")
        if cmd == "/quit":
            return
        if cmd == "/help":
            print(HELP); continue
        if cmd == "/show":
            print(render(timeline)); continue
        if cmd == "/undo":
            if history:
                timeline = history.pop(); print("Undone - whole AI edit reverted.\n" + render(timeline))
            else:
                print("Nothing to undo.")
            continue
        if cmd == "/save":
            Path(arg).write_text(json.dumps(timeline, indent=2)); print(f"Saved to {arg}"); continue
        if cmd == "/load":
            timeline = json.loads(Path(arg).read_text()); history.clear(); print(render(timeline)); continue

        request, previous = text, None
        while True:  # a refine re-plans against the same ORIGINAL timeline, with the previous plan as context
            try:
                print("thinking...")
                if plan_file:
                    plan, repairs, rejected = plan_from_file(plan_file, timeline)
                else:
                    plan, repairs, rejected = make_validated_plan(request, timeline, previous)
            except (PlanError, RuntimeError) as e:
                print(f"error: {e}"); break
            except Exception as e:  # network / auth
                print(f"LLM call failed: {e}"); break

            if plan.unsupportedReason:
                print(f"\nAI: I can't do that - {plan.unsupportedReason}"); break
            if not plan.ops:
                print("\nAI: no valid edits to make.")
                for r in rejected:
                    print(f"  [!] {json.dumps(r.op)} - {r.reason}")
                break

            action, result = review(plan, repairs, rejected, timeline)
            if action == "keep":
                history.append(timeline); timeline = result
                print("Kept. /undo reverts this whole AI edit in one step."); break
            if action == "discard":
                print("Discarded - timeline unchanged."); break
            request, previous = result, plan.model_dump()


def main() -> None:
    ap = argparse.ArgumentParser(description="Elah AI Copilot CLI")
    ap.add_argument("request", nargs="?", help="one-shot request; omit for interactive mode")
    ap.add_argument("--timeline", default=str(HERE / "samples" / "timeline.json"))
    ap.add_argument("--plan", help="use this plan JSON instead of calling the LLM")
    ap.add_argument("--json", action="store_true", help="one-shot: print the raw API-style response")
    args = ap.parse_args()
    timeline = json.loads(Path(args.timeline).read_text())

    if not args.request and not (args.plan and args.json):
        interactive(timeline, args.plan)
        return

    try:
        if args.plan:
            plan, repairs, rejected = plan_from_file(args.plan, timeline)
        else:
            plan, repairs, rejected = make_validated_plan(args.request, timeline)
    except Exception as e:
        sys.exit(f"error: {e}")

    if args.json:  # exactly what POST /api/plan returns
        print(json.dumps({"plan": plan.model_dump(), "repairs": repairs,
                          "rejected": [r.model_dump() for r in rejected]}, indent=2))
        return
    if plan.unsupportedReason:
        print(f"AI: I can't do that - {plan.unsupportedReason}")
        return
    print_plan(plan, repairs, rejected, [True] * len(plan.ops))
    print("\nBEFORE\n" + render(timeline) + "\n\nAFTER\n" + render(apply_ops(timeline, plan.ops)))


if __name__ == "__main__":
    main()
