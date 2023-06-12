import {Type, type} from 'alinea/core'
import {Hint} from 'alinea/core/Hint'
import {hidden} from 'alinea/input/hidden'
import {path} from 'alinea/input/path'
import {text} from 'alinea/input/text'

export type MediaLibrary = Type.Infer<typeof MediaLibrary>
export const MediaLibrary = type('Media directory server', {
  title: text('Title'),
  path: path('Path'),
  [type.meta]: {
    isContainer: true,
    contains: ['MediaLibrary']
  }
})

export type MediaFile = Type.Infer<typeof MediaFile>
export const MediaFile = type('File', {
  title: text('Title'),
  path: path('Path'),
  location: hidden<string>('Location', Hint.String()),
  extension: hidden<string>('Extension', Hint.String()),
  size: hidden<number>('File size', Hint.Number()),
  hash: hidden<string>('Hash', Hint.String()),
  width: hidden<number>('Image width', Hint.Number()),
  height: hidden<number>('Image height', Hint.Number()),
  preview: hidden<string>('Preview', Hint.String()),
  averageColor: hidden<string>('Average color', Hint.String()),
  blurHash: hidden<string>('Blur hash', Hint.String()),
  [type.meta]: {
    isHidden: true
  }
})

export const MediaSchema = {
  MediaLibrary,
  MediaFile
}
