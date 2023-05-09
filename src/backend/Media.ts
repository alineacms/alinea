import {Connection, Entry} from 'alinea/core'

export enum Type {
  Libary = 'MediaLibrary',
  File = 'File'
}

export interface FileProperties {
  location: string
  extension: string
  size: number
  hash: string
}

export interface ImageProperties {
  width: number
  height: number
  preview: string
  averageColor: string
  blurHash: string
}

export interface File extends Entry, FileProperties, Partial<ImageProperties> {}

export interface Image extends Entry, FileProperties, ImageProperties {}

export interface Media {
  upload(params: Connection.MediaUploadParams): Promise<string>
  download(params: Connection.DownloadParams): Promise<Connection.Download>
}
