import { useState } from 'react'
import { insertMediaAsset, secondsToFrames, useMediaLibrary, useTimelineEngine, useTracksStore } from '@elah/editor'
import { FPS } from '../config'

// Matches backend/samples/timeline.json: intro (12s) then demo (8s), back to back on the video track.
const CLIPS = ['/sample-clips/intro.mp4', '/sample-clips/demo.mp4']

export default function SampleClipsButton() {
  const engine = useTimelineEngine()
  const { importUrl } = useMediaLibrary()
  const hasClips = useTracksStore((s) => Object.values(s.clips ?? {}).some((c: any) => c.length > 0))
  const [busy, setBusy] = useState(false)

  async function load() {
    setBusy(true)
    try {
      let start = 0
      for (const url of CLIPS) {
        const asset = await importUrl(url)
        const placed = await insertMediaAsset(engine, asset.id, { desiredStartFrame: start, videoOnly: true })
        if (!placed.ok) throw new Error(`Could not place ${asset.name}: ${placed.reason}`)
        start += secondsToFrames(asset.durationSec, FPS)
      }
    } catch (e: any) {
      alert(e.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  if (hasClips) return null
  return (
    <button className="ghost" onClick={load} disabled={busy}>
      {busy ? 'Loading...' : 'Load sample clips'}
    </button>
  )
}
