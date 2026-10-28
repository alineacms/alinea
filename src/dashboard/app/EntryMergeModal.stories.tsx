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
  return {key, label, simple: true, base: undefined, yours, theirs, paths: [[]]}
}

function nested(
  key: string,
  label: string,
  base: unknown,
  yours: unknown,
  theirs: unknown
): EntryMergeField {
  return {key, label, simple: false, base, yours, theirs, paths: [['row']]}
}

function paragraphs(...lines: Array<string>) {
  return lines.map(text => ({
    _type: 'paragraph',
    content: [{_type: 'text', text}]
  }))
}

function section(id: number, title = `Section ${id}`) {
  return {_id: `section-${id}`, _index: `a${id}`, _type: 'Text', title}
}

const body = {
  base: paragraphs(
    'Our spring sale starts Monday.',
    'Come early, the best ones go first.'
  ),
  yours: paragraphs(
    'Our spring sale starts Monday with twenty percent off all plants.',
    'Come early, the best ones go first.'
  ),
  theirs: paragraphs(
    'Our spring sale starts Monday.',
    'Come early, the best ones go first.',
    'Delivery is free for orders over fifty euros.'
  )
}

const sections = {
  base: [section(1), section(2), section(3)],
  yours: [section(1, 'Opening hours'), section(2), section(3)],
  theirs: [section(1), section(3), section(4)]
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
    nested('body', 'Body', body.base, body.yours, body.theirs),
    nested(
      'sections',
      'Sections',
      sections.base,
      sections.yours,
      sections.theirs
    )
  ]
}

const manyFields: EntryMerge = {
  name: 'Sam',
  date: minutesAgo(12),
  merged: ['Intro'],
  fields: [
    ...Array.from({length: 10}, (_, index) =>
      simple(
        `field${index}`,
        `Field ${index + 1}`,
        `My value ${index + 1}`,
        `Their value ${index + 1}`
      )
    ),
    nested('body', 'Body', body.base, body.yours, body.theirs),
    nested(
      'sections',
      'Sections',
      sections.base,
      sections.yours,
      sections.theirs
    )
  ]
}

const longText =
  'A very long description that goes on and on about the spring sale, the plants and pots on offer, the opening hours of the shop in town, the delivery options and the trees we plant for every order, so it never fits in a card.'

const longValues: EntryMerge = {
  name: 'Sam',
  date: minutesAgo(1),
  merged: [],
  fields: [
    simple('summary', 'Summary', longText, `${longText} ${longText}`),
    simple(
      'link',
      'Link',
      'https://example.com/shop/spring-sale/plants-and-pots/twenty-percent-off/this-weekend-only?utm_source=newsletter&utm_campaign=spring',
      'Supercalifragilisticexpialidociousplantsandpotsforeverybodyinthewholetown'
    ),
    nested(
      'body',
      'Body',
      paragraphs('First line'),
      paragraphs(longText, 'Second paragraph', 'Third paragraph'),
      paragraphs('First line', longText)
    )
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

/** Review changes on Body or Sections opens the detail of the field */
export function ListsAndRichText() {
  return <MergeStory merge={listsAndRichText} />
}

export function ManyFields() {
  return <MergeStory merge={manyFields} />
}

export function LongValues() {
  return <MergeStory merge={longValues} />
}

export function Publish() {
  return <MergeStory merge={listsAndRichText} publish />
}

export default {
  title: 'Dashboard / EntryMergeModal'
}
