import {Collection} from '@alinea/store'
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

  export type File = Omit<Entry, 'title'> & {
    title: string
    location: string
    extension: string
    size: number
    hash: string
    preview?: string
    averageColor?: string
    blurHash?: string
  }

  export const File = new Collection<File>('Entry', {
    where: Entry.as(Media.Type.File).type.is(Media.Type.File),
    alias: Media.Type.File
  })

  export namespace File {
    export type Preview = Pick<
      File,
      | 'id'
      | 'workspace'
      | 'root'
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
