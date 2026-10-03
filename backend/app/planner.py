import os
import re
from openai import OpenAI
from pydantic import ValidationError
from dotenv import load_dotenv

from .schema import Plan
from .prompt import SYSTEM_PROMPT, build_user_message

load_dotenv()

client = OpenAI(
    base_url=os.getenv("FEATHERLESS_BASE_URL", "https://api.featherless.ai/v1"),
    api_key=os.getenv("FEATHERLESS_API_KEY", "missing"),
)
MODEL = os.getenv("FEATHERLESS_MODEL", "Qwen/Qwen2.5-32B-Instruct")


class PlanError(Exception):
    pass


def _extract_json(text: str) -> str:
    text = re.sub(r"```(?:json)?", "", text).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in model output")
    return text[start : end + 1]


def make_plan(req) -> tuple[Plan, int]:
    """Returns (plan, repairCount). Retries once, feeding Pydantic errors back to the model."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": build_user_message(req)},
    ]
    last_error = "unknown"
    for attempt in range(2):
        resp = client.chat.completions.create(
            model=MODEL, messages=messages, temperature=0.1, max_tokens=900
        )
        text = resp.choices[0].message.content or ""
        try:
            return Plan.model_validate_json(_extract_json(text)), attempt
        except (ValidationError, ValueError) as e:
            last_error = str(e)[:800]
            messages += [
                {"role": "assistant", "content": text},
                {"role": "user", "content": f"Your JSON was invalid. Return ONLY corrected JSON. Errors: {last_error}"},
            ]
    raise PlanError(last_error)
