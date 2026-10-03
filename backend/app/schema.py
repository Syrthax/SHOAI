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
    # Optional transition placed on the video cut so the jump is smooth (timing is unchanged).
    transition: Optional[Literal["fade", "slide", "wipe"]] = None
    # "source" = times in the ORIGINAL video (what the user sees in the footage); the backend converts
    # them to timeline times. "timeline" = times on the current, already-edited timeline.
    timeBase: Literal["source", "timeline"] = "timeline"
    # Filled in by the backend after converting from source time, for display only.
    sourceFromSec: Optional[float] = None
    sourceToSec: Optional[float] = None

    @model_validator(mode="after")
    def _ordered(self):
        if self.toSec <= self.fromSec:
            raise ValueError("toSec must be greater than fromSec")
        return self


class SetVolume(BaseModel):
    """Clip loudness: 0 = mute, 1 = original, up to 4 = boosted."""
    op: Literal["setVolume"]
    clipId: str
    volume: float = Field(ge=0, le=4)


class DeleteClip(BaseModel):
    """Delete a whole clip. Video/audio: its span is removed from every track (stays in sync)."""
    op: Literal["deleteClip"]
    clipId: str


class EditText(BaseModel):
    """Change an existing text clip's words."""
    op: Literal["editText"]
    clipId: str
    text: str = Field(min_length=1, max_length=120)


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
    Union[Trim, CutStart, RemoveRange, DeleteClip, EditText, SetVolume, Move, AddLowerThird, AddSubtitle, AddTransition],
    Field(discriminator="op"),
]


class Plan(BaseModel):
    summary: str
    ops: list[Op] = Field(default_factory=list, max_length=8)
    # Set when the request cannot be expressed with the allowed ops.
    unsupportedReason: Optional[str] = None
    # A plain answer when no edit is needed (questions, "that's already done", clarifications).
    reply: Optional[str] = None


class Rejected(BaseModel):
    """An op the model proposed that failed semantic validation even after repair."""
    op: dict
    reason: str
