import {Config, EntryPhase, EntryUrlMeta, Type} from 'alinea/core'
import {META_KEY, createRecord} from 'alinea/core/EntryRecord'
import {
  ArchiveMutation,
  DiscardDraftMutation,
  EditMutation,
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
  entryId: string
  file: string
  contents: string
}
export interface RenameChange {
  type: ChangeType.Rename
  entryId: string
  from: string
  to: string
}
export interface PatchChange {
  type: ChangeType.Patch
  entryId: string
  file: string
  patch: object
}
export interface DeleteChange {
  type: ChangeType.Delete
  entryId: string
  file: string
}
export type Change = WriteChange | RenameChange | PatchChange | DeleteChange
export type ChangeSet = Array<Change>

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

  draftChanges({entryId, file, entry}: EditMutation): ChangeSet {
    const type = this.config.schema[entry.type]
    if (!type)
      throw new Error(`Cannot publish entry of unknown type: ${entry.type}`)
    const record = createRecord(entry)
    return [
      {
        type: ChangeType.Write,
        entryId,
        file,
        contents: decoder.decode(loader.format(this.config.schema, record))
      }
    ]
  }

  publishChanges({entryId, file}: PublishMutation): ChangeSet {
    const fileEnd = `.${EntryPhase.Draft}.json`
    if (!file.endsWith(fileEnd))
      throw new Error(`Cannot publish non-draft file: ${file}`)
    return [
      {
        type: ChangeType.Rename,
        entryId,
        from: file,
        to: file.slice(0, -fileEnd.length) + '.json'
      }
    ]
  }

  archiveChanges({entryId, file}: ArchiveMutation): ChangeSet {
    const fileEnd = '.json'
    if (!file.endsWith(fileEnd))
      throw new Error(`File extension does not match json: ${file}`)
    return [
      {
        type: ChangeType.Rename,
        entryId,
        from: file,
        to: file.slice(0, -fileEnd.length) + `.${EntryPhase.Archived}.json`
      }
    ]
  }

  removeChanges({entryId, file}: RemoveEntryMutation): ChangeSet {
    // Todo: remove all possible phases
    return [{type: ChangeType.Delete, entryId, file}]
  }

  discardChanges({entryId, file}: DiscardDraftMutation): ChangeSet {
    const fileEnd = `.${EntryPhase.Draft}.json`
    if (!file.endsWith(fileEnd))
      throw new Error(`Cannot discard non-draft file: ${file}`)
    return [{type: ChangeType.Delete, entryId, file}]
  }

  orderChanges({entryId, file, index}: OrderMutation): ChangeSet {
    return [
      {type: ChangeType.Patch, entryId, file, patch: {[META_KEY]: {index}}}
    ]
  }

  moveChanges({
    entryId,
    entryType,
    fromFile,
    toFile,
    index
  }: MoveMutation): ChangeSet {
    const result: ChangeSet = []
    const isContainer = Type.isContainer(this.config.schema[entryType])
    result.push({type: ChangeType.Rename, entryId, from: fromFile, to: toFile})
    if (!isContainer) return result
    const fromFolder = fromFile.slice(0, -'.json'.length)
    const toFolder = toFile.slice(0, -'.json'.length)
    result.push({
      type: ChangeType.Rename,
      entryId,
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

  fileUploadChanges(mutation: FileUploadMutation): ChangeSet {
    throw new Error('Not implemented')
  }

  mutationChanges(mutation: Mutation): ChangeSet {
    switch (mutation.type) {
      case MutationType.Edit:
        return this.draftChanges(mutation)
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
    }
  }

  create(mutations: Array<Mutation>): ChangeSet {
    return mutations.flatMap(mutation => this.mutationChanges(mutation))
  }
}
