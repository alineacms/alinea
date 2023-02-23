import {Collection} from 'alinea/store'
import {Entry} from './Entry'

export namespace Media {
  export enum Type {
    Libary = 'MediaLibrary',
    File = 'File'
  }

  export type Library = Entry

  export const Library = new Collection<Library>('Entry', {
    where: Entry.as(Media.Type.Libary).type.is(Media.Type.Libary),
    alias: Media.Type.Libary
  })

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

  export type File = Entry & FileProperties & Partial<ImageProperties>

  export type Image = Entry & FileProperties & ImageProperties

  export const File = new Collection<File>('Entry', {
    where: Entry.as(Media.Type.File).type.is(Media.Type.File),
    alias: Media.Type.File
  })

  export namespace File {
    export type Preview = Pick<
      File,
      | 'alinea'
      | 'title'
      | 'extension'
      | 'size'
      | 'preview'
      | 'averageColor'
      | 'blurHash'
    >
  }

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
