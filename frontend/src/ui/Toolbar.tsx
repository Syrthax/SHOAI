import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  framesToTimecode, lazyExportVideo, usePlaybackStore, useTimelineEngine, useTracksStore,
  type TimelineRef,
} from '@elah/editor'
import { Download, Maximize2, Pause, Play, Redo2, Undo2, X } from 'lucide-react'
import { FPS } from '../config'
import { useAiPreviewActive } from '../editor/aiPreview'

export default function Toolbar({ timelineRef }: { timelineRef: RefObject<TimelineRef | null> }) {
  const engine = useTimelineEngine()
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const currentFrame = usePlaybackStore((s) => s.currentFrame)
  const totalFrames = useTracksStore((s) => s.totalFrames)
  const canUndo = useTracksStore((s) => s.canUndo)
  const canRedo = useTracksStore((s) => s.canRedo)
  const previewing = useAiPreviewActive()
  const [pct, setPct] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fit = () => timelineRef.current?.fitToWindow()
  // Re-fit whenever the timeline length changes (clips loaded, AI cut kept/previewed) so edits stay visible.
  useEffect(() => {
    if (totalFrames > 0) requestAnimationFrame(fit)
  }, [totalFrames])

  async function exportVideo() {
    usePlaybackStore.getState().pause()
    const controller = new AbortController()
    abortRef.current = controller
    setPct(0)
    const run = (audioCodec: 'aac' | 'opus') =>
      lazyExportVideo(engine.getProject(), {
        videoCodec: 'avc', audioCodec, videoBitrate: 8_000_000, outputHeight: 1080,
        signal: controller.signal,
        onProgress: ({ frame, totalFrames }) => setPct(Math.round((frame / Math.max(totalFrames, 1)) * 100)),
      })
    try {
      let blob: Blob
      try {
        blob = await run('aac')
      } catch (err) {
        if ((err as Error).name === 'AbortError') throw err
        blob = await run('opus') // some browsers (Safari) can't encode AAC
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `shoai-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.mp4`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') alert(`Export failed: ${(err as Error).message}`)
    } finally {
      setPct(null)
      abortRef.current = null
    }
  }

  const busyMsg = 'Keep or discard the AI preview first'
  return (
    <div className="toolbar">
      <button className="ghost icon" onClick={() => usePlaybackStore.getState().togglePlayPause()} title="Play / Pause (Space)">
        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <span className="time">
        {framesToTimecode(currentFrame, FPS)} / {framesToTimecode(Math.max(totalFrames, 0), FPS)}
      </span>
      <span className="spacer" />
      <button className="ghost icon" disabled={!canUndo || previewing} onClick={() => engine.undo()}
        title={previewing ? busyMsg : 'Undo (Ctrl/Cmd+Z)'}><Undo2 size={14} /></button>
      <button className="ghost icon" disabled={!canRedo || previewing} onClick={() => engine.redo()}
        title={previewing ? busyMsg : 'Redo'}><Redo2 size={14} /></button>
      <button className="ghost icon" onClick={fit} title="Fit timeline to window"><Maximize2 size={14} /></button>
      {pct === null ? (
        <button className="ok" disabled={totalFrames === 0 || previewing} onClick={exportVideo}
          title={previewing ? busyMsg : 'Export and download MP4'}>
          <Download size={14} /> Export MP4
        </button>
      ) : (
        <span className="exporting">
          Exporting {pct}%
          <button className="ghost icon" onClick={() => abortRef.current?.abort()} title="Cancel export"><X size={14} /></button>
        </span>
      )}
    </div>
  )
}
