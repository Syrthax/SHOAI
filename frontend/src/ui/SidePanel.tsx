import { useEffect, useState } from 'react'
import { useSelectionStore } from '@elah/editor'
import { Bot, SlidersHorizontal } from 'lucide-react'
import ChatPanel from './ChatPanel'
import EditPanel from './EditPanel'
import SampleClipsButton from './SampleClipsButton'

export default function SidePanel() {
  const [tab, setTab] = useState<'ai' | 'edit'>('ai')
  const selected = useSelectionStore((s) => s.selectedClipIds.size)
  // Selecting a clip on the timeline jumps to its controls.
  useEffect(() => { if (selected) setTab('edit') }, [selected])

  return (
    <aside className="chat">
      <div className="tabs">
        <button className={`tab ${tab === 'ai' ? 'on' : ''}`} onClick={() => setTab('ai')}><Bot size={14} /> AI Copilot</button>
        <button className={`tab ${tab === 'edit' ? 'on' : ''}`} onClick={() => setTab('edit')}><SlidersHorizontal size={14} /> Edit</button>
        <span className="spacer" />
        <SampleClipsButton />
      </div>
      {/* Keep the chat mounted so an in-progress AI plan survives tab switches. */}
      <div className="tab-body" hidden={tab !== 'ai'}><ChatPanel /></div>
      <div className="tab-body" hidden={tab !== 'edit'}><EditPanel /></div>
    </aside>
  )
}
