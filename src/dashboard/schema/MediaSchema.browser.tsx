import {Media} from 'alinea/core/Media'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import {FileEntry} from '../view/media/FileEntry.js'
import {FileSummaryRow, FileSummaryThumb} from '../view/media/FileSummary.js'
import {MediaExplorer} from '../view/MediaExplorer.js'
import {MediaSchema as MediaSchemaConfig} from './MediaSchema.js'

const {Libary, File} = Media.Type

export const MediaSchema = {
  [Libary]: MediaSchemaConfig[Libary].configure({
    view: MediaExplorer,
    icon: IcRoundPermMedia
  }),
  [File]: MediaSchemaConfig[File].configure({
    summaryRow: FileSummaryRow,
    summaryThumb: FileSummaryThumb,
    view: FileEntry
  })
}
