import {Entry} from '../Entry.js'
import {Projection} from '../pages/Projection.js'
import {Query} from '../Query.js'
import {Schema} from '../Schema.js'
import {MediaFile as MediaFileType} from './MediaTypes.js'

export function summarySelection(schema: Schema) {
  const MediaFile = schema.MediaFile as typeof MediaFileType
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
    }),
    childrenAmount: Query.children().count()
  } satisfies Projection
}

// To avoid circular warnings these are typed out instead of using the ReturnType
export type SummaryProps = {
  entryId: string
  i18nId: string
  type: string
  workspace: string
  root: string
  title: string
  extension: string
  size: number
  preview: string
  thumbHash: string
  averageColor: string
  focus: {
    x: number
    y: number
  }
  width: number
  height: number
  parents: Array<{
    entryId: string
    i18nId: string
    title: string
  }>
  childrenAmount: number
}
