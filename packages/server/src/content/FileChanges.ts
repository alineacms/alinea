import {Entry} from '@alinea/core'
import {Store} from 'helder.store'
import {posix as path} from 'path'

function entryLocation(entry: Entry) {
  return entry.$path.endsWith('/')
    ? path.join(entry.$path, 'index')
    : entry.$path
}

function entryFile(entry: Entry) {
  const location = entryLocation(entry)
  return path.join(`${location}.json`)
}

export function fileChanges(store: Store, entries: Array<Entry>) {
  const contentChanges: Array<[string, string]> = [],
    fileRemoves: Array<string> = []
  for (const entry of entries) {
    const file = entryFile(entry)
    const existing = store.first(Entry.where(Entry.id.is(entry.id)))
    if (existing && existing.$path !== entry.$path) {
      fileRemoves.push(file)
    }
    // Remove indexed properties
    const {id, $path, $parent, $isContainer, $status, ...data} = entry as any
    contentChanges.push([file, JSON.stringify(data, null, '  ')])
  }
  return {contentChanges, fileRemoves}
}
