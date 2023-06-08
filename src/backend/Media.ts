import {Connection, Entry} from 'alinea/core'

export interface Media {
  upload(params: Connection.MediaUploadParams): Promise<string>
  download(params: Connection.DownloadParams): Promise<Connection.Download>
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

  export type File = Entry<FileProperties & Partial<ImageProperties>>
  export type Image = Entry<FileProperties & ImageProperties>

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
