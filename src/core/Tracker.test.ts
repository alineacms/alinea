import {expectTypeOf, test} from 'bun:test'
import {Field} from '#/index.js'
import type {EntryReference} from '#/picker/entry/EntryReference.js'
import type {LinkRow} from '#/field/link/Link.js'
import {type FieldGetter, track} from './Tracker.js'

test('options trackers read empty single links as null', () => {
  const link = Field.link('Link')
  const entry = Field.entry('Entry')
  const links = Field.link.multiple('Links')
  const select = Field.select('Select', {options: {a: 'A'}})
  const text = Field.text('Text')
  track.options(Field.text('Tracked'), get => {
    expectTypeOf(get).toEqualTypeOf<FieldGetter>()
    expectTypeOf(get(link)).toEqualTypeOf<LinkRow | null>()
    expectTypeOf(get(entry)).toEqualTypeOf<EntryReference | null>()
    expectTypeOf(get(links)).toEqualTypeOf<Array<LinkRow>>()
    expectTypeOf(get(select)).toEqualTypeOf<'a' | null>()
    expectTypeOf(get(text)).toEqualTypeOf<string>()
    return {hidden: get(link) === null}
  })
})
