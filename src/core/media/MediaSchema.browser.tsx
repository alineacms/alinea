import {type} from 'alinea/core'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import {MediaExplorer} from '../../dashboard/view/MediaExplorer.js'
import {FileEntry} from '../../dashboard/view/media/FileEntry.js'
import {
  FileSummaryRow,
  FileSummaryThumb
} from '../../dashboard/view/media/FileSummary.js'
import {Meta} from '../Meta.js'
import * as config from './MediaSchema.js'

export type MediaLibrary = config.MediaLibrary
export const MediaLibrary: typeof config.MediaLibrary = type(
  'Media directory',
  {
    ...config.MediaLibrary,
    [Meta]: {
      isContainer: true,
      contains: ['MediaLibrary'],
      view: MediaExplorer,
      icon: IcRoundPermMedia
    }
  }
)

export type MediaFile = config.MediaFile
export const MediaFile: typeof config.MediaFile = type('File', {
  ...config.MediaFile,
  [Meta]: {
    isHidden: true,
    summaryRow: FileSummaryRow,
    summaryThumb: FileSummaryThumb,
    view: FileEntry
  }
})

export const MediaSchema = {
  MediaLibrary,
  MediaFile
}
