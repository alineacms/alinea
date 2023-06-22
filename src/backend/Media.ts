import {Connection, EntryRow} from 'alinea/core'

export interface Media {
  upload(
    params: Connection.MediaUploadParams,
    ctx: Connection.Context
  ): Promise<string>
  download(
    params: Connection.DownloadParams,
    ctx: Connection.Context
  ): Promise<Connection.Download>
}

export namespace Media {
  type FileProperties = {
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
    blurHash: string
  }

  export type File = EntryRow<FileProperties & Partial<ImageProperties>>
  export type Image = EntryRow<FileProperties & ImageProperties>

  export const imageExtensions = [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.bmp',
    '.webp',
    '.avif',
    '.heic'
  ]

  export function isImage(path: string) {
    const extension = path.split('.').pop()
    return extension && imageExtensions.includes(`.${extension}`)
  }
}
