import {hidden} from 'alinea/field/hidden'
import {text} from 'alinea/field/text/TextField'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import {Hint} from '../Hint.js'
import {Type, type} from '../Type.js'

export type MediaLibrary = Type.Infer<typeof MediaLibrary>
export const MediaLibrary = type('Media directory', {
  view: 'alinea/dashboard/view/MediaExplorer#MediaExplorer',
  icon: IcRoundPermMedia,
  isContainer: true,
  contains: ['MediaLibrary'],
  fields: {
    title: hidden<string>('Title', Hint.String()),
    path: hidden<string>('Path', Hint.String())
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
