import {Future, Hub, Media} from 'alinea/core'
import {AlineaMeta} from './database/AlineaMeta.js'
import {EntryTree} from './database/EntryTree.js'

export interface UpdateResponse {
  contentHash: string
  entries: Array<EntryTree>
}

export interface Syncable {
  updates(request: AlineaMeta): Promise<UpdateResponse>
  ids(): Promise<Array<string>>
}

export interface Api extends Syncable {
  uploadFile(params: Hub.UploadParams): Future<Media.File>
  publishEntries(params: Hub.PublishParams): Future
}

export namespace Api {
  const base = '/hub'
  export const routes = {
    base,
    updates() {
      return base + `/updates`
    },
    ids() {
      return base + `/ids`
    },
    upload() {
      return base + `/upload`
    },
    query() {
      return base + `/query`
    },
    files(location?: string) {
      return base + `/files${location ? '/' + location : ''}`
    }
  }
}
