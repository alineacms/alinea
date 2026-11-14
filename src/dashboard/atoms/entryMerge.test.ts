import {Config, Field} from '#/index.js'
import {expect, test} from 'bun:test'
import {entryMerge} from './entryMerge.js'

const Section = Config.type('Section', {fields: {title: Field.text('Title')}})
const Page = Config.document('Page', {
  fields: {
    body: Field.richText('Body'),
    sections: Field.list('Sections', {schema: {Section}})
  }
})

function paragraph(text: string) {
  return {_type: 'paragraph', content: [{_type: 'text', text}]}
}

function section(title: string) {
  return {_id: 'a', _index: 'a0', _type: 'Section', title}
}

test('rich text with paragraphs is yours or theirs, rows combine', () => {
  const merge = entryMerge({
    type: Page,
    loaded: {body: [paragraph('Base')], sections: [section('Base')]},
    mine: {body: [paragraph('Mine')], sections: [section('Mine')]},
    theirs: {body: [paragraph('Theirs')], sections: [section('Theirs')]},
    conflicts: [['body'], ['sections', 'a', 'title']],
    locale: null,
    links: new Map()
  })
  expect(merge.fields).toMatchObject([
    {key: 'body', label: 'Body', simple: true},
    {key: 'sections', label: 'Sections', simple: false}
  ])
})
