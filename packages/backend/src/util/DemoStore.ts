import {createId, slugify, toGenerator} from '@alinea/core'
import {Config} from '@alinea/core/Config'
import {Entry} from '@alinea/core/Entry'
import {Workspaces} from '@alinea/core/Workspace'
import {Cache} from '../Cache'
import {Data} from '../Data'
import {createDb} from './CreateDb'

interface DemoEntry extends Partial<Entry> {
  title: string
  type: string
}

function toEntry(workspace: string, data: DemoEntry): Entry {
  const path = data.path || slugify(data.title as string)
  return {
    id: data.id || createId(),
    root: 'data',
    index: 'a0',
    path,
    url: `/${path}`,
    workspace,
    parent: undefined,
    parents: [],
    i18n: undefined,
    ...data
  }
}

export function demoStore<T extends Workspaces>(
  config: Config<T>,
  entries: (workspace: keyof T) => Array<DemoEntry>
) {
  const all: Array<Entry> = []
  for (const workspace of Object.values(config.workspaces))
    all.push(...entries(workspace.id).map(raw => toEntry(workspace.name, raw)))
  const source: Data.Source = {
    entries() {
      return toGenerator(all)
    }
  }
  return async function createStore() {
    const store = await createDb()
    await Cache.create(store, config, source, true)
    return store
  }
}
