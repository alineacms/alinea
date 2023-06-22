import {EntryPhase, EntryRow, EntryUrlMeta, Type, Workspace} from 'alinea/core'
import {createRecord} from 'alinea/core/EntryRecord'
import {Page} from 'alinea/core/Page'
import {Realm} from 'alinea/core/pages/Realm'
import {join} from 'alinea/core/util/Paths'
import {Database} from '../Database.js'
import {JsonLoader} from '../loader/JsonLoader.js'

export interface ChangeSet {
  write: Array<{id: string; file: string; contents: string}>
  rename: Array<{id: string; file: string; to: string}>
  delete: Array<{id: string; file: string}>
}

const decoder = new TextDecoder()
const loader = JsonLoader

export namespace ChangeSet {
  export function entryLocation(
    {locale, parentPaths, path, phase}: EntryUrlMeta,
    extension: string
  ) {
    const segments = (locale ? [locale] : [])
      .concat(
        parentPaths
          .concat(path)
          .map(segment => (segment === '' ? 'index' : segment))
      )
      .join('/')
    const phaseSegment = phase === EntryPhase.Published ? '' : `.${phase}`
    return (segments + phaseSegment + extension).toLowerCase()
  }

  export async function create(
    db: Database,
    entries: Array<EntryRow>,
    phase: EntryPhase,
    canRename = true
  ): Promise<ChangeSet> {
    const changes: ChangeSet = {
      write: [],
      rename: [],
      delete: []
    }
    for (const entry of entries) {
      const type = db.config.schema[entry.type]
      if (!type) {
        console.warn(`Cannot publish entry of unknown type: ${entry.type}`)
        continue
      }
      const parentData =
        entry.parent &&
        (await db.find(
          Page({entryId: entry.parent})
            .select({
              path: Page.path,
              paths({parents}) {
                return parents().select(Page.path)
              }
            })
            .first(),
          Realm.PreferPublished
        ))
      if (entry.parent && !parentData)
        throw new Error(`Cannot find parent entry: ${entry.parent}`)
      const parentPaths = parentData
        ? parentData.paths.concat(parentData.path)
        : []
      const workspace = db.config.workspaces[entry.workspace]
      const isContainer = Type.isContainer(type)
      const isPublishing = phase === EntryPhase.Published
      const {source: contentDir} = Workspace.data(workspace)
      const entryMeta = {
        phase,
        path: entry.path,
        parentPaths,
        locale: entry.locale ?? undefined
      }
      const location = entryLocation(entryMeta, loader.extension)
      function abs(root: string, file: string) {
        return join(contentDir, root, file)
      }
      const file = abs(entry.root, location)
      const record = createRecord(entry)
      changes.write.push({
        id: entry.entryId,
        file,
        contents: decoder.decode(loader.format(db.config.schema, record))
      })
      const previousPhase: Realm = entry.phase as any
      const previous = await db.find(
        Page({entryId: entry.entryId})
          .select({
            phase: Page.phase,
            path: Page.path,
            locale: Page.locale,
            root: Page.root
          })
          .maybeFirst(),
        previousPhase
      )

      // Cleanup old files
      if (previous && phase !== EntryPhase.Draft) {
        const previousMeta: EntryUrlMeta = {...previous, parentPaths}
        const oldLocation = entryLocation(previousMeta, loader.extension)
        if (oldLocation !== location) {
          const oldFile = abs(previous.root, oldLocation)
          changes.delete.push({id: entry.entryId, file: oldFile})
          if (isPublishing && isContainer) {
            if (canRename) {
              const oldFolder = abs(
                previous.root,
                entryLocation(previousMeta, '')
              )
              const newFolder = abs(previous.root, entryLocation(entryMeta, ''))
              changes.rename.push({
                id: entry.entryId,
                file: oldFolder,
                to: newFolder
              })
            } else {
              await renameChildren(
                entryMeta.parentPaths.concat(entryMeta.path),
                entry.entryId
              )
              changes.delete.push({
                id: entry.entryId,
                file: abs(previous.root, entryLocation(previousMeta, ''))
              })
            }
          }
        }
      }

      async function renameChildren(newPaths: Array<string>, parentId: string) {
        // List every child as write + delete
        const children = await db.find(
          Page()
            .where(Page.parent.is(parentId))
            .select({
              child: {...Page},
              oldPaths({parents}) {
                return parents().select(Page.path)
              }
            }),
          Realm.All
        )
        for (const {child, oldPaths} of children) {
          const childFile = abs(
            child.root,
            entryLocation(
              {
                phase: child.phase,
                path: child.path,
                parentPaths: oldPaths,
                locale: child.locale
              },
              loader.extension
            )
          )
          changes.delete.push({id: child.entryId, file: childFile})
          const newLocation = abs(
            entry.root,
            entryLocation(
              {
                phase: child.phase,
                path: child.path,
                parentPaths: newPaths,
                locale: child.locale
              },
              loader.extension
            )
          )
          const record = createRecord(child)
          changes.write.push({
            id: child.entryId,
            file: newLocation,
            contents: decoder.decode(loader.format(db.config.schema, record))
          })
          renameChildren(newPaths.concat(child.path), child.entryId)
        }
      }
    }
    return changes
  }
}
