import { insertMediaAsset, useMediaLibrary, useTimelineEngine, useTracksStore } from '@elah/editor'

// Import files and place each one at the end of the timeline, no dragging needed.
export function useUploadVideo() {
  const engine = useTimelineEngine()
  const { importFiles } = useMediaLibrary()

  async function addFiles(files: File[]) {
    if (!files.length) return
    const { imported, skipped } = await importFiles(files)
    if (skipped.length) alert(`Skipped ${skipped.length} unsupported file(s).`)
    for (const asset of imported) {
      const placed = await insertMediaAsset(engine, asset.id, { desiredStartFrame: useTracksStore.getState().totalFrames })
      if (!placed.ok) alert(`Could not place ${asset.name}: ${placed.reason}`)
    }
  }

  function openPicker() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'video/*,audio/*,image/*'
    input.multiple = true
    input.onchange = () => addFiles(Array.from(input.files ?? []))
    input.click()
  }

  return { openPicker, addFiles }
}
