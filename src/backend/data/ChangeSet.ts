import {Config, EntryPhase, EntryUrlMeta, Type} from 'alinea/core'
import {META_KEY, createRecord} from 'alinea/core/EntryRecord'
import {
  ArchiveMutation,
  CreateMutation,
  DiscardDraftMutation,
  EditMutation,
  FileRemoveMutation,
  FileUploadMutation,
  MoveMutation,
  Mutation,
  MutationType,
  OrderMutation,
  PublishMutation,
  RemoveEntryMutation
} from 'alinea/core/Mutation'
import {JsonLoader} from '../loader/JsonLoader.js'

export enum ChangeType {
  Write = 'write',
  Rename = 'rename',
  Patch = 'patch',
  Delete = 'delete'
}
export interface WriteChange {
  type: ChangeType.Write
  file: string
  contents: string
}
export interface RenameChange {
  type: ChangeType.Rename
  from: string
  to: string
}
export interface PatchChange {
  type: ChangeType.Patch
  file: string
  patch: object
}
export interface DeleteChange {
  type: ChangeType.Delete
  file: string
}
export type Change = WriteChange | RenameChange | PatchChange | DeleteChange
export type ChangeWithMeta = {
  changes: Array<Change>
  meta: Mutation
}
export type ChangeSet = Array<ChangeWithMeta>

const decoder = new TextDecoder()
const loader = JsonLoader

export class ChangeSetCreator {
  constructor(public config: Config) {}

  entryLocation(
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

  editChanges({previousFile, file, entry}: EditMutation): Array<Change> {
    const type = this.config.schema[entry.type]
    if (!type)
      throw new Error(`Cannot publish entry of unknown type: ${entry.type}`)
    const record = createRecord(entry)
    const res: Array<Change> = []
    if (previousFile && previousFile !== file) {
      res.push({
        type: ChangeType.Rename,
        from: previousFile,
        to: file
      })
      res.push({
        type: ChangeType.Rename,
        from: previousFile.slice(0, -'.json'.length),
        to: file.slice(0, -'.json'.length)
      })
    }
    return res.concat({
      type: ChangeType.Write,
      file,
      contents: decoder.decode(loader.format(this.config.schema, record))
    })
  }

  createChanges({file, entry}: CreateMutation): Array<Change> {
    const record = createRecord(entry)
    return [
      {
        type: ChangeType.Write,
        file,
        contents: decoder.decode(loader.format(this.config.schema, record))
      }
    ]
  }

  publishChanges({file}: PublishMutation): Array<Change> {
    const draftFile = `.${EntryPhase.Draft}.json`
    const archivedFiled = `.${EntryPhase.Archived}.json`
    if (file.endsWith(draftFile))
      return [
        {
          type: ChangeType.Rename,
          from: file,
          to: file.slice(0, -draftFile.length) + '.json'
        }
      ]
    if (file.endsWith(archivedFiled))
      return [
        {
          type: ChangeType.Rename,
          from: file,
          to: file.slice(0, -archivedFiled.length) + '.json'
        }
      ]
    throw new Error(`Cannot publish file: ${file}`)
  }

  archiveChanges({file}: ArchiveMutation): Array<Change> {
    const fileEnd = '.json'
    if (!file.endsWith(fileEnd))
      throw new Error(`File extension does not match json: ${file}`)
    return [
      {
        type: ChangeType.Rename,
        from: file,
        to: file.slice(0, -fileEnd.length) + `.${EntryPhase.Archived}.json`
      }
    ]
  }

  removeChanges({file}: RemoveEntryMutation): Array<Change> {
    // Todo: remove all possible phases
    return [{type: ChangeType.Delete, file}]
  }

  discardChanges({file}: DiscardDraftMutation): Array<Change> {
    const fileEnd = `.${EntryPhase.Draft}.json`
    if (!file.endsWith(fileEnd))
      throw new Error(`Cannot discard non-draft file: ${file}`)
    return [{type: ChangeType.Delete, file}]
  }

  orderChanges({file, index}: OrderMutation): Array<Change> {
    return [{type: ChangeType.Patch, file, patch: {[META_KEY]: {index}}}]
  }

  moveChanges({
    entryId,
    entryType,
    fromFile,
    toFile,
    index
  }: MoveMutation): Array<Change> {
    const result: Array<Change> = []
    const isContainer = Type.isContainer(this.config.schema[entryType])
    result.push({type: ChangeType.Rename, from: fromFile, to: toFile})
    if (!isContainer) return result
    const fromFolder = fromFile.slice(0, -'.json'.length)
    const toFolder = toFile.slice(0, -'.json'.length)
    result.push({
      type: ChangeType.Rename,
      from: fromFolder,
      to: toFolder
    })
    result.push(
      ...this.orderChanges({
        type: MutationType.Order,
        entryId,
        file: toFile,
        index
      })
    )
    return result
  }

  fileUploadChanges(mutation: FileUploadMutation): Array<Change> {
    return this.editChanges({
      ...mutation,
      previousFile: mutation.file,
      type: MutationType.Edit
    })
  }

  fileRemoveChanges({file: entryFile}: FileRemoveMutation): Array<Change> {
    return [{type: ChangeType.Delete, file: entryFile}]
  }

  mutationChanges(mutation: Mutation): Array<Change> {
    switch (mutation.type) {
      case MutationType.Edit:
        return this.editChanges(mutation)
      case MutationType.Create:
        return this.createChanges(mutation)
      case MutationType.Publish:
        return this.publishChanges(mutation)
      case MutationType.Archive:
        return this.archiveChanges(mutation)
      case MutationType.Remove:
        return this.removeChanges(mutation)
      case MutationType.Discard:
        return this.discardChanges(mutation)
      case MutationType.Order:
        return this.orderChanges(mutation)
      case MutationType.Move:
        return this.moveChanges(mutation)
      case MutationType.FileUpload:
        return this.fileUploadChanges(mutation)
      case MutationType.FileRemove:
        return this.fileRemoveChanges(mutation)
    }
  }

  create(mutations: Array<Mutation>): ChangeSet {
    return mutations.map(meta => {
      return {changes: this.mutationChanges(meta), meta}
    })
  }
}
