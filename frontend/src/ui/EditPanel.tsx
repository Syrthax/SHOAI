// Manual editing: add text, style the selected clip, sound, speed, transitions.
// Continuous inputs use previewClip + commitInteraction (one undo per gesture); one-shot changes use updateClip.
import { useState, useSyncExternalStore } from 'react'
import {
  secondsToFrames, useMediaLibrary, usePlaybackStore, useSelectionStore, useTimelineEngine, useTracksStore,
} from '@elah/editor'
import { Captions, Heading1, Sparkles, Type, Volume2, VolumeX } from 'lucide-react'
import { FPS } from '../config'

const center = (x: number, y: number) => ({ x, y, scale: 1, rotation: 0, anchor: { x: 0.5, y: 0.5 } })
const ANIMS = ['none', 'fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'spin'] as const

const TEXT_PRESETS = {
  title: { label: 'Title', icon: Heading1, transform: center(0.5, 0.45),
    text: { content: 'Your title', fontSize: 96, color: '#ffffff', fontWeight: 'bold', textAlign: 'center' }, anim: 'fade' },
  subtitle: { label: 'Subtitle', icon: Captions, transform: center(0.5, 0.9),
    text: { content: 'Subtitle text', fontSize: 44, color: '#ffffff', textAlign: 'center', backgroundColor: '#000000', backgroundOpacity: 0.55, padding: 12, borderRadius: 8 }, anim: 'fade' },
  lower: { label: 'Lower third', icon: Type, transform: center(0.25, 0.82),
    text: { content: 'Your Name', fontSize: 56, color: '#ffffff', fontWeight: 'bold', textAlign: 'left', backgroundColor: '#7c3aed', backgroundOpacity: 0.85, padding: 16, borderRadius: 10 }, anim: 'slide-right' },
} as const

export default function EditPanel() {
  const engine = useTimelineEngine() as any
  const tracks = useTracksStore((s) => s.tracks)
  const clips = useTracksStore((s) => s.clips)
  const selectedId = useSelectionStore((s) => [...s.selectedClipIds][0])
  const { assets } = useMediaLibrary()
  const all = Object.values(clips).flat() as any[]
  const clip = all.find((c) => c.id === selectedId)

  const addText = (key: keyof typeof TEXT_PRESETS) => {
    const p = TEXT_PRESETS[key]
    const track = tracks.find((t: any) => t.kind === 'elements')
    if (!track) return
    let added: string | undefined
    const start = usePlaybackStore.getState().currentFrame
    engine.batch(() => {
      added = engine.addClip({
        type: 'text', trackId: track.id, startFrame: start,
        durationFrames: secondsToFrames(3, FPS), transform: p.transform, text: p.text,
      })?.id
      if (added) engine.updateClip(added, track.id, { textAnimation: { in: p.anim, out: 'fade', durationFrames: 12 } })
    }, `Add ${p.label.toLowerCase()}`)
    if (added) {
      useSelectionStore.getState().selectClip(added)
      // Step past the fade-in so the new text is visible right away.
      usePlaybackStore.getState().setCurrentFrame(start + 15)
    }
  }

  return (
    <div className="edit">
      <section>
        <h4>Add text at playhead</h4>
        <div className="grid3">
          {(Object.keys(TEXT_PRESETS) as (keyof typeof TEXT_PRESETS)[]).map((k) => {
            const P = TEXT_PRESETS[k]
            return <button key={k} className="tile" onClick={() => addText(k)}><P.icon size={18} />{P.label}</button>
          })}
        </div>
      </section>

      {!clip && <p className="hint">Click a clip on the timeline to edit it. Drag its edges to trim; use the scissors to split.</p>}
      {clip?.type === 'text' && <TextControls clip={clip} engine={engine} />}
      {(clip?.type === 'video' || clip?.type === 'audio') && (
        <>
          <SoundControls key={clip.id} clip={clip} all={all} assets={assets} engine={engine} />
          {clip.type === 'video' && <VideoControls clip={clip} engine={engine} />}
          {clip.type === 'video' && <TransitionControls clip={clip} all={all} engine={engine} />}
        </>
      )}
    </div>
  )
}

function Slider({ label, value, min, max, step, fmt, onPreview, onCommit }: {
  label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string
  onPreview: (v: number) => void; onCommit: () => void
}) {
  return (
    <label className="row-field">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onPreview(+e.target.value)} onPointerUp={onCommit} onKeyUp={onCommit} />
      <em>{fmt(value)}</em>
    </label>
  )
}

