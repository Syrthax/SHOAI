// The ONLY place where AI output touches the editor. Everything goes through TimelineEngine,
// and engine.batch() makes the whole AI action ONE undo step.
import { secondsToFrames, useTracksStore } from '@elah/editor'
import type { Op } from '../ai/schema'

const center = (x: number, y: number) => ({ x, y, scale: 1, rotation: 0, anchor: { x: 0.5, y: 0.5 } })

export function applyOps(engine: any, ops: Op[], fps: number, label: string) {
  if (!ops.length) return
  const f = (s: number) => Math.max(0, secondsToFrames(s, fps))
  const { tracks, clips } = useTracksStore.getState() as any
  const all: any[] = Object.values(clips ?? {}).flat() as any[]
  const find = (id: string) => all.find((c) => c.id === id)
  const textTrack = tracks.find((t: any) => t.kind === 'elements')

  engine.batch(() => {
    for (const o of ops) {
      switch (o.op) {
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
          const a = find(o.fromClipId)
          if (a) engine.addTransition({
            fromClipId: o.fromClipId, toClipId: o.toClipId, trackId: a.trackId,
            kind: o.kind, durationFrames: Math.max(1, f(o.durationSec)),
          })
          break
        }
      }
    }
  }, `AI: ${label}`)
}
