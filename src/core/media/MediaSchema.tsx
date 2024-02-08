import {Hint} from 'alinea/core/Hint'
import {Type, type} from 'alinea/core/Type'
import {hidden} from 'alinea/field/hidden'
import {path} from 'alinea/field/path'
import {text} from 'alinea/field/text'

export type MediaLibrary = Type.Infer<typeof MediaLibrary>
export const MediaLibrary = type('Media directory', {
  isContainer: true,
  contains: ['MediaLibrary'],
  fields: {
    title: text('Title'),
    path: path('Path')
  }
})

export type MediaFile = Type.Infer<typeof MediaFile>
export const MediaFile = type('File', {
  isHidden: true,
  fields: {
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
    focus: hidden<{x: number; y: number}>(
      'Focus',
      Hint.Object({
        x: Hint.Number(),
        y: Hint.Number()
      })
    ),
    thumbHash: hidden<string>('Blur hash', Hint.String())
  }
})

export const MediaSchema = {
  MediaLibrary,
  MediaFile
}
