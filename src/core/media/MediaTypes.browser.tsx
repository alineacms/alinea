import {MediaExplorer} from 'alinea/dashboard/view/MediaExplorer'
import {FileEntry} from 'alinea/dashboard/view/media/FileEntry'
import {
  FileSummaryRow,
  FileSummaryThumb
} from 'alinea/dashboard/view/media/FileSummary'
import {text} from 'alinea/field/text/TextField'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import {type} from '../Type.js'
import * as config from './MediaTypes.js'

export type MediaLibrary = config.MediaLibrary
export const MediaLibrary: typeof config.MediaLibrary = type(
  'Media directory',
  {
    contains: ['MediaLibrary'],
    view: MediaExplorer,
    icon: IcRoundPermMedia,
    fields: {
      ...config.MediaLibrary
    }
  }
)

export type MediaFile = config.MediaFile
export const MediaFile: typeof config.MediaFile = type('File', {
  hidden: true,
  summaryRow: FileSummaryRow,
  summaryThumb: FileSummaryThumb,
  view: FileEntry as any,
  fields: {
    ...config.MediaFile,
    title: text('Title')
  }
})
