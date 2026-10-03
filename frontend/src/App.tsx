import { useRef } from 'react'
import {
  EditorProvider, Preview, Timeline, AssetPanel,
  createDefaultDemuxerFactory, type InitialTrackConfig, type TimelineRef,
} from '@elah/editor'
import ChatPanel from './ui/ChatPanel'
import Toolbar from './ui/Toolbar'
import { FPS } from './config'


const demuxerFactory = createDefaultDemuxerFactory()
const TRACKS: InitialTrackConfig[] = [
  { kind: 'video', name: 'Video' },
  { kind: 'elements', name: 'Text & Shapes' },
  { kind: 'audio', name: 'Audio' },
]

export default function App() {
  const timelineRef = useRef<TimelineRef>(null)
  return (
    <EditorProvider fps={FPS} stage={{ width: 1920, height: 1080 }} initialTracks={TRACKS}>
      <div className="elah-root app">
        <AssetPanel style={{ width: 220, flexShrink: 0 }} />
        <div className="center">
          <Preview demuxerFactory={demuxerFactory} style={{ flex: 1, minHeight: 0 }} />
          <Toolbar timelineRef={timelineRef} />
          <Timeline ref={timelineRef} fps={FPS} style={{ height: 240, flexShrink: 0 }} />
        </div>
        <ChatPanel />
      </div>
    </EditorProvider>
  )
}
