import {viewKeys} from '#/dashboard/editor/ViewKeys.js'
import {hidden} from '#/field/hidden.js'
import {text} from '#/field/text/TextField.js'
import {IcRoundPermMedia} from '#/ui/icons/IcRoundPermMedia.js'
import {type Type, type} from '../Type.js'

export type MediaLibrary = Type.Infer<typeof MediaLibrary>
export const MediaLibrary = type('Media directory', {
  view: viewKeys.MediaExplorer,
  icon: IcRoundPermMedia,
  contains: ['MediaLibrary'],
  fields: {
    title: hidden<string>('Title'),
    path: hidden<string>('Path')
  }
})

export type MediaFile = Type.Infer<typeof MediaFile>
export const MediaFile = type('Media file', {
  view: viewKeys.MediaFile,
  summaryRow: viewKeys.FileSummaryRow,
  summaryThumb: viewKeys.FileSummaryThumb,
  hidden: true,
  fields: {
    title: text('Title'),
    path: hidden<string>('Path'),
    location: hidden<string>('Location'),
    previewUrl: hidden<string>('Preview URL'),
    extension: hidden<string>('Extension'),
    size: hidden<number>('File size'),
    hash: hidden<string>('Hash'),
    width: hidden<number>('Image width'),
    height: hidden<number>('Image height'),
    preview: hidden<string>('Preview'),
    averageColor: hidden<string>('Average color'),
    focus: hidden<{x: number; y: number}>('Focus'),
    thumbHash: hidden<string>('Blur hash')
  }
})
