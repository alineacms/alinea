import {Media, type} from '@alineacms/core'
import {text} from '@alineacms/input.text'
import {MdOutlinePermMedia} from 'react-icons/md'
import {FileSummaryRow, FileSummaryThumb} from '../view/media/FileSummary'
import {MediaExplorer} from '../view/MediaExplorer'

export const MediaSchema = {
  MediaLibrary: type('Media directory', {
    title: text('Title')
  }).configure({
    isContainer: true,
    contains: [Media.Type.Libary],
    view: MediaExplorer,
    icon: MdOutlinePermMedia
  }),
  File: type('File', {
    title: text('Title')
  }).configure({
    isHidden: true,
    summaryRow: FileSummaryRow,
    summaryThumb: FileSummaryThumb
  })
}
