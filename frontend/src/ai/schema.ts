// Mirrors backend/app/schema.py (Pydantic). Backend is the source of truth for shape.
export type Op =
  | { op: 'trim'; clipId: string; startSec: number; durationSec: number }
  | { op: 'move'; clipId: string; startSec: number }
  | { op: 'addLowerThird'; text: string; startSec: number; durationSec: number }
  | { op: 'addSubtitle'; text: string; startSec: number; durationSec: number }
  | { op: 'addTransition'; fromClipId: string; toClipId: string; kind: 'fade' | 'slide' | 'wipe'; durationSec: number }

export interface Plan {
  summary: string
  ops: Op[]
  unsupportedReason: string | null
}

export interface ClipInfo {
  id: string
  trackId: string
  type: string
  name: string
  startSec: number
  durationSec: number
}

export interface TimelineSummary {
  fps: number
  durationSec: number
  clips: ClipInfo[]
}

export function describeOp(o: Op): string {
  switch (o.op) {
    case 'trim': return `Trim clip ${o.clipId.slice(0, 6)}: start ${o.startSec}s, length ${o.durationSec}s`
    case 'move': return `Move clip ${o.clipId.slice(0, 6)} to ${o.startSec}s`
    case 'addLowerThird': return `Lower third "${o.text}" at ${o.startSec}s for ${o.durationSec}s`
    case 'addSubtitle': return `Subtitle "${o.text}" at ${o.startSec}s for ${o.durationSec}s`
    case 'addTransition': return `${o.kind} transition (${o.durationSec}s) between two clips`
  }
}
