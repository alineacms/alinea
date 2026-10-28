import {Button} from '#/components.js'
import type {EntryMerge, EntryMergeField} from '#/dashboard/atoms/entryMerge.js'
import {useState} from 'react'
import {EntryMergeModal} from './EntryMergeModal.js'

const minutesAgo = (minutes: number) => Date.now() - minutes * 60_000

function simple(
  key: string,
  label: string,
  yours: unknown,
  theirs: unknown
): EntryMergeField {
  return {key, label, simple: true, yours, theirs, paths: [[]]}
}

function nested(key: string, label: string): EntryMergeField {
  return {key, label, simple: false, yours: [], theirs: [], paths: [['row']]}
}

const simpleFields: EntryMerge = {
  name: 'Sam',
  date: minutesAgo(2),
  merged: [],
  fields: [
    simple('title', 'Title', 'Spring sale starts Monday', 'Spring sale'),
    simple('summary', 'Summary', '', 'Twenty percent off all plants'),
    simple('servings', 'Servings', 4, 6)
  ]
}

const listsAndRichText: EntryMerge = {
  name: 'Sam',
  date: minutesAgo(5),
  merged: ['Intro', 'Tags'],
  fields: [
    simple('title', 'Title', 'Spring sale starts Monday', 'Spring sale'),
    nested('body', 'Body'),
    nested('sections', 'Sections')
  ]
}

interface MergeStoryProps {
  merge: EntryMerge
  publish?: boolean
}

function MergeStory({merge, publish}: MergeStoryProps) {
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
      {result && (
        <>
          <pre>{result}</pre>
          <Button onClick={() => setResult(undefined)}>Show again</Button>
        </>
      )}
    </>
  )
}

export function SimpleFields() {
  return <MergeStory merge={simpleFields} />
}

export function ListsAndRichText() {
  return <MergeStory merge={listsAndRichText} />
}

export function Publish() {
  return <MergeStory merge={listsAndRichText} publish />
}

export default {
  title: 'Dashboard / EntryMergeModal'
}
