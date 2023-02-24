import {createId, slugify, toGenerator} from 'alinea/core'
import {Config} from 'alinea/core/Config'
import {Entry} from 'alinea/core/Entry'
import {Logger} from 'alinea/core/util/Logger'
import {Cache} from '../Cache.js'
import {Data} from '../Data.js'
import {createDb} from './CreateDb.js'

interface DemoEntry extends Partial<Entry> {
  id?: string
  type: string
  title: string
}

function toEntry(workspace: string, data: DemoEntry): Entry {
  const path = data.path || slugify(data.title as string)
  return {
    id: data.id || createId(),
    path,
    url: `/${path}`,
    alinea: {
      workspace,
      root: 'data',
      index: 'a0',
      parent: undefined,
      parents: [],
      i18n: undefined,
      ...data.alinea
    },
    ...data
  }
}

export function demoStore<T>(
  config: Config<T>,
  entries: (workspace: string) => Array<DemoEntry>
) {
  const all: Array<Entry> = []
  for (const workspace of Object.values(config.workspaces))
    all.push(
      ...entries(workspace.name).map(raw => toEntry(workspace.name, raw))
    )
  const source: Data.Source = {
    entries() {
      return toGenerator(all)
    }
  }
  return async function createStore() {
    const store = await createDb()
    await Cache.create({
      store,
      config,
      from: source,
      logger: new Logger('Demo store')
    })
    return store
  }
}
