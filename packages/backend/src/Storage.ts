import {Config, Entry, EntryMetaRaw, EntryUrlMeta} from '@alinea/core'
import {join} from '@alinea/core/util/Paths'
import {Store} from '@alinea/store'
import {Cache} from './Cache'
import {Loader} from './Loader'

export type Changes = {
  write: Array<{id: string; file: string; contents: string}>
  rename: Array<{id: string; file: string; to: string}>
  delete: Array<{id: string; file: string}>
}

const decoder = new TextDecoder()

export namespace Storage {
  export function entryLocation(
    {locale, parentPaths, path}: EntryUrlMeta,
    extension: string
  ) {
    const segments = (locale ? [locale] : [])
      .concat(
        parentPaths
          .concat(path)
          .map(segment => (segment === '' ? 'index' : segment))
      )
      .join('/')
    return (segments + extension).toLowerCase()
  }

  const Parent = Entry.as('Parent')

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
      const {alinea, path: entryPath, url, ...data} = entry
      const entryData = data
      const workspace = config.workspaces[alinea.workspace]
      const {schema, source: contentDir} = workspace
      function abs(root: string, file: string) {
        return join(contentDir, root, file)
      }
      const type = schema.type(entry.type)
      const parentPaths = store.all(
        Entry.where(Entry.id.isIn(alinea.parents)).select(Entry.path)
      )
      const entryMeta = {
        path: entryPath,
        parentPaths,
        locale: alinea.i18n?.locale
      }
      const location = entryLocation(entryMeta, loader.extension)
      if (!type) {
        // Todo: some logging solution so these can end up in the UI
        console.log(`Cannot publish entry of unknown type: ${entry.type}`)
        continue
      }
      const file = abs(alinea.root, location)
      const meta: EntryMetaRaw = {
        index: alinea.index,
        i18n: alinea.i18n
      }
      if (!entry.alinea.parent) meta.root = entry.alinea.root
      changes.write.push({
        id: entry.id,
        file,
        contents: decoder.decode(
          loader.format(schema, {...entryData, alinea: meta})
        )
      })
      const previous = store.first(
        Entry.where(Entry.id.is(entry.id)).select({
          path: Entry.path,
          parentPaths: Parent.where(Parent.id.isIn(Entry.parents)).select(
            Parent.path
          ),
          locale: Entry.alinea.i18n.locale,
          root: Entry.root
        })
      )

      // Cleanup old files
      if (previous) {
        const oldLocation = entryLocation(previous, loader.extension)
        if (oldLocation !== location) {
          const oldFile = abs(previous.root, oldLocation)
          changes.delete.push({id: entry.id, file: oldFile})
          if (type.isContainer) {
            if (canRename) {
              const oldFolder = abs(previous.root, entryLocation(previous, ''))
              const newFolder = abs(previous.root, entryLocation(entryMeta, ''))
              changes.rename.push({
                id: entry.id,
                file: oldFolder,
                to: newFolder
              })
            } else {
              renameChildren(
                entryMeta.parentPaths.concat(entryMeta.path),
                entry.id
              )
              changes.delete.push({
                id: entry.id,
                file: abs(previous.root, entryLocation(previous, ''))
              })
            }
          }
        }
      }

      function renameChildren(newPaths: Array<string>, parentId: string) {
        // List every child as write + delete
        const children = store.all(
          Entry.where(Entry.alinea.parent.is(parentId)).select({
            child: Entry.fields,
            oldPaths: Parent.where(Parent.id.isIn(Entry.parents)).select(
              Parent.path
            )
          })
        )
        for (const {child, oldPaths} of children) {
          const childFile = abs(
            child.alinea.root,
            entryLocation(
              {
                path: child.path,
                parentPaths: oldPaths,
                locale: child.alinea.i18n?.locale
              },
              loader.extension
            )
          )
          changes.delete.push({id: child.id, file: childFile})
          const newLocation = abs(
            entry.alinea.root,
            entryLocation(
              {
                path: child.path,
                parentPaths: newPaths,
                locale: child.alinea.i18n?.locale
              },
              loader.extension
            )
          )
          changes.write.push({
            id: child.id,
            file: newLocation,
            contents: decoder.decode(loader.format(schema, child))
          })
          renameChildren(newPaths.concat(child.path), child.id)
        }
      }
    }
    return changes
  }
}
