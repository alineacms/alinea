import type {EntryStatus} from '#/core/Entry.js'
import type {Status} from '#/core/Graph.js'

export type EntryReferenceLinkType = 'entry' | 'image' | 'file'

export interface EntryReferenceTarget {
  targetId: string
  fieldPath: string
  fieldLabel?: string
  /** Labels of the fields (and row types) along the path to the field */
  fieldLabels?: Array<string>
  linkId?: string
  linkType?: EntryReferenceLinkType
}

export interface EntryReference {
  targetId: string
  sourceId: string
  sourceFilePath: string
  sourceType: string
  sourceLocale: string | null
  sourceStatus: EntryStatus
  sourceActive: boolean
  sourceMain: boolean
  fieldPath: string
  fieldLabel?: string
  /** Labels of the fields (and row types) along the path to the field */
  fieldLabels?: Array<string>
  linkId?: string
  linkType?: EntryReferenceLinkType
}

export interface EntryReferenceQuery {
  targetId: string
  status?: Status
  locale?: string | null
}

export interface EntryReferenceResult {
  references: Array<EntryReference>
  total: number
}

export interface FieldReferenceContext {
  path: Array<string>
  label?: string
  /** Labels of the fields (and row types) along the path, ending in label */
  labels: Array<string>
}

export function referenceFieldPath(path: Array<string>): string {
  return path.join('.')
}
