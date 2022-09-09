import {Media, type} from '@alinea/core'
import {hidden} from '@alinea/input.hidden'
import {path} from '@alinea/input.path'
import {text} from '@alinea/input.text'

export const MediaSchema = {
  [Media.Type.Libary]: type('Media directory', {
    title: text('Title'),
    path: path('Path')
  }).configure({
    isContainer: true,
    contains: [Media.Type.Libary]
  }),
  [Media.Type.File]: type('File', {
    title: text('Title'),
    path: path('Path'),
    location: hidden<string>('Location'),
    extension: hidden<string>('Extension'),
    size: hidden<number>('File size'),
    hash: hidden<string>('Hash'),
    width: hidden<number>('Image width'),
    height: hidden<number>('Image height'),
    preview: hidden<string>('Preview'),
    averageColor: hidden<string>('Average color'),
    blurHash: hidden<string>('Blur hash')
  }).configure({
    isHidden: true
  })
}
