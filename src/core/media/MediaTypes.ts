import {hidden} from 'alinea/field/hidden'
import {Entry} from '../Entry.js'
import {Hint} from '../Hint.js'
import {Query} from '../Query.js'
import {Type, type} from '../Type.js'
import {Projection} from '../pages/Projection.js'

export type MediaLibrary = Type.Infer<typeof MediaLibrary>
export const MediaLibrary = type('Media directory', {
  isContainer: true,
  contains: ['MediaLibrary'],
  fields: {
    title: hidden<string>('Title', Hint.String()),
    path: hidden<string>('Path', Hint.String())
  }
})

export type MediaFile = Type.Infer<typeof MediaFile>
export const MediaFile = type('Media file', {
  hidden: true,
  fields: {
    title: hidden<string>('Title', Hint.String()),
    path: hidden<string>('Path', Hint.String()),
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
