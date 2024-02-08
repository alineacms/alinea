import {Connection, EntryRow} from 'alinea/core'

export interface Media {
  prepareUpload(
    file: string,
    ctx: Connection.Context
  ): Promise<Connection.UploadResponse>
}

export namespace Media {
  type FileProperties = {
    title: string
    location: string
    extension: string
    size: number
    hash: string
  }

  type ImageProperties = {
    width: number
    height: number
    preview: string
    averageColor: string
    focus: {x: number; y: number}
    thumbHash: string
  }

  export const ORIGINAL_LOCATION = '@alinea.location'

  export type File = EntryRow<FileProperties & Partial<ImageProperties>>
  export type Image = EntryRow<FileProperties & ImageProperties>
}
