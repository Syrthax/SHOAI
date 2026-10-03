from typing import Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .planner import make_plan, make_validated_plan, PlanError

app = FastAPI(title="Elah AI Copilot")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class PlanRequest(BaseModel):
    request: str
    timeline: dict[str, Any]
    previousPlan: Optional[dict[str, Any]] = None
    validationErrors: Optional[list[str]] = None


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/plan")
def plan(req: PlanRequest):
    try:
        if req.validationErrors:  # frontend-driven repair round: just re-plan with the errors
            plan_obj, repairs = make_plan(req.request, req.timeline, req.previousPlan, req.validationErrors)
            rejected = []
        else:
            plan_obj, repairs, rejected = make_validated_plan(req.request, req.timeline, req.previousPlan)
    except PlanError as e:
        raise HTTPException(status_code=422, detail=f"AI returned an invalid plan: {e}")
    except Exception as e:  # network / auth
        raise HTTPException(status_code=502, detail=f"LLM call failed: {e}")
    return {
        "plan": plan_obj.model_dump(),
        "repairs": repairs,
        "rejected": [r.model_dump() for r in rejected],
    }
