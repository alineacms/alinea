import {cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {atom} from 'jotai'
import {EntryAtoms} from '../atoms/entry.js'
import {EntryScope, type EntryScopeProps} from '../hooks.js'
import {useEntryEditor} from './UseEntryEditor.js'

afterEach(cleanup)

function scope(selectedEntry: Partial<EntryScopeProps['selectedEntry']>) {
  const entry = new EntryAtoms('entry-id', atom({} as never))
  return {
    entry,
    localeData: entry.locales(null),
    richTextImages: new Map(),
    selectedEntry: selectedEntry as EntryScopeProps['selectedEntry']
  }
}

test('useEntryEditor keeps the publish status out of the field data', () => {
  let readStatusField: (() => unknown) | undefined
  function Version() {
    const editor = useEntryEditor()!
    const version = editor.activeVersion
    readStatusField = () => (version.data as Record<string, unknown>).status
    return (
      <span>
        {version.status}:{version.data.path}
      </span>
    )
  }
  render(
    <EntryScope
      {...scope({
        id: 'entry-id',
        path: 'invoice',
        status: 'published',
        data: {status: 'draft'}
      })}
    >
      <Version />
    </EntryScope>
  )
  expect(screen.getByText('published:invoice')).toBeDefined()
  // A custom `status` field used to read as the publish status
  expect(readStatusField!).toThrow(/useEntry\(\)/)
})
