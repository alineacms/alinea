import {type CSSProperties, useEffect, useMemo} from 'react'
import {AppLoading} from './App.js'
import {SyncEvent} from './boot/SyncEvent.js'
import {StoryProvider} from './StoryProvider.js'

const frameStyle: CSSProperties = {height: 480}

interface LoadingStoryProps {
  /** Sends the sync events the dashboard worker would send */
  run?(events: EventTarget): () => void
}

function LoadingStory({run}: LoadingStoryProps) {
  const events = useMemo(() => new EventTarget(), [])
  useEffect(() => run?.(events), [events, run])
  return (
    <StoryProvider events={events}>
      <div style={frameStyle}>
        <AppLoading />
      </div>
    </StoryProvider>
  )
}

function show(loaded: number, total: number) {
  return (events: EventTarget) => {
    events.dispatchEvent(new SyncEvent({loaded, total}))
    return () => {}
  }
}

const syncing = show(1240, 4800)
const indexing = show(4800, 4800)

/** Fetches 4,800 files in batches, indexes them and starts over */
function simulate(events: EventTarget) {
  const total = 4800
  let loaded = 0
  const timer = setInterval(() => {
    if (loaded > total + 1200) loaded = 0
    else loaded += 120
    events.dispatchEvent(
      new SyncEvent(
        loaded > total
          ? loaded > total + 1000
            ? undefined
            : {loaded: total, total}
          : {loaded, total}
      )
    )
  }, 100)
  return () => clearInterval(timer)
}

/** Before the total of a sync is known, or without a sync */
export function Waiting() {
  return <LoadingStory />
}

export function Syncing() {
  return <LoadingStory run={syncing} />
}

/** All files are fetched, they are written and indexed */
export function Indexing() {
  return <LoadingStory run={indexing} />
}

/** A full sync from start to end, repeated */
export function Sync() {
  return <LoadingStory run={simulate} />
}

export default {
  title: 'Dashboard / Loading'
}
