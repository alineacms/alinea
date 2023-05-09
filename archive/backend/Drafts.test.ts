import {FileDrafts} from 'alinea/backend/drafts/FileDrafts'
import {docFromEntry, Entry, ROOT_KEY, type} from 'alinea/core'
import {path} from 'alinea/input/path'
import {text} from 'alinea/input/text'
import dotenv from 'dotenv'
import {fs} from 'memfs'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import * as Y from 'yjs'

dotenv.config()

const entry: Entry = {
  id: '20580nQzc',
  type: 'Doc',
  title: 'Getting started',
  url: '/',
  path: 'getting-started',
  alinea: {
    root: 'data',
    workspace: 'main',
    index: 'a0',
    parent: undefined,
    parents: []
  }
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
  const yDoc = docFromEntry(entry, () => Doc)
  const stateVector = Y.encodeStateVector(yDoc)
  await drafts.update({
    id: entry.id,
    update: Y.encodeStateAsUpdate(yDoc)
  })
  yDoc.getMap(ROOT_KEY).set('title', 'Hello world')
  await drafts.update({
    id: entry.id,
    update: Y.encodeStateAsUpdate(yDoc, stateVector)
  })
  const updateValue = await drafts.get({id: entry.id})
  const retrieved = new Y.Doc()
  if (updateValue) Y.applyUpdate(retrieved, updateValue)
  const result = retrieved.getMap(ROOT_KEY).toJSON()
  assert.is(result.title, 'Hello world')
  const value = await drafts.get({id: entry.id, stateVector})
  if (value) Y.applyUpdate(yDoc, value)
  assert.is(result.title, 'Hello world')
})

test.run()
