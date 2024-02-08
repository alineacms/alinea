import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import {MediaExplorer} from '../../dashboard/view/MediaExplorer.js'
import {FileEntry} from '../../dashboard/view/media/FileEntry.js'
import {
  FileSummaryRow,
  FileSummaryThumb
} from '../../dashboard/view/media/FileSummary.js'
import {type} from '../Type.js'
import * as config from './MediaSchema.js'

export type MediaLibrary = config.MediaLibrary
export const MediaLibrary: typeof config.MediaLibrary = type(
  'Media directory',
  {
    isContainer: true,
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
  isHidden: true,
  summaryRow: FileSummaryRow,
  summaryThumb: FileSummaryThumb,
  view: FileEntry,
  fields: {
    ...config.MediaFile
  }
})

export const MediaSchema = {
  MediaLibrary,
  MediaFile
}
