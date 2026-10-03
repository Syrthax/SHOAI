// Layer-2 validation: does the plan make sense for THIS timeline?
import type { Plan, TimelineSummary } from './schema'

export function validatePlan(plan: Plan, tl: TimelineSummary): string[] {
  const errors: string[] = []
  const byId = new Map(tl.clips.map((c) => [c.id, c]))
  const limit = Math.max(tl.durationSec, 1) * 2 // generous upper bound

  plan.ops.forEach((o, i) => {
    const at = `ops[${i}] (${o.op})`
    if ('clipId' in o && !byId.has(o.clipId)) errors.push(`${at}: clipId "${o.clipId}" does not exist`)
    if ('startSec' in o && o.startSec > limit) errors.push(`${at}: startSec ${o.startSec} is beyond the timeline`)
    if (o.op === 'trim') {
      const c = byId.get(o.clipId)
      if (c && o.durationSec > c.durationSec + 0.01) errors.push(`${at}: durationSec ${o.durationSec} exceeds clip length ${c.durationSec}`)
    }
    if (o.op === 'addTransition') {
      const a = byId.get(o.fromClipId), b = byId.get(o.toClipId)
      if (!a) errors.push(`${at}: fromClipId "${o.fromClipId}" does not exist`)
      if (!b) errors.push(`${at}: toClipId "${o.toClipId}" does not exist`)
      if (a && b && a.trackId !== b.trackId) errors.push(`${at}: clips must be on the same track`)
      if (a && b && Math.abs(a.startSec + a.durationSec - b.startSec) > 0.2) errors.push(`${at}: clips must be adjacent (end of first = start of second)`)
    }
  })
  return errors
}
