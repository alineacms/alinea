import {blob, stored} from '@alinea/graft/git'
import {expect, test} from 'bun:test'
import {IDBFactory, IDBKeyRange} from 'fake-indexeddb'
import {IndexedDBObjects} from './IndexedDBObjects.js'

globalThis.IDBKeyRange ??= IDBKeyRange

test('keeps objects by sha', async () => {
  const factory = new IDBFactory()
  const objects = new IndexedDBObjects(factory, 'objects')
  const hello = await stored(blob(new TextEncoder().encode('hello')))
  await objects.put([hello])
  const held = await objects.has([hello.sha, 'missing'])
  expect([...held]).toEqual([hello.sha])
  const found = await objects.get([hello.sha, 'missing'])
  expect([...found.keys()]).toEqual([hello.sha])
  expect(new TextDecoder().decode(found.get(hello.sha)!.data)).toBe('hello')
  objects.close()

  // Another store reads what this one stored
  const other = new IndexedDBObjects(factory, 'objects')
  const world = await stored(blob(new TextEncoder().encode('world')))
  await other.put([hello, world])
  const both = await other.get([hello.sha, world.sha])
  expect(both.size).toBe(2)
  other.close()
})
