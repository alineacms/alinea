import {Entry} from 'alinea/core'
import {Config} from 'alinea/core/Config'
import {EntryRecord, createRecord} from 'alinea/core/EntryRecord'
import {EntryStatus} from 'alinea/core/EntryRow'
import {Graph} from 'alinea/core/Graph'
import {
  ArchiveMutation,
  CreateMutation,
  MoveMutation,
  Mutation,
  MutationType,
  OrderMutation,
  PatchMutation,
  PublishMutation,
  RemoveDraftMutation,
  RemoveEntryMutation,
  RemoveFileMutation,
  UpdateMutation,
  UploadMutation
} from 'alinea/core/Mutation'
import {Type} from 'alinea/core/Type'
import {Workspace} from 'alinea/core/Workspace'
import {MediaFile} from 'alinea/core/media/MediaTypes'
import {join} from 'alinea/core/util/Paths'
import {JsonLoader} from '../loader/JsonLoader.js'

export enum ChangeType {
  Write = 'write',
  Rename = 'rename',
  Patch = 'patch',
  Delete = 'delete',
  Upload = 'upload'
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
export interface UploadChange {
  type: ChangeType.Upload
  file: string
  url: string
}
export type Change =
  | WriteChange
  | RenameChange
  | PatchChange
  | DeleteChange
  | UploadChange
export type ChangeWithMeta = {
  changes: Array<Change>
  meta: Mutation
}
export type ChangeSet = Array<ChangeWithMeta>

const decoder = new TextDecoder()
const loader = JsonLoader

export class ChangeSetCreator {
  constructor(protected config: Config, protected graph: Graph) {}

  editChanges({previousFile, file, entry}: UpdateMutation): Array<Change> {
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

  patchChanges({file, patch}: PatchMutation): Array<Change> {
    return [{type: ChangeType.Patch, file, patch}]
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
    const draftFile = `.${EntryStatus.Draft}.json`
    const archivedFiled = `.${EntryStatus.Archived}.json`
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
        to: file.slice(0, -fileEnd.length) + `.${EntryStatus.Archived}.json`
      }
    ]
  }

  async removeChanges({
    entryId,
    file
  }: RemoveEntryMutation): Promise<Array<Change>> {
    if (!file.endsWith(`.${EntryStatus.Archived}.json`)) return []
    const result = await this.graph.first({
      select: {
        workspace: Entry.workspace,
        files: {
          edge: 'children',
          depth: 999,
          type: MediaFile,
          select: {location: MediaFile.location}
        }
      },
      id: entryId,
      status: 'preferPublished'
    })
    if (!result) return []
    const {files, workspace} = result
    const mediaDir =
      Workspace.data(this.config.workspaces[workspace])?.mediaDir ?? ''
    const removeFiles: Array<Change> = files.map(file => {
      const binaryLocation = join(mediaDir, file.location)
      return {
        type: ChangeType.Delete,
        file: binaryLocation
      }
    })
    return [
      // Remove any media files in this location
      ...removeFiles,
      // Remove entry
      {type: ChangeType.Delete, file},
      // Remove children
      {
        type: ChangeType.Delete,
        file: file.slice(0, -`.${EntryStatus.Archived}.json`.length)
      }
    ]
  }

  discardChanges({file}: RemoveDraftMutation): Array<Change> {
    const fileEnd = `.${EntryStatus.Draft}.json`
    if (!file.endsWith(fileEnd))
      throw new Error(`Cannot discard non-draft file: ${file}`)
    return [{type: ChangeType.Delete, file}]
  }

  orderChanges({file, index}: OrderMutation): Array<Change> {
    return [
      {
        type: ChangeType.Patch,
        file,
        patch: {[EntryRecord.index]: index}
      }
    ]
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

  fileUploadChanges(mutation: UploadMutation): Array<Change> {
    return [{type: ChangeType.Upload, file: mutation.file, url: mutation.url}]
  }

  fileRemoveChanges(mutation: RemoveFileMutation): Array<Change> {
    const mediaDir =
      Workspace.data(this.config.workspaces[mutation.workspace])?.mediaDir ?? ''
    const binaryLocation = join(mediaDir, mutation.location)
    const removeBinary: Change = {type: ChangeType.Delete, file: binaryLocation}
    if (mutation.replace) return [removeBinary]
    return [{type: ChangeType.Delete, file: mutation.file}, removeBinary]
  }

  async mutationChanges(mutation: Mutation): Promise<Array<Change>> {
    switch (mutation.type) {
      case MutationType.Edit:
        return this.editChanges(mutation)
      case MutationType.Patch:
        return this.patchChanges(mutation)
      case MutationType.Create:
        return this.createChanges(mutation)
      case MutationType.Publish:
        return this.publishChanges(mutation)
      case MutationType.Archive:
        return this.archiveChanges(mutation)
      case MutationType.RemoveEntry:
        return this.removeChanges(mutation)
      case MutationType.RemoveDraft:
        return this.discardChanges(mutation)
      case MutationType.Order:
        return this.orderChanges(mutation)
      case MutationType.Move:
        return this.moveChanges(mutation)
      case MutationType.Upload:
        return this.fileUploadChanges(mutation)
      case MutationType.RemoveFile:
        return this.fileRemoveChanges(mutation)
    }
  }

  async create(mutations: Array<Mutation>): Promise<ChangeSet> {
    const res = []
    for (const meta of mutations)
      res.push({changes: await this.mutationChanges(meta), meta})
    return res
  }
}
