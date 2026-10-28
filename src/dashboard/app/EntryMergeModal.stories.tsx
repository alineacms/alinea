import type {EntryMerge} from '#/dashboard/atoms/entryMerge.js'
import {useState} from 'react'
import {EntryMergeModal} from './EntryMergeModal.js'

const merge: EntryMerge = {
  name: 'Sam',
  date: Date.now() - 5 * 60_000,
  merged: ['Intro', 'Tags'],
  fields: [
    {
      key: 'title',
      label: 'Title',
      simple: true,
      yours: 'Spring sale starts Monday',
      theirs: 'Spring sale',
      paths: [[]]
    },
    {
      key: 'body',
      label: 'Body',
      simple: false,
      yours: [],
      theirs: [],
      paths: [['row-1', 'text']]
    }
  ]
}

interface MergeStoryProps {
  publish?: boolean
}

function MergeStory({publish}: MergeStoryProps) {
  const [result, setResult] = useState<string>()
  return (
    <>
      <EntryMergeModal
        merge={result ? undefined : merge}
        publish={publish}
        onApply={choices => setResult(JSON.stringify(choices))}
        onDiscard={() => setResult('Discarded')}
        onClose={() => setResult('Closed')}
      />
      {result && <pre>{result}</pre>}
    </>
  )
}

export function Draft() {
  return <MergeStory />
}

export function Publish() {
  return <MergeStory publish />
}

export default {
  title: 'Dashboard / EntryMergeModal'
}
