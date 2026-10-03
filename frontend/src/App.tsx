import { useRef } from 'react'
import {
  EditorProvider, Preview, Timeline, SourcePanel,
  createDefaultDemuxerFactory, type InitialTrackConfig, type TimelineRef,
} from '@elah/editor'
import SidePanel from './ui/SidePanel'
import TimelineDropZone from './ui/TimelineDropZone'
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
        <SourcePanel defaultLane="media" style={{ width: 240, flexShrink: 0 }} />
        <div className="center">
          <Preview demuxerFactory={demuxerFactory} style={{ flex: 1, minHeight: 0 }} />
          <Toolbar timelineRef={timelineRef} />
          <div className="timeline-wrap">
            <Timeline ref={timelineRef} fps={FPS} style={{ height: 240 }} />
            <TimelineDropZone />
          </div>
        </div>
        <SidePanel />
      </div>
    </EditorProvider>
  )
}