function TextControls({ clip, engine }: { clip: any; engine: any }) {
  const set = (patch: object) => engine.updateClip(clip.id, clip.trackId, patch)
  const preview = (patch: object) => engine.previewClip(clip.id, clip.trackId, patch)
  const anim = clip.textAnimation ?? {}
  const hasBg = (clip.backgroundOpacity ?? 0) > 0
  return (
    <section>
      <h4>Text</h4>
      <input className="text-input" value={clip.content ?? ''}
        onChange={(e) => preview({ content: e.target.value })} onBlur={() => engine.commitInteraction('Edit text')} />
      <Slider label="Size" value={clip.fontSize ?? 48} min={16} max={200} step={1} fmt={(v) => `${v}px`}
        onPreview={(v) => preview({ fontSize: v })} onCommit={() => engine.commitInteraction('Resize text')} />
      <div className="row-field">
        <span>Style</span>
        <input type="color" value={clip.color ?? '#ffffff'} onChange={(e) => set({ color: e.target.value })} title="Text colour" />
        <button className={`ghost chip ${clip.fontWeight === 'bold' ? 'on' : ''}`}
          onClick={() => set({ fontWeight: clip.fontWeight === 'bold' ? 'normal' : 'bold' })}>Bold</button>
        <button className={`ghost chip ${hasBg ? 'on' : ''}`}
          onClick={() => set(hasBg ? { backgroundOpacity: 0 } : { backgroundColor: clip.backgroundColor ?? '#000000', backgroundOpacity: 0.6, padding: 14, borderRadius: 8 })}>Box</button>
        {hasBg && <input type="color" value={clip.backgroundColor ?? '#000000'} onChange={(e) => set({ backgroundColor: e.target.value })} title="Box colour" />}
      </div>
      <div className="row-field">
        <span>Animate</span>
        <select value={anim.in ?? 'none'} onChange={(e) => set({ textAnimation: { ...anim, in: e.target.value === 'none' ? undefined : e.target.value, durationFrames: anim.durationFrames ?? 12 } })}>
          {ANIMS.map((a) => <option key={a} value={a}>in: {a}</option>)}
        </select>
        <select value={anim.out ?? 'none'} onChange={(e) => set({ textAnimation: { ...anim, out: e.target.value === 'none' ? undefined : e.target.value, durationFrames: anim.durationFrames ?? 12 } })}>
          {ANIMS.map((a) => <option key={a} value={a}>out: {a}</option>)}
        </select>
      </div>
    </section>
  )
}

// A video's sound usually lives on a separate audio clip (same source, same start), so sound
// controls apply to the selected clip AND its linked partner.
function linked(clip: any, all: any[]) {
  return all.filter((c) => c.id === clip.id ||
    (c.src && c.src === clip.src && c.startFrame === clip.startFrame && c.trackId !== clip.trackId))
}

