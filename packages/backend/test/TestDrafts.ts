import {docFromEntry, Entry, ROOT_KEY, type} from '@alineacms/core'
import {path} from '@alineacms/input.path'
import {text} from '@alineacms/input.text'
import dotenv from 'dotenv'
import {fs} from 'memfs'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import * as Y from 'yjs'
import {FileDrafts} from '../src/drafts/FileDrafts'

dotenv.config()

const entry: Entry.Raw = {
  id: '20580nQzc',
  type: 'Doc',
  title: 'Getting started',
  index: 'a0'
}

const Doc = type('Doc', {
  title: text('Title', {multiline: true}),
  path: path('Path')
})

const drafts = new FileDrafts({
  fs: fs.promises as any,
  dir: '/tmp'
})

test('update doc', async () => {
  const yDoc = docFromEntry(Doc, entry)
  const stateVector = Y.encodeStateVector(yDoc)
  await drafts.update(entry.id, Y.encodeStateAsUpdate(yDoc))
  yDoc.getMap(ROOT_KEY).set('title', 'Hello world')
  await drafts.update(entry.id, Y.encodeStateAsUpdate(yDoc, stateVector))
  const updateValue = await drafts.get(entry.id)
  const retrieved = new Y.Doc()
  if (updateValue) Y.applyUpdate(retrieved, updateValue)
  const result = retrieved.getMap(ROOT_KEY).toJSON()
  assert.is(result.title, 'Hello world')
  const value = await drafts.get(entry.id, stateVector)
  if (value) Y.applyUpdate(yDoc, value)
  assert.is(result.title, 'Hello world')
})

test.run()
