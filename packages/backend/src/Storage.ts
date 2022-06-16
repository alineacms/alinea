import {Config, Entry} from '@alinea/core'
import {join} from '@alinea/core/util/Paths'
import {Store} from '@alinea/store'
import {Cache} from './Cache'
import {Loader} from './Loader'
import {appendPath} from './util/EntryPaths'

export type Changes = {
  write: Array<[file: string, contents: Buffer]>
  rename: Array<[file: string, to: string]>
  delete: Array<string>
}

export namespace Storage {
  export function entryLocation(
    entry: {path: string; url: string},
    extension: string
  ) {
    const isIndex = entry.path === '' || entry.path === 'index'
    return entry.url + (isIndex ? '/index' : '') + extension
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
      const {
        workspace: workspaceKey,
        url,
        parent: parent,
        parents,
        $isContainer,
        $status,
        path: entryPath,
        i18n,
        ...data
      } = entry
      const entryData: Entry.Raw = data
      if (i18n) entryData.i18n = {id: i18n.id}
      const workspace = config.workspaces[workspaceKey]
      const {schema, source: contentDir} = workspace
      function abs(root: string, file: string) {
        return join(contentDir, root, file)
      }
      const type = schema.type(entry.type)
      const location = entryLocation(entry, loader.extension)
      if (!type) {
        // Todo: some logging solution so these can end up in the UI
        console.log(`Cannot publish entry of unknown type: ${entry.type}`)
        continue
      }
      const file = abs(entry.root, location)
      changes.write.push([file, loader.format(schema, entryData)])
      const previous = store.first(Entry.where(Entry.id.is(entry.id)))

      // Cleanup old files
      if (previous) {
        const oldLocation = entryLocation(previous, loader.extension)
        if (oldLocation !== location) {
          const oldFile = abs(previous.root, oldLocation)
          changes.delete.push(oldFile)
          if (type.isContainer) {
            if (canRename) {
              const oldFolder = abs(previous.root, entryLocation(previous, ''))
              const newFolder = abs(previous.root, entryLocation(entry, ''))
              changes.rename.push([oldFolder, newFolder])
            } else {
              renameChildren(url, entry.id)
              changes.delete.push(
                abs(previous.root, entryLocation(previous, ''))
              )
            }
          }
        }
      }

      function renameChildren(parentUrl: string, parentId: string) {
        // List every child as write + delete
        const children = store.all(Entry.where(Entry.parent.is(parentId)))
        for (const child of children) {
          const childFile = abs(
            child.root,
            entryLocation(child, loader.extension)
          )
          changes.delete.push(childFile)
          const newUrl = appendPath(parentUrl, child.path)
          const newLocation = abs(
            entry.root,
            entryLocation({path: child.path, url: newUrl}, loader.extension)
          )
          changes.write.push([newLocation, loader.format(schema, child)])
          renameChildren(newUrl, child.id)
        }
      }
    }
    return changes
  }
}
