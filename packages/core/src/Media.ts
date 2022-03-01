import {Collection} from '@alinea/store'
import {Entry} from './Entry'

export namespace Media {
  export type Library = Entry

  export const Library = new Collection<Library>('Entry', {
    where: Entry.as('MediaLibrary').type.is('MediaLibrary'),
    alias: 'MediaLibrary'
  })

  export type File = Omit<Entry, 'title'> & {
    title: string
    location: string
    extension: string
    size: number
    hash: string
    preview?: string
    averageColor?: string
  }

  export const File = new Collection<File>('Entry', {
    where: Entry.as('File').type.is('File'),
    alias: 'File'
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
    >
  }
}
