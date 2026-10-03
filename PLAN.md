# Elah AI Copilot - Hackathon Plan (2 hours)

**One-liner:** Type what you want in plain English; AI proposes a *validated, structured edit plan*, you preview it live on the Elah timeline, then keep / discard / refine it. The whole AI action is one undo step.

## Does it satisfy the brief?
| Requirement | How we meet it |
|---|---|
| Natural language start | Chat box |
| AI plan = structured data, no pixels/DOM | Python backend returns JSON ops only |
| Validate, apply only valid ops | Layer 1: Pydantic (shape). Layer 2: `validate.ts` (clip exists, time in range, adjacent clips) |
| Preview before keeping | Plan is applied live to the Elah timeline as a preview |
| request -> plan -> preview -> keep/discard/refine | `useAiSession.ts` |
| Whole AI action reversible in one step | `engine.batch(...)` => one undo entry; Discard = `engine.undo()` |
| Invalid/unsupported handled | LLM returns `unsupportedReason`; UI shows clean message |

## Architecture
```
Browser (React + Vite + @elah/editor)            Python (FastAPI)
 ChatPanel -> useAiSession --POST /api/plan-->  planner.py -> Featherless LLM
        timeline summary (JSON)                   Pydantic validate (+1 auto-repair)
 <- plan JSON <---------------------------------
 validate.ts (semantic) -> if errors: re-ask once with errors
 applyPlan.ts -> engine.batch() -> live preview
 Keep (commit) | Discard (engine.undo()) | Refine (undo + re-plan with feedback)
```
**Python does NOT touch video.** Elah is a browser-only TypeScript SDK (WebCodecs/WebGL). Python only talks to the LLM and validates the plan.

## The 5 operations (all times in seconds; frontend converts to frames)
1. `trim` - set clip's `startSec` + `durationSec`
2. `move` - move clip to `startSec`
3. `addLowerThird` - name text, `startSec`, `durationSec`
4. `addSubtitle` - caption text, `startSec`, `durationSec`
5. `addTransition` - fade/slide/wipe between two adjacent clips on the same track

Anything else ("make it cinematic") -> `unsupportedReason`.

## Team split (4 people)
| Person | Files |
|---|---|
| A - Backend/AI | `backend/app/*` (prompt, planner, schema) |
| B - Editor logic | `frontend/src/editor/applyPlan.ts`, `ai/validate.ts`, `ai/timelineSummary.ts` |
| C - UI | `frontend/src/ui/*`, `styles.css` |
| D - Demo/QA | sample clips, test prompts, README, 2-min demo script |

## 120-minute timeline
| Min | Goal |
|---|---|
| 0-15 | Install, run both servers, import a clip in Elah |
| 15-30 | Hardcode one plan -> `applyPlan` works on timeline (B) |
| 30-70 | LLM -> plan end to end (A), UI cards (C) |
| 70-105 | Validation, per-op toggles, refine, undo, unsupported |
| 105-120 | Polish + rehearse demo |

## To verify early (15-30 min block)
- `trimClip` semantics (timeline start/duration vs source offset) - adjust `applyPlan.ts` if needed.
- `engine.batch` runs the recipe synchronously and yields ONE undo entry.
- Text `transform` shape accepted by `addClip`.
- Featherless model ID exact string (their model list page).

## Demo script (2 min)
1. Import a clip. Say: "Remove the first 3 seconds and add my name as a lower third." -> show plan card + JSON -> preview -> Keep.
2. "Add a subtitle 'Hyderabad Hack Day' at 5s" -> preview -> toggle one op off -> Keep.
3. Refine: "make the lower third last 2 seconds".
4. One-click Undo (Discard) of a full AI action.
5. "Make it look like a Marvel movie" -> clean "unsupported" message.
6. One sentence: "Describe edits in English, get a safe, reviewable, one-click-reversible plan - AI never touches pixels."

## Winning edge
- Visible plan JSON next to result (AI contribution obvious)
- Two validation layers + auto-repair loop (show a repair badge)
- Per-op accept/reject
- Atomic undo
- Clean unsupported handling
- Rehearsed 2-minute demo with pre-loaded clips

## Resources
- Repo: https://github.com/elahlabs/elah
- Docs: https://www.elah.dev/docs
- AI guide: https://www.elah.dev/docs/agents
- One-file API guide: https://raw.githubusercontent.com/elahlabs/elah/main/docs/ai/ELAH_FOR_AI_AGENTS.md
- Minimal example to compare against: https://github.com/elahlabs/elah/tree/main/examples/minimal
- Featherless (OpenAI-compatible): base URL https://api.featherless.ai/v1
