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

function nested(
  key: string,
  label: string,
  yours: unknown,
  theirs: unknown
): EntryMergeField {
  return {key, label, simple: false, yours, theirs, paths: [['row']]}
}

function paragraphs(...lines: Array<string>) {
  return lines.map(text => ({
    _type: 'paragraph',
    content: [{_type: 'text', text}]
  }))
}

function sections(count: number) {
  return Array.from({length: count}, (_, index) => ({
    _id: `section-${index}`,
    _index: `a${index}`,
    _type: 'Text',
    title: `Section ${index + 1}`
  }))
}

const simpleFields: EntryMerge = {
  name: 'Sam',
  date: minutesAgo(2),
  merged: [],
  fields: [
    simple('title', 'Title', 'Spring sale starts Monday', 'Spring sale'),
    simple(
      'summary',
      'Summary',
      '',
      'Twenty percent off all plants and pots, this weekend only. Visit the shop in town or order online, delivery is free for orders over fifty euros and we plant trees for every order.'
    ),
    simple('servings', 'Servings', 4, 6)
  ]
}

const listsAndRichText: EntryMerge = {
  name: 'Sam',
  date: minutesAgo(5),
  merged: ['Intro', 'Tags'],
  fields: [
    simple('title', 'Title', 'Spring sale starts Monday', 'Spring sale'),
    nested(
      'body',
      'Body',
      paragraphs(
        'Our spring sale starts Monday with twenty percent off all plants.',
        'Come early, the best ones go first.'
      ),
      paragraphs('The spring sale is on: twenty percent off everything green.')
    ),
    nested('sections', 'Sections', sections(3), sections(4))
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
