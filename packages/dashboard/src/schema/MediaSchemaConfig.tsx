import {Media, type} from '@alinea/core'
import {Hint} from '@alinea/core/Hint'
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
    location: hidden<string>('Location', Hint.String()),
    extension: hidden<string>('Extension', Hint.String()),
    size: hidden<number>('File size', Hint.Number()),
    hash: hidden<string>('Hash', Hint.String()),
    width: hidden<number>('Image width', Hint.Number()),
    height: hidden<number>('Image height', Hint.Number()),
    preview: hidden<string>('Preview', Hint.String()),
    averageColor: hidden<string>('Average color', Hint.String()),
    blurHash: hidden<string>('Blur hash', Hint.String())
  }).configure({
    isHidden: true
  })
}
