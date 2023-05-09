import {type} from 'alinea/core'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import {MediaExplorer} from '../../dashboard/view/MediaExplorer.js'
import {FileEntry} from '../../dashboard/view/media/FileEntry.js'
import {
  FileSummaryRow,
  FileSummaryThumb
} from '../../dashboard/view/media/FileSummary.js'
import {MediaSchema as MediaSchemaConfig} from './MediaSchema.js'

export const MediaLibrary = type('Media directory', {
  ...MediaSchemaConfig.MediaLibrary,
  [type.meta]: {
    isContainer: true,
    contains: ['MediaLibrary'],
    view: MediaExplorer,
    icon: IcRoundPermMedia
  }
})

export const MediaFile = type('File', {
  ...MediaSchemaConfig.MediaFile,
  [type.meta]: {
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
