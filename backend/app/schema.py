"""Layer-1 validation: the ONLY shapes the AI is allowed to produce."""
from typing import Annotated, Literal, Optional, Union
from pydantic import BaseModel, Field


class Trim(BaseModel):
    op: Literal["trim"]
    clipId: str
    startSec: float = Field(ge=0)
    durationSec: float = Field(gt=0)


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
    Union[Trim, Move, AddLowerThird, AddSubtitle, AddTransition],
    Field(discriminator="op"),
]


class Plan(BaseModel):
    summary: str
    ops: list[Op] = Field(default_factory=list, max_length=8)
    # Set when the request cannot be expressed with the allowed ops.
    unsupportedReason: Optional[str] = None
