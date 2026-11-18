import {blob, stored} from '@alinea/graft/git'
import {expect, test} from 'bun:test'
import {IDBFactory} from 'fake-indexeddb'
import {IndexedDBObjects} from './IndexedDBObjects.js'

test('keeps objects by sha', async () => {
  const objects = new IndexedDBObjects(new IDBFactory(), 'objects')
  const hello = await stored(blob(new TextEncoder().encode('hello')))
  await objects.put([hello])
  const held = await objects.has([hello.sha, 'missing'])
  expect([...held]).toEqual([hello.sha])
  const found = await objects.get([hello.sha, 'missing'])
  expect([...found.keys()]).toEqual([hello.sha])
  expect(new TextDecoder().decode(found.get(hello.sha)!.data)).toBe('hello')
  objects.close()
})
