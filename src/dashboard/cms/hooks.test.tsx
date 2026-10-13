import {cleanup, render, screen} from '#test/react.js'
import type {Entry} from '#/core/Entry.js'
import {useEntry} from '#/cms.js'
import {afterEach, expect, test} from 'bun:test'
import {atom} from 'jotai'
import {EntryAtoms} from '../atoms/entry.js'
import {EntryScope} from '../hooks.js'

afterEach(cleanup)

const row = {
  id: 'about',
  type: 'Page',
  title: 'About',
  path: 'about',
  url: '/about',
  locale: 'en',
  status: 'published',
  workspace: 'main',
  root: 'pages',
  parentId: null,
  data: {title: 'About'},
  rowHash: 'row',
  fileHash: 'file',
  filePath: 'pages/about.json',
  childrenDir: 'pages/about',
  searchableText: 'About',
  level: 0,
  seeded: null
} as unknown as Entry

test('useEntry returns the public entry fields only', () => {
  let keys: Array<string> = []
  function View() {
    const entry = useEntry()!
    keys = Object.keys(entry).sort()
    return <span>{entry.url}</span>
  }
  const entry = new EntryAtoms('about', atom({} as never))
  render(
    <EntryScope
      entry={entry}
      localeData={entry.locales('en')}
      richTextImages={new Map()}
      selectedEntry={row}
    >
      <View />
    </EntryScope>
  )
  expect(screen.getByText('/about')).toBeDefined()
  expect(keys).toEqual([
    'data',
    'id',
    'locale',
    'parentId',
    'path',
    'root',
    'status',
    'title',
    'type',
    'url',
    'workspace'
  ])
})

test('useEntry returns null outside an entry', () => {
  function View() {
    return <span>{String(useEntry())}</span>
  }
  render(<View />)
  expect(screen.getByText('null')).toBeDefined()
})
