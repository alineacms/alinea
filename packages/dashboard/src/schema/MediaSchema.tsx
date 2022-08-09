import {Media, type} from '@alinea/core'
import {hidden} from '@alinea/input.hidden'
import {text} from '@alinea/input.text'
import {IcRoundPermMedia} from '@alinea/ui/icons/IcRoundPermMedia'
import {FileEntry} from '../view/media/FileEntry'
import {FileSummaryRow, FileSummaryThumb} from '../view/media/FileSummary'
import {MediaExplorer} from '../view/MediaExplorer'

export const MediaSchema = {
  [Media.Type.Libary]: type('Media directory', {
    title: text('Title')
  }).configure({
    isContainer: true,
    contains: [Media.Type.Libary],
    view: MediaExplorer,
    icon: IcRoundPermMedia
  }),
  [Media.Type.File]: type('File', {
    title: text('Title'),
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
    isHidden: true,
    summaryRow: FileSummaryRow,
    summaryThumb: FileSummaryThumb,
    view: FileEntry
  })
}
