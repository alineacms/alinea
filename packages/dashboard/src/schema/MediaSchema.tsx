import {Media, type} from '@alinea/core'
import {text} from '@alinea/input.text'
import {IcRoundPermMedia} from '@alinea/ui/icons/IcRoundPermMedia'
import {FileSummaryRow, FileSummaryThumb} from '../view/media/FileSummary'
import {MediaExplorer} from '../view/MediaExplorer'

export const MediaSchema = {
  MediaLibrary: type('Media directory', {
    title: text('Title')
  }).configure({
    isContainer: true,
    contains: [Media.Type.Libary],
    view: MediaExplorer,
    icon: IcRoundPermMedia
  }),
  File: type('File', {
    title: text('Title')
  }).configure({
    isHidden: true,
    summaryRow: FileSummaryRow,
    summaryThumb: FileSummaryThumb
  })
}
