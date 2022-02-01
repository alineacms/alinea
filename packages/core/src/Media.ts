import {Collection} from 'helder.store'
import {Entry} from './Entry'

export namespace Media {
  export type Library = Entry

  export const Library = new Collection('Entry', {
    where: Entry.as('MediaLibrary').type.is('MediaLibrary'),
    alias: 'MediaLibrary'
  })

  export type File = Entry & {
    location: string
    extension: string
    size: number
    preview?: string
  }

  export const File = new Collection('Entry', {
    where: Entry.as('File').type.is('File'),
    alias: 'File'
  })
}
