// Shared flag: is an AI preview currently applied to the timeline (not yet kept or discarded)?
// The toolbar reads it to block Undo/Redo/Export, which would otherwise tangle with the preview.
import { useSyncExternalStore } from 'react'

let active = false
const listeners = new Set<() => void>()

export function setAiPreviewActive(v: boolean) {
  if (v === active) return
  active = v
  listeners.forEach((l) => l())
}

export function useAiPreviewActive() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l) },
    () => active,
  )
}
