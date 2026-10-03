// The ONLY place where AI output touches the editor. Everything goes through TimelineEngine,
// and engine.batch() makes the whole AI action ONE undo step.
import { secondsToFrames } from '@elah/editor'
import type { Op } from '../ai/schema'

const center = (x: number, y: number) => ({ x, y, scale: 1, rotation: 0, anchor: { x: 0.5, y: 0.5 } })

export function applyOps(engine: any, ops: Op[], fps: number, label: string) {
  if (!ops.length) return
  const f = (s: number) => Math.max(0, secondsToFrames(s, fps))
  // Read the engine's project live: it updates synchronously inside batch(), so each op sees the
  // result of the ones before it.
  const project = () => engine.getProject()
  const clipsOn = (trackId: string): any[] => [...(project().clips[trackId] ?? [])]
  // splitClip gives the surviving piece a new id; later ops still use the AI's original id.
  const alias = new Map<string, string>()
  const find = (id: string): any => {
    const want = alias.get(id) ?? id
    return (Object.values(project().clips).flat() as any[]).find((x) => x.id === want)
  }
  const textTrack = project().tracks.find((t: any) => t.kind === 'elements')

  // Delete frames [a, b) from every track and pull everything after it left by (b - a).
  const removeRange = (a: number, b: number) => {
    const gap = b - a
    for (const track of project().tracks) {
      for (const c of clipsOn(track.id).sort((x, y) => x.startFrame - y.startFrame)) {
        const s = c.startFrame, e = c.startFrame + c.durationFrames
        if (e <= a) continue
        if (s >= b) { engine.moveClip(c.id, track.id, track.id, s - gap); continue }
        let mid = c.id, right: string | null = null
        if (s < a) { const p = engine.splitClip(mid, track.id, a); if (!p) continue; alias.set(c.id, p[0]); mid = p[1] }
        if (e > b) { const p = engine.splitClip(mid, track.id, b); if (!p) continue; mid = p[0]; right = p[1] }
        engine.removeClip(mid, track.id)
        if (right) {
          engine.moveClip(right, track.id, track.id, a)
          if (s >= a) alias.set(c.id, right)
        }
      }
    }
  }

  engine.batch(() => {
    for (const o of ops) {
      switch (o.op) {
        case 'removeRange':
          removeRange(f(o.fromSec), f(o.toSec))
          break
        case 'cutStart': {
          const c = find(o.clipId)
          if (!c) break
          const cut = f(o.seconds)
          const end = c.startFrame + c.durationFrames
          const parts = engine.splitClip(c.id, c.trackId, c.startFrame + cut)
          if (!parts) break
          const [left, right] = parts
          const later = clipsOn(c.trackId).filter((x) => x.startFrame >= end - 1).sort((x, y) => x.startFrame - y.startFrame)
          engine.removeClip(left, c.trackId)
          engine.moveClip(right, c.trackId, c.trackId, c.startFrame)
          alias.set(o.clipId, right)
          // Ripple: pull later clips on the same track left so no gap opens up.
          later.forEach((x) => engine.moveClip(x.id, x.trackId, x.trackId, Math.max(0, x.startFrame - cut)))
          break
        }
        case 'setVolume': {
          const c = find(o.clipId)
          if (c) engine.updateClip(c.id, c.trackId, { volume: o.volume })
          break
        }
        case 'trim': {
          const c = find(o.clipId)
          if (c) engine.trimClip(c.id, c.trackId, f(o.startSec), Math.max(1, f(o.durationSec)))
          break
        }
        case 'move': {
          const c = find(o.clipId)
          if (c) engine.moveClip(c.id, c.trackId, c.trackId, f(o.startSec))
          break
        }
        case 'addLowerThird':
        case 'addSubtitle': {
          if (!textTrack) break
          const lower = o.op === 'addLowerThird'
          engine.addClip({
            type: 'text',
            trackId: textTrack.id,
            startFrame: f(o.startSec),
            durationFrames: Math.max(1, f(o.durationSec)),
            transform: lower ? center(0.25, 0.82) : center(0.5, 0.92),
            text: {
              content: o.text,
              fontSize: lower ? 56 : 44,
              color: '#ffffff',
              fontWeight: lower ? 'bold' : 'normal',
              textAlign: lower ? 'left' : 'center',
            },
          })
          break
        }
        case 'addTransition': {
          const a = find(o.fromClipId), b = find(o.toClipId)
          if (a && b) engine.addTransition({
            fromClipId: a.id, toClipId: b.id, trackId: a.trackId,
            kind: o.kind, durationFrames: Math.max(1, f(o.durationSec)),
          })
          break
        }
      }
    }
  }, `AI: ${label}`)
}
