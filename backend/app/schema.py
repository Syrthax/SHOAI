"""Layer-1 validation: the ONLY shapes the AI is allowed to produce."""
from typing import Annotated, Literal, Optional, Union
from pydantic import BaseModel, Field, model_validator


class Trim(BaseModel):
    op: Literal["trim"]
    clipId: str
    startSec: float = Field(ge=0)
    durationSec: float = Field(gt=0)


class CutStart(BaseModel):
    """Remove the first `seconds` of a clip; what remains stays at the clip's original start."""
    op: Literal["cutStart"]
    clipId: str
    seconds: float = Field(gt=0)


class RemoveRange(BaseModel):
    """Cut a time span out of the WHOLE timeline (every track); everything after shifts left."""
    op: Literal["removeRange"]
    fromSec: float = Field(ge=0)
    toSec: float = Field(gt=0)

    @model_validator(mode="after")
    def _ordered(self):
        if self.toSec <= self.fromSec:
            raise ValueError("toSec must be greater than fromSec")
        return self


class Move(BaseModel):
    op: Literal["move"]
    clipId: str
    startSec: float = Field(ge=0)


class AddLowerThird(BaseModel):
    op: Literal["addLowerThird"]
    text: str = Field(min_length=1, max_length=60)
    startSec: float = Field(ge=0)
    durationSec: float = Field(gt=0)


class AddSubtitle(BaseModel):
    op: Literal["addSubtitle"]
    text: str = Field(min_length=1, max_length=120)
    startSec: float = Field(ge=0)
    durationSec: float = Field(gt=0)


class AddTransition(BaseModel):
    op: Literal["addTransition"]
    fromClipId: str
    toClipId: str
    kind: Literal["fade", "slide", "wipe"]
    durationSec: float = Field(gt=0, le=3)


Op = Annotated[
    Union[Trim, CutStart, RemoveRange, Move, AddLowerThird, AddSubtitle, AddTransition],
    Field(discriminator="op"),
]


class Plan(BaseModel):
    summary: str
    ops: list[Op] = Field(default_factory=list, max_length=8)
    # Set when the request cannot be expressed with the allowed ops.
    unsupportedReason: Optional[str] = None


class Rejected(BaseModel):
    """An op the model proposed that failed semantic validation even after repair."""
    op: dict
    reason: str
