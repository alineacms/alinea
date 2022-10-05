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
    location: hidden<string>('Location', 'string'),
    extension: hidden<string>('Extension', 'string'),
    size: hidden<number>('File size', 'number'),
    hash: hidden<string>('Hash', 'string'),
    width: hidden<number>('Image width', 'number'),
    height: hidden<number>('Image height', 'number'),
    preview: hidden<string>('Preview', 'string'),
    averageColor: hidden<string>('Average color', 'string'),
    blurHash: hidden<string>('Blur hash', 'string')
  }).configure({
    isHidden: true
  })
}
