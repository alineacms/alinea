import {type} from '@alinea/core'
import {text} from '@alinea/input.text'
import {MdOutlinePermMedia} from 'react-icons/md'
import {FileSummaryRow, FileSummaryThumb} from '../view/media/FileSummary'
import {MediaExplorer} from '../view/MediaExplorer'

export const MediaSchema = {
  MediaLibrary: type('Media directory', {
    title: text('Title')
  }).configure({
    isContainer: true,
    contains: ['MediaLibrary'],
    view: MediaExplorer,
    icon: MdOutlinePermMedia
  }),
  File: type('File', {
    title: text('Title')
    // Todo: typed this as any until we introduce localisation
  }).configure<any>({
    isHidden: true,
    summaryRow: FileSummaryRow,
    summaryThumb: FileSummaryThumb
  })
}
