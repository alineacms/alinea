import {createConfig, Entry, root, schema, type, workspace} from '@alinea/core'
import {generateNKeysBetween} from '@alinea/core/util/FractionalIndexing'
import {link} from '@alinea/input.link'
import {list} from '@alinea/input.list'
import {text} from '@alinea/input.text'
import {Cache} from '../../src/Cache'
import {createMemoryStore} from './CreateMemoryStore'

const listField = list('List', {
  schema: schema({
    ListItem: type('ListItem', {
      link: link.entry('Link')
    })
  })
})

const config = createConfig({
  workspaces: {
    main: workspace('Main', {
      source: 'content',
      schema: schema({
        Type: type('Type', {
          title: text('Title'),
          list: listField
        }).configure({
          isContainer: true
        }),
        Sub: type('Sub', {
          title: text('Title')
        })
      }),
      roots: {data: root('Root', {contains: ['Type']})}
    })
  }
})

const entries: Array<Entry & Record<string, any>> = [
  {
    title: 'Test title',
    path: 'index',
    alinea: {
      id: 'root',
      type: 'Type',
      url: '/',
      parent: undefined,
      parents: [],
      index: 'a0',
      workspace: 'main',
      root: 'main'
    }
  },
  {
    title: 'Sub title',
    path: 'sub',
    list: [
      {
        id: 'list1',
        type: 'ListItem',
        link: [{id: 'link', type: 'entry', entry: 'root'}]
      }
    ],
    alinea: {
      id: 'sub',
      type: 'Type',
      url: '/sub',
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
    title: `Sub entry title ${index}`,
    path: `sub-entry-${index}`,
    alinea: {
      id: `sub-entry-${index}`,
      type: 'Sub',
      url: `/sub/sub-entry-${index}`,
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
  await Cache.create(store, config, source)
  return {config, store}
}
