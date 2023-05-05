import {type} from 'alinea/core'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import {MediaExplorer} from '../view/MediaExplorer.js'
import {FileEntry} from '../view/media/FileEntry.js'
import {FileSummaryRow, FileSummaryThumb} from '../view/media/FileSummary.js'
import {MediaSchema as MediaSchemaConfig} from './MediaSchema.js'

const MediaLibrary = type('Media directory', {
  ...MediaSchemaConfig.MediaLibrary,
  [type.meta]: {
    isContainer: true,
    contains: ['MediaLibrary'],
    view: MediaExplorer,
    icon: IcRoundPermMedia
  }
})

const MediaFile = type('File', {
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
