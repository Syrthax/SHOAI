import { useEffect, useState } from 'react'
import { useTracksStore } from '@elah/editor'
import { Upload } from 'lucide-react'
import { useUploadVideo } from '../editor/useUploadVideo'

// Covers the empty track lanes: click to pick a video, or drop files from the desktop.
export default function TimelineDropZone() {
  const empty = useTracksStore((s) => !Object.values(s.clips ?? {}).some((c: any) => c.length > 0))
  const { openPicker, addFiles } = useUploadVideo()
  const [over, setOver] = useState(false)
  // A drag that starts inside the page (a media card from the Media panel) must reach elah's own
  // timeline lanes underneath, so the overlay lets those through. Desktop file drags never fire
  // dragstart here, so they still land on the overlay.
  const [inAppDrag, setInAppDrag] = useState(false)
  useEffect(() => {
    const start = () => setInAppDrag(true)
    const end = () => setInAppDrag(false)
    document.addEventListener('dragstart', start)
    document.addEventListener('dragend', end)
    document.addEventListener('drop', end)
    return () => {
      document.removeEventListener('dragstart', start)
      document.removeEventListener('dragend', end)
      document.removeEventListener('drop', end)
    }
  }, [])
  if (!empty) return null

  return (
    <div
      className={`dropzone ${over ? 'over' : ''} ${inAppDrag ? 'passthrough' : ''}`}
      onClick={openPicker}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true) } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return
        e.preventDefault(); setOver(false)
        addFiles(Array.from(e.dataTransfer.files))
      }}
    >
      <Upload size={20} />
      <span><b>Click to upload a video</b> or drop it here</span>
    </div>
  )
}
