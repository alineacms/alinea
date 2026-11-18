import {Field as CoreField} from '#/core/Field.js'
import {mergeData} from '#/core/graft/MergeData.js'
import type {Schema} from '#/core/Schema.js'
import {Type} from '#/core/Type.js'
import {Config, Field} from '#/index.js'
import {shape} from '@alinea/graft'
import {suite} from '@alinea/suite'

const test = suite(import.meta)

const Text = Config.type('Text', {
  fields: {body: Field.text('Body', {multiline: true})}
})

const Page = Config.document('Page', {
  fields: {
    tags: Field.select.multiple('Tags', {options: {a: 'A', b: 'B'}}),
    body: Field.richText('Body', {schema: {Text}}),
    blocks: Field.list('Blocks', {schema: {Text}}),
    meta: Field.object('Meta', {fields: {note: Field.text('Note')}})
  }
})

test('fields declare their shape', () => {
  const {fields} = Type.shape(Page)
  test.equal(fields.title, shape.text({unit: 'line'}))
  test.equal(fields.tags, shape.set())
  test.is(fields.body.kind, 'richText')
  const blocks = fields.blocks
  test.is(blocks.kind, 'list')
  if (blocks.kind !== 'list') return
  test.equal(blocks.identity, shape.byKey('_id', {fallback: shape.byMatch()}))
  test.equal(blocks.order, shape.byFractionalKey('_index'))
  test.is(fields.meta.kind, 'record')
})

test('fields without a shape merge as unknown values', () => {
  test.equal(CoreField.shape(Field.number('Count')), shape.unknown())
  test.equal(CoreField.shape(Field.json('Data')), shape.unknown())
})

test('custom fields declare their own shape', () => {
  const custom = new CoreField({
    options: {label: 'Custom'},
    view: undefined as any,
    shape: shape.set()
  })
  test.equal(CoreField.shape(custom), shape.set())
})

test('types that contain themselves give shapes that refer to themselves', () => {
  const blocks: Schema = {}
  const Section = Config.type('Section', {
    fields: {
      title: Field.text('Title'),
      children: Field.list('Children', {schema: blocks})
    }
  })
  blocks.Section = Section
  const section = Type.shape(Section)
  const children = section.fields.children
  if (children.kind !== 'list' || children.item.kind !== 'union')
    throw new Error('Expected a list of a union')
  test.is(children.item.variants.Section, section)
  test.equal(Object.keys(children.item.variants), ['Section'])
})

test('rich text merges text and marks', () => {
  const paragraph = (...content: Array<object>) => ({
    _type: 'paragraph',
    content
  })
  const base = {
    title: 'Home',
    body: [paragraph({_type: 'text', text: 'Hello world'})]
  }
  const ours = {
    ...base,
    body: [
      paragraph(
        {_type: 'text', text: 'Hello '},
        {_type: 'text', text: 'world', marks: [{_type: 'bold'}]}
      )
    ]
  }
  const theirs = {
    ...base,
    title: 'Start',
    body: [paragraph({_type: 'text', text: 'Hi world'})]
  }
  test.equal(mergeData(Page, base, ours, theirs), {
    title: 'Start',
    body: [
      paragraph(
        {_type: 'text', text: 'Hi '},
        {_type: 'text', text: 'world', marks: [{_type: 'bold'}]}
      )
    ]
  })
})

test('list rows merge by id', () => {
  const row = (_id: string, _index: string, body: string) => ({
    _id,
    _index,
    _type: 'Text',
    body
  })
  const base = {blocks: [row('a', 'a0', 'A'), row('b', 'a1', 'B')]}
  const ours = {blocks: [row('b', 'a1', 'B edited'), row('a', 'a0', 'A')]}
  const theirs = {
    blocks: [
      row('a', 'a0', 'A edited'),
      row('b', 'a1', 'B'),
      row('c', 'a2', 'C')
    ]
  }
  test.equal(mergeData(Page, base, ours, theirs), {
    blocks: [
      row('a', 'a0', 'A edited'),
      row('b', 'a1', 'B edited'),
      row('c', 'a2', 'C')
    ]
  })
})

const Renamed = Config.document('Renamed', {
  renamed: {subtitle: 'tagline'},
  fields: {
    tagline: Field.text('Tagline'),
    rows: Field.list('Rows', {
      schema: {
        Row: Config.type('Row', {
          renamed: {caption: 'label'},
          fields: {label: Field.text('Label')}
        })
      }
    })
  }
})

test('an edit under an old name lands in the new name', () => {
  // A dashboard on the old schema kept the new field as it read it
  const base = {title: 'A', tagline: 'Stored', subtitle: ''}
  const ours = {title: 'A', tagline: 'Stored', subtitle: 'Edited'}
  const theirs = {title: 'A', tagline: 'Stored'}
  test.equal(mergeData(Renamed, base, ours, theirs), {
    title: 'A',
    tagline: 'Edited'
  })
})

test('an old name left alone keeps the stored value', () => {
  const base = {title: 'A', tagline: 'Stored', subtitle: ''}
  const ours = {title: 'B', tagline: 'Stored', subtitle: ''}
  const theirs = {title: 'A', tagline: 'Changed'}
  test.equal(mergeData(Renamed, base, ours, theirs), {
    title: 'B',
    tagline: 'Changed'
  })
})

test('a rename inside list rows', () => {
  const base = {
    rows: [{_id: 'r', _index: 'a0', _type: 'Row', label: 'Stored', caption: ''}]
  }
  const ours = {
    rows: [
      {_id: 'r', _index: 'a0', _type: 'Row', label: 'Stored', caption: 'New'}
    ]
  }
  const theirs = {
    rows: [{_id: 'r', _index: 'a0', _type: 'Row', label: 'Stored'}]
  }
  test.equal(mergeData(Renamed, base, ours, theirs), {
    rows: [{_id: 'r', _index: 'a0', _type: 'Row', label: 'New'}]
  })
})