function SoundControls({ clip, all, assets, engine }: { clip: any; all: any[]; assets: any[]; engine: any }) {
  const group = linked(clip, all)
  const audio = group.find((c) => c.type === 'audio') ?? clip
  const volume = audio.volume ?? 1
  const previewAll = (v: number) => group.forEach((c) => engine.previewClip(c.id, c.trackId, { volume: v }))
  const setAll = (v: number, label: string) =>
    engine.batch(() => group.forEach((c) => engine.updateClip(c.id, c.trackId, { volume: v })), label)

  const [enhancing, setEnhancing] = useState<string | null>(null)
  // Loudness normalisation: decode the real audio, measure its RMS loudness and its peak, then pick
  // the gain that brings speech to ~-20 dBFS without pushing peaks far past full scale.
  const enhance = async () => {
    const src = audio.src ?? assets.find((a) => a.id === audio.assetId)?.src
    if (!src) return
    setEnhancing('Analysing...')
    try {
      const ctx = new AudioContext()
      const buf = await ctx.decodeAudioData(await (await fetch(src)).arrayBuffer())
      ctx.close()
      const data = buf.getChannelData(0)
      const from = Math.floor((audio.sourceStartFrame / FPS) * buf.sampleRate)
      const to = Math.min(data.length, from + Math.floor((audio.durationFrames / FPS) * buf.sampleRate))
      let sum = 0, n = 0, peak = 0
      for (let i = from; i < to; i += 8) { const v = data[i]; sum += v * v; n++; peak = Math.max(peak, Math.abs(v)) }
      const rms = Math.sqrt(sum / Math.max(n, 1))
      if (rms < 1e-4) { setEnhancing('No sound found in this clip'); return }
      const gain = Math.min(0.1 / rms, 1.4 / Math.max(peak, 1e-3), 4)
      setAll(+gain.toFixed(2), 'Enhance audio')
      const db = 20 * Math.log10(gain)
      setEnhancing(`${db >= 0 ? '+' : ''}${db.toFixed(1)} dB applied`)
    } catch {
      setEnhancing('Could not analyse this audio')
    }
  }

  return (
    <section>
      <h4>Sound</h4>
      <Slider label="Volume" value={volume} min={0} max={3} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`}
        onPreview={previewAll} onCommit={() => engine.commitInteraction('Change volume')} />
      <div className="row-field">
        <span />
        <button className="chip" onClick={enhance} disabled={enhancing === 'Analysing...'} title="Normalise loudness so quiet audio becomes clear"><Sparkles size={13} /> Enhance audio</button>
        <button className="ghost chip" onClick={() => setAll(volume === 0 ? 1 : 0, volume === 0 ? 'Unmute' : 'Mute')}>
          {volume === 0 ? <><Volume2 size={13} /> Unmute</> : <><VolumeX size={13} /> Mute</>}
        </button>
      </div>
      {enhancing && <p className="hint">{enhancing}</p>}
    </section>
  )
}

function VideoControls({ clip, engine }: { clip: any; engine: any }) {
  const speed = clip.speed ?? 1
  return (
    <section>
      <h4>Video</h4>
      <div className="row-field">
        <span>Speed</span>
        {[0.5, 1, 1.5, 2].map((s) => (
          <button key={s} className={`ghost chip ${speed === s ? 'on' : ''}`}
            onClick={() => engine.setClipSpeed(clip.id, clip.trackId, s)}>{s}x</button>
        ))}
      </div>
      <Slider label="Opacity" value={clip.opacity ?? 1} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`}
        onPreview={(v) => engine.previewClip(clip.id, clip.trackId, { opacity: v })}
        onCommit={() => engine.commitInteraction('Change opacity')} />
    </section>
  )
}

function TransitionControls({ clip, all, engine }: { clip: any; all: any[]; engine: any }) {
  const end = clip.startFrame + clip.durationFrames
  const next = all.find((c) => c.trackId === clip.trackId && c.id !== clip.id && Math.abs(c.startFrame - end) <= 2)
  // Transitions aren't in useTracksStore, so subscribe to the engine directly.
  const transitions = useSyncExternalStore(
    (cb) => { engine.on('change', cb); return () => engine.off('change', cb) },
    () => engine.getProject().transitions,
  )
  const existing = (transitions ?? []).find((t: any) => t.fromClipId === clip.id)
  if (!next) return (
    <section><h4>Transition</h4><p className="hint">Split the clip or place another clip right after this one to add a transition.</p></section>
  )
  const add = (kind: 'fade' | 'slide' | 'wipe') => engine.batch(() => {
    if (existing) engine.removeTransition(existing.id)
    engine.addTransition({ fromClipId: clip.id, toClipId: next.id, trackId: clip.trackId, kind, durationFrames: secondsToFrames(0.8, FPS), easing: 'ease-out', ...(kind === 'slide' ? { direction: 'left' } : {}) })
  }, `Add ${kind} transition`)
  return (
    <section>
      <h4>Transition to next clip</h4>
      <div className="row-field">
        {(['fade', 'slide', 'wipe'] as const).map((k) => (
          <button key={k} className={`ghost chip ${existing?.kind === k ? 'on' : ''}`} onClick={() => add(k)}>{k}</button>
        ))}
        {existing && <button className="ghost chip" onClick={() => engine.removeTransition(existing.id)}>remove</button>}
      </div>
    </section>
  )
}
