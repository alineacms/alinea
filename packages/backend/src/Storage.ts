import {Config, Entry} from '@alinea/core'
import {join} from '@alinea/core/util/Paths'
import {Store} from '@alinea/store'
import {Cache} from './Cache'
import {Loader} from './Loader'
import {appendPath} from './util/EntryPaths'

export type Changes = {
  write: Array<{id: string; file: string; contents: string}>
  rename: Array<{id: string; file: string; to: string}>
  delete: Array<{id: string; file: string}>
}

const decoder = new TextDecoder()

export namespace Storage {
  export function entryLocation(
    entry: {path: string; alinea: {url: string}},
    extension: string
  ) {
    const isIndex = entry.path === '' || entry.path === 'index'
    return entry.alinea.url + (isIndex ? '/index' : '') + extension
  }

  export async function publishChanges(
    config: Config,
    store: Store,
    loader: Loader,
    entries: Array<Entry>,
    canRename = true
  ): Promise<Changes> {
    const changes: Changes = {
      write: [],
      rename: [],
      delete: []
    }
    for (const todo of entries) {
      const entry = Cache.computeEntry(store, config, todo)
      const {alinea, path: entryPath, ...data} = entry
      const entryData = data
      const workspace = config.workspaces[alinea.workspace]
      const {schema, source: contentDir} = workspace
      function abs(root: string, file: string) {
        return join(contentDir, root, file)
      }
      const type = schema.type(entry.alinea.type)
      const location = entryLocation(entry, loader.extension)
      if (!type) {
        // Todo: some logging solution so these can end up in the UI
        console.log(
          `Cannot publish entry of unknown type: ${entry.alinea.type}`
        )
        continue
      }
      const file = abs(alinea.root, location)
      const meta = {
        id: entry.alinea.id,
        type: entry.alinea.type,
        index: alinea.index,
        workspace: alinea.workspace,
        root: alinea.root,
        i18n: alinea.i18n
      }
      changes.write.push({
        id: entry.alinea.id,
        file,
        contents: decoder.decode(
          loader.format(schema, {...entryData, alinea: meta})
        )
      })
      const previous = store.first(Entry.where(Entry.id.is(entry.alinea.id)))

      // Cleanup old files
      if (previous) {
        const oldLocation = entryLocation(previous, loader.extension)
        if (oldLocation !== location) {
          const oldFile = abs(previous.alinea.root, oldLocation)
          changes.delete.push({id: entry.alinea.id, file: oldFile})
          if (type.isContainer) {
            if (canRename) {
              const oldFolder = abs(
                previous.alinea.root,
                entryLocation(previous, '')
              )
              const newFolder = abs(
                previous.alinea.root,
                entryLocation(entry, '')
              )
              changes.rename.push({
                id: entry.alinea.id,
                file: oldFolder,
                to: newFolder
              })
            } else {
              renameChildren(entry.alinea.url, entry.alinea.id)
              changes.delete.push({
                id: entry.alinea.id,
                file: abs(previous.alinea.root, entryLocation(previous, ''))
              })
            }
          }
        }
      }

      function renameChildren(parentUrl: string, parentId: string) {
        // List every child as write + delete
        const children = store.all(
          Entry.where(Entry.alinea.parent.is(parentId))
        )
        for (const child of children) {
          const childFile = abs(
            child.alinea.root,
            entryLocation(child, loader.extension)
          )
          changes.delete.push({id: child.alinea.id, file: childFile})
          const newUrl = appendPath(parentUrl, child.path)
          const newLocation = abs(
            entry.alinea.root,
            entryLocation(
              {path: child.path, alinea: {url: newUrl}},
              loader.extension
            )
          )
          changes.write.push({
            id: child.alinea.id,
            file: newLocation,
            contents: decoder.decode(loader.format(schema, child))
          })
          renameChildren(newUrl, child.alinea.id)
        }
      }
    }
    return changes
  }
}
