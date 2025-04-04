import {hidden} from 'alinea/field/hidden'
import {text} from 'alinea/field/text/TextField'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import {type Type, type} from '../Type.js'

export type MediaLibrary = Type.Infer<typeof MediaLibrary>
export const MediaLibrary = type('Media directory', {
  view: 'alinea/dashboard/view/MediaExplorer#MediaExplorer',
  icon: IcRoundPermMedia,
  contains: ['MediaLibrary'],
  fields: {
    title: hidden<string>('Title'),
    path: hidden<string>('Path')
  }
})

export type MediaFile = Type.Infer<typeof MediaFile>
export const MediaFile = type('Media file', {
  view: 'alinea/dashboard/view/media/FileEntry#FileEntry',
  summaryRow: 'alinea/dashboard/view/media/FileSummary#FileSummaryRow',
  summaryThumb: 'alinea/dashboard/view/media/FileSummary#FileSummaryThumb',
  hidden: true,
  fields: {
    title: text('Title'),
    path: hidden<string>('Path'),
    location: hidden<string>('Location'),
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
