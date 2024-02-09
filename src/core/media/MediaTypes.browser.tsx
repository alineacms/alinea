import {MediaExplorer} from 'alinea/dashboard/view/MediaExplorer'
import {FileEntry} from 'alinea/dashboard/view/media/FileEntry'
import {
  FileSummaryRow,
  FileSummaryThumb
} from 'alinea/dashboard/view/media/FileSummary'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import {Entry} from '../Entry.js'
import {Query} from '../Query.js'
import {type} from '../Type.js'
import {view} from '../View.js'
import * as config from './MediaTypes.js'

export function fileSummarySelect() {
  return {
    entryId: Entry.entryId,
    i18nId: Entry.i18nId,
    type: Entry.type,
    workspace: Entry.workspace,
    root: Entry.root,
    title: Entry.title,
    extension: MediaFile.extension,
    size: MediaFile.size,
    preview: MediaFile.preview,
    thumbHash: MediaFile.thumbHash,
    averageColor: MediaFile.averageColor,
    focus: MediaFile.focus,
    width: MediaFile.width,
    height: MediaFile.height,
    parents: Query.parents().select({
      entryId: Entry.entryId,
      i18nId: Entry.i18nId,
      title: Entry.title
    })
  }
}

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
  summaryRow: view(fileSummarySelect, FileSummaryRow),
  summaryThumb: view(fileSummarySelect, FileSummaryThumb),
  view: FileEntry as any,
  fields: {
    ...config.MediaFile
  }
})
