import {Cache} from 'alinea/backend/Cache'
import {createConfig, Entry, root, schema, type, workspace} from 'alinea/core'
import {generateNKeysBetween} from 'alinea/core/util/FractionalIndexing'
import {link} from 'alinea/input/link'
import {list} from 'alinea/input/list'
import {text} from 'alinea/input/text'
import {createMemoryStore} from './CreateMemoryStore.js'

const listField = list('List', {
  schema: schema({
    ListItem: type('ListItem', {
      link: link.entry('Link')
    })
  })
})

const config = createConfig({
  schema: schema({
    Type: type('Type', {
      title: text('Title'),
      path: text('path'),
      list: listField,
      [type.meta]: {
        isContainer: true
      }
    }),
    Sub: type('Sub', {
      title: text('Title'),
      path: text('path')
    })
  }),
  workspaces: {
    main: workspace('Main', {
      data: root('Root', {contains: ['Type']}),
      [workspace.meta]: {
        source: 'content'
      }
    })
  }
})

const entries: Array<Entry & Record<string, any>> = [
  {
    id: 'root',
    type: 'Type',
    url: '/',
    title: 'Test title',
    path: 'index',
    alinea: {
      parent: undefined,
      parents: [],
      index: 'a0',
      workspace: 'main',
      root: 'main'
    }
  },
  {
    id: 'sub',
    type: 'Type',
    title: 'Sub title',
    path: 'sub',
    url: '/sub',
    list: [
      {
        id: 'list1',
        type: 'ListItem',
        link: [{id: 'link', type: 'entry', entry: 'root'}]
      }
    ],
    alinea: {
      parent: 'root',
      parents: ['root'],
      index: 'a0',
      workspace: 'main',
      root: 'main'
    }
  },
  ...subs(20)
]

function subs(amount: number) {
  const orders = generateNKeysBetween(null, null, amount)
  return Array.from({length: amount}, (_, index) =>
    sub(index + 1, orders[index])
  )
}

function sub(index: number, order: string) {
  return {
    id: `sub-entry-${index}`,
    type: 'Sub',
    url: `/sub/sub-entry-${index}`,
    title: `Sub entry title ${index}`,
    path: `sub-entry-${index}`,
    alinea: {
      index: order,
      workspace: 'main',
      root: 'main',
      parent: 'sub',
      parents: ['root', 'sub']
    }
  }
}

const source = {
  async *entries(): AsyncGenerator<Entry> {
    for (const entry of entries) yield entry
  }
}

export default async function createExample(wasm = false) {
  const store = await createMemoryStore(wasm)
  await Cache.create({store, config, from: source})
  return {config, store}
}
