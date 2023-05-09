import {Connection, Future, Media} from 'alinea/core'
import {AlineaMeta} from './db/AlineaMeta.js'
import {Entry} from './db/Entry.js'

export interface UpdateResponse {
  contentHash: string
  entries: Array<Entry>
}

export interface Syncable {
  updates(request: AlineaMeta): Promise<UpdateResponse | Uint8Array>
  ids(): Promise<Array<string>>
}

export interface Api extends Syncable {
  uploadFile(params: Connection.UploadParams): Future<Media.File>
  publishEntries(params: Connection.PublishParams): Future
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
