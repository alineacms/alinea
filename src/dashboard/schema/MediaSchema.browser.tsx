import {type} from 'alinea/core'
import {Media} from 'alinea/core/Media'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import {MediaExplorer} from '../view/MediaExplorer.js'
import {FileEntry} from '../view/media/FileEntry.js'
import {FileSummaryRow, FileSummaryThumb} from '../view/media/FileSummary.js'
import {MediaSchema as MediaSchemaConfig} from './MediaSchema.js'

const {Libary, File} = Media.Type

const MediaLibrary = type('Media directory', {
  ...MediaSchemaConfig[Libary],
  [type.meta]: {
    isContainer: true,
    contains: [Libary],
    view: MediaExplorer,
    icon: IcRoundPermMedia
  }
})

const MediaFile = type('File', {
  ...MediaSchemaConfig[File],
  [type.meta]: {
    isHidden: true,
    summaryRow: FileSummaryRow,
    summaryThumb: FileSummaryThumb,
    view: FileEntry
  }
})

export const MediaSchema = {
  [Libary]: MediaLibrary,
  [File]: MediaFile
}
