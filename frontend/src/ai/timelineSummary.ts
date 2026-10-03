import { useTracksStore } from '@elah/editor'
import type { TimelineSummary } from './schema'

export function summarizeTimeline(fps: number): TimelineSummary {
  const { clips, totalFrames } = useTracksStore.getState() as any
  const all: any[] = Object.values(clips ?? {}).flat() as any[]
  return {
    fps,
    durationSec: (totalFrames ?? 0) / fps,
    clips: all.map((c) => ({
      id: c.id,
      trackId: c.trackId,
      type: c.type,
      name: c.name ?? c.content ?? '',
      startSec: c.startFrame / fps,
      durationSec: c.durationFrames / fps,
    })),
  }
}
