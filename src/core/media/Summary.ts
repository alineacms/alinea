import {Entry} from '../Entry.js'
import type {Schema} from '../Schema.js'
import {FileData} from './MediaTypes.js'

export function summarySelection(_schema: Schema) {
  return {
    id: Entry.id,
    locale: Entry.locale,
    type: Entry.type,
    workspace: Entry.workspace,
    root: Entry.root,
    title: Entry.title,
    path: Entry.path,
    url: Entry.url,
    extension: FileData.extension,
    size: FileData.size,
    preview: FileData.preview,
    thumbHash: FileData.thumbHash,
    averageColor: FileData.averageColor,
    focus: FileData.focus,
    width: FileData.width,
    height: FileData.height,
    parents: {
      edge: 'parents' as const,
      select: {
        id: Entry.id,
        title: Entry.title
      }
    },
    childrenAmount: {
      edge: 'children' as const,
      count: true as const
    }
  }
}

// To avoid circular warnings these are typed out instead of using the ReturnType
export type SummaryProps = {
  id: string
  type: string
  workspace: string
  root: string
  title: string
  path: string
  url: string
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
    id: string
    title: string
  }>
  childrenAmount: number
}
